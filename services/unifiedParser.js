/**
 * ENTERPRISE PHARMACEUTICAL ORDER EXTRACTION SYSTEM
 * Production-Grade Parser for Pharma Purchase Orders & Indent Forms
 * 
 * Strict Template Compliance:
 * CODE | CUSTOMER NAME | SAPCODE | ITEMDESC | ORDERQTY | BOX PACK | PACK | DVN
 */

import { extractTextFromPDFAdvanced } from "./pdfParser.js";
import { normalizeKey } from "../utils/normalizeKey.js";
import XLSX from "xlsx";

/* ========================================================================
   CONSTANTS & CONFIGURATION
======================================================================== */

const TEMPLATE_COLUMNS = [
  "CODE",
  "CUSTOMER NAME", 
  "SAPCODE",
  "ITEMDESC",
  "ORDERQTY",
  "BOX PACK",
  "PACK",
  "DVN"
];

const PARSING_STATE = {
  OUTSIDE_TABLE: "OUTSIDE_TABLE",
  INSIDE_TABLE: "INSIDE_TABLE",
  INSIDE_COMPANY_BLOCK: "INSIDE_COMPANY_BLOCK"
};

const QTY_LIMITS = {
  MIN: 1,
  MAX: 10000
};

const SAPCODE_PATTERN = /^\d{4,7}$/;

/* ========================================================================
   UTILITY FUNCTIONS - DATA CLEANING & VALIDATION
======================================================================== */

function clean(text = "") {
  return String(text).replace(/\s+/g, " ").trim();
}

function safeInt(value, defaultVal = 0) {
  if (value === null || value === undefined) return defaultVal;
  const n = typeof value === "number" ? value : parseInt(String(value).replace(/[^\d]/g, ""), 10);
  return Number.isInteger(n) ? n : defaultVal;
}

function validateQty(qty) {
  const n = safeInt(qty, 0);
  return (n >= QTY_LIMITS.MIN && n <= QTY_LIMITS.MAX) ? n : 0;
}

function isSAPCode(token) {
  return SAPCODE_PATTERN.test(String(token).trim());
}

function cleanItemDesc(text) {
  return clean(text)
    // Remove [Approx Value: ...] annotations
    .replace(/\[approx\s*value\s*:.*?\]/gi, "")
    // Remove units (but keep the item name)
    .replace(/\b(gm|mg|ml|caps?|tabs?|tablet|capsule|syrup|injection|inj|strip|pack|box|bottle|vial)\b/gi, "")
    // Remove pack multipliers like "10'S" but keep the base name
    .replace(/\d+\s*['"]s?\b/gi, "")
    // Remove asterisk multipliers like "*5"
    .replace(/\*\d+/g, "")
    // Remove free quantity annotations
    .replace(/\+\d+\s*(free|bonus)/gi, "")
    // Remove standalone asterisks at the end
    .replace(/\s+\*+\s*$/g, "")
    // Remove multiple spaces
    .replace(/\s{2,}/g, " ")
    .trim();
}

function cleanCustomerName(text) {
  return clean(text)
    .replace(/\d{2}\/\d{2}\/\d{4}/g, "")
    .replace(/(address|gstin|gst|pan|dl\s*no|mob|mobile|email|phone|fssai|tin)[\s:].*/gi, "")
    .replace(/[,;:]+$/, "")
    .trim();
}

function isNoiseKeyword(line) {
  return /(cancel|pending|authorised|authorized|signatory|note\s*:|remarks?|split\s*details|terms\s*&?\s*conditions|page\s+\d+|continued|total\s*value)/i.test(line);
}

function isTableStopLine(line) {
  return /^(grand\s*total|net\s*total|gross\s*total|total\s*order|end\s*of\s*order)/i.test(line);
}

/* ========================================================================
   CUSTOMER NAME EXTRACTION (UNIVERSAL)
======================================================================== */

function extractCustomerName(lines) {
  const patterns = [
    /(?:supplier|party\s*name|buyer|customer|bill\s*to|ship\s*to)\s*[:\-]\s*(.+)/i,
    /^([A-Z][A-Z\s&.]+(?:ENTERPRISES|AGENCIES|DISTRIBUTORS|PHARMA|HEALTHCARE|MEDICALS?|LTD|PVT|LIMITED|INC))/i,
  ];

  for (let i = 0; i < Math.min(lines.length, 40); i++) {
    const line = clean(lines[i]);
    
    // Skip metadata lines
    if (/^(gstin|gst|pan|dl|mob|email|phone|address|fssai|tin)/i.test(line)) {
      continue;
    }

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match?.[1]) {
        const customer = cleanCustomerName(match[1]);
        if (customer.length > 3 && !/\d{10}/.test(customer)) {
          return customer;
        }
      }
    }
  }

  return "UNKNOWN CUSTOMER";
}

/* ========================================================================
   TOKEN-BASED PRODUCT PARSER (NO HARD REGEX)
   
   Strategy:
   1. Split line into tokens
   2. Identify SAP code (4-7 digit number)
   3. Identify ORDERQTY (last valid integer <= 10000)
   4. Everything between SAP and QTY = ITEMDESC
======================================================================== */

function tokenizeLine(line) {
  return line.split(/\s+/).filter(t => t.length > 0);
}

function parseProductLineTokens(line) {
  const cleanLine = clean(line);
  if (!cleanLine) return null;

  // Hard reject totals and footers
  if (isTableStopLine(cleanLine) || isNoiseKeyword(cleanLine)) {
    return null;
  }

  const tokens = tokenizeLine(cleanLine);
  if (tokens.length < 2) return null;

  let sapcode = "";
  let orderqty = 0;
  let itemdesc = "";

  // Strategy 1: Find SAP code (first occurrence of 4-7 digit number)
  let sapIndex = -1;
  for (let i = 0; i < tokens.length; i++) {
    if (isSAPCode(tokens[i])) {
      sapcode = tokens[i];
      sapIndex = i;
      break;
    }
  }

  // Strategy 2: Find ORDERQTY (last valid integer in reasonable range)
  let qtyIndex = -1;
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i];
    
    // Skip known non-qty keywords
    if (/^(free|bonus|scheme|value|rate|price|amount|mrp|ptr|pts|total)$/i.test(token)) {
      continue;
    }

    const qty = validateQty(token);
    if (qty > 0) {
      orderqty = qty;
      qtyIndex = i;
      break;
    }
  }

  // Strategy 3: Extract ITEMDESC (tokens between SAP and QTY)
  if (sapIndex !== -1 && qtyIndex !== -1 && qtyIndex > sapIndex + 1) {
    const descTokens = tokens.slice(sapIndex + 1, qtyIndex);
    itemdesc = cleanItemDesc(descTokens.join(" "));
  } else if (sapIndex === -1 && qtyIndex !== -1) {
    // No SAP code, treat everything before QTY as description
    const descTokens = tokens.slice(0, qtyIndex);
    itemdesc = cleanItemDesc(descTokens.join(" "));
  }

  // Validation: Must have at least itemdesc and qty
  if (!itemdesc || itemdesc.length < 2 || !orderqty) {
    return null;
  }

  return {
    sapcode: sapcode || "",
    itemdesc,
    orderqty
  };
}

/* ========================================================================
   STATE MACHINE PDF PARSER
   
   Handles:
   - Multi-company blocks
   - Dynamic column orders
   - Page breaks
   - Rate presence/absence
======================================================================== */

export async function extractPurchaseOrderPDF(file) {
  try {
    const { lines } = await extractTextFromPDFAdvanced(file.buffer);

    const customerName = extractCustomerName(lines);
    const dataRows = [];

    let state = PARSING_STATE.OUTSIDE_TABLE;
    let currentDVN = "";
    let pendingSAPCode = null;

    for (let i = 0; i < lines.length; i++) {
      const line = clean(lines[i]);
      if (!line) continue;

      // Skip metadata everywhere
      if (/^(gstin|gst|mob|mobile|dl\s*no|pan|tin|email|phone|address|fssai)/i.test(line)) {
        continue;
      }

      // Handle Company/Division headers (DO NOT STOP TABLE)
      const companyMatch = line.match(/(?:company|division)\s*[:\-]\s*(.+)/i);
      if (companyMatch) {
        // Clean DVN - remove [Approx Value: ...] and other annotations
        let dvn = clean(companyMatch[1]);
        dvn = dvn.replace(/\[approx\s*value\s*:.*?\]/gi, "").trim();
        currentDVN = dvn;
        
        // Keep state as INSIDE_TABLE if already parsing
        if (state === PARSING_STATE.OUTSIDE_TABLE) {
          state = PARSING_STATE.INSIDE_TABLE;
        }
        pendingSAPCode = null;
        continue;
      }

      // Detect table start
      if (state === PARSING_STATE.OUTSIDE_TABLE) {
        const isHeader = /(sl\s*no|s\.no|sr\s*no).*(code|item|product)/i.test(line) ||
                        /(item|product).*(qty|quantity|order)/i.test(line) ||
                        /(code).*(qty|quantity)/i.test(line);
        
        // Force start if line begins with SAP code
        const startsWithSAP = /^\d{4,7}\s/.test(line);
        
        if (isHeader || startsWithSAP) {
          state = PARSING_STATE.INSIDE_TABLE;
          pendingSAPCode = null;
          continue;
        }
      }

      if (state !== PARSING_STATE.INSIDE_TABLE) continue;

      // Hard stop on totals
      if (isTableStopLine(line)) {
        state = PARSING_STATE.OUTSIDE_TABLE;
        pendingSAPCode = null;
        continue;
      }

      // Skip noise
      if (isNoiseKeyword(line)) {
        continue;
      }

      // Parse product using token strategy
      const product = parseProductLineTokens(line);

      if (product) {
        // Handle split-row scenario (SAP code on previous line)
        if (pendingSAPCode && !product.sapcode && product.itemdesc && product.orderqty) {
          dataRows.push([
            customerName,
            pendingSAPCode,
            product.itemdesc,
            product.orderqty,
            currentDVN
          ]);
          pendingSAPCode = null;
          continue;
        }

        // Normal case: complete row
        if (product.itemdesc && product.orderqty) {
          dataRows.push([
            customerName,
            product.sapcode,
            product.itemdesc,
            product.orderqty,
            currentDVN
          ]);
          pendingSAPCode = null;
          continue;
        }

        // Handle standalone SAP code
        if (product.sapcode && !product.itemdesc) {
          pendingSAPCode = product.sapcode;
        }
      } else {
        // Check if line is just a SAP code
        if (isSAPCode(line)) {
          pendingSAPCode = line;
        }
      }
    }

    // Final validation and template enforcement
    const validRows = dataRows.filter(row => {
      const [customer, sapcode, itemdesc, orderqty, dvn] = row;
      return itemdesc && 
             itemdesc.length >= 2 && 
             orderqty >= QTY_LIMITS.MIN && 
             orderqty <= QTY_LIMITS.MAX;
    });

    return createTemplateOutput(validRows, customerName);

  } catch (err) {
    console.error("❌ PDF extraction failed:", err);
    return createEmptyResult("PDF_EXTRACTION_FAILED");
  }
}

/* ========================================================================
   TEXT FILE PARSER (INDENT FORMS)
======================================================================== */

export async function extractOrderText(file) {
  try {
    if (!file?.buffer) {
      return createEmptyResult("EMPTY_FILE");
    }

    const text = file.buffer.toString("utf8");
    const lines = text.split(/\r?\n/).map(l => clean(l)).filter(Boolean);

    const customerName = extractCustomerName(lines);
    const dataRows = [];

    let state = PARSING_STATE.OUTSIDE_TABLE;

    for (const line of lines) {
      // Detect table start
      if (state === PARSING_STATE.OUTSIDE_TABLE) {
        if (/(item|product).*(qty|quantity|order)/i.test(line) ||
            /(code).*(qty|quantity)/i.test(line)) {
          state = PARSING_STATE.INSIDE_TABLE;
          continue;
        }
      }

      if (state !== PARSING_STATE.INSIDE_TABLE) continue;

      // Stop at footer
      if (/(total\s*value|net\s*value|despatch|dispatch|authorised|authorized|signatory)/i.test(line)) {
        break;
      }

      // Skip noise
      if (isNoiseKeyword(line)) {
        continue;
      }

      // Parse using token strategy
      const product = parseProductLineTokens(line);

      if (product && product.itemdesc && product.orderqty) {
        // Additional validation for text files - ensure itemdesc is meaningful
        const cleanDesc = product.itemdesc.replace(/[*\s-]/g, "");
        if (cleanDesc.length >= 3) {
          dataRows.push([
            customerName,
            product.sapcode,
            product.itemdesc,
            product.orderqty,
            ""
          ]);
        }
      }
    }

    return createTemplateOutput(dataRows, customerName);

  } catch (err) {
    console.error("❌ TXT extraction failed:", err);
    return createEmptyResult("TXT_EXTRACTION_FAILED");
  }
}

/* ========================================================================
   EXCEL PARSER WITH AUTO-MAPPING
======================================================================== */

export async function extractInvoiceExcel(file) {
  try {
    const workbook = XLSX.read(file.buffer, {
      type: "buffer",
      cellText: false,
      raw: false
    });

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      blankrows: false
    });

    if (!rows || rows.length === 0) {
      return createEmptyResult("EMPTY_FILE");
    }

    // Find header row
    const headerIndex = findHeaderRow(rows);
    if (headerIndex === -1) {
      return createEmptyResult("TABLE_HEADER_NOT_FOUND");
    }

    const metaRows = rows.slice(0, headerIndex);
    const headers = rows[headerIndex].map((h, i) => 
      normalizeKey(h) || `column_${i + 1}`
    );

    const dataRows = rows
      .slice(headerIndex + 1)
      .filter(row => row.some(cell => String(cell || "").trim() !== ""));

    if (!dataRows.length) {
      return createEmptyResult("NO_DATA_ROWS");
    }

    // Extract customer
    const customerName = extractCustomerName(metaRows.map(r => r.join(" ")));

    // Create column mapping
    const mapping = createColumnMapping(headers);

    // Transform rows to template format
    const transformedRows = dataRows.map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = row[i];
      });

      return [
        customerName,
        String(obj[mapping.sapcode] || "").trim(),
        cleanItemDesc(String(obj[mapping.itemdesc] || "")),
        validateQty(obj[mapping.orderqty]),
        String(obj[mapping.dvn] || "").trim()
      ];
    }).filter(row => {
      const [, , itemdesc, orderqty] = row;
      return itemdesc && itemdesc.length >= 2 && orderqty > 0;
    });

    return createTemplateOutput(transformedRows, customerName);

  } catch (err) {
    console.error("❌ Excel extraction failed:", err);
    return createEmptyResult("EXCEL_EXTRACTION_FAILED");
  }
}

function findHeaderRow(rows) {
  const keywords = ["item", "product", "qty", "quantity", "code", "sap", "order", "name"];

  for (let i = 0; i < Math.min(rows.length, 50); i++) {
    const row = rows[i].map(c => normalizeKey(c || ""));
    
    if (row.every(cell => !cell)) continue;

    // Check for pharma visual table
    if (row.some(c => c === "product") && row.some(c => c.includes("quantity"))) {
      return i;
    }

    // Check for company format
    const hasCompany = row.some(c => c.includes("company"));
    const hasDivision = row.some(c => c.includes("division"));
    const hasItemOrQty = row.some(c => c.includes("item") || c.includes("qty"));
    
    if (hasCompany && hasDivision && hasItemOrQty) {
      return i;
    }

    // Standard match: 3+ keywords
    const matches = row.filter(cell => 
      keywords.some(kw => cell.includes(kw))
    );
    
    if (matches.length >= 3) {
      return i;
    }

    // Relaxed: 2+ with core column
    if (matches.length >= 2) {
      const hasCore = row.some(c => c.includes("itemdesc") || c.includes("orderqty"));
      if (hasCore) return i;
    }

    // Simple 2-column sheet
    if (row.length <= 3 && 
        row.some(c => c.includes("item") || c.includes("product")) &&
        row.some(c => c.includes("qty") || c.includes("quantity"))) {
      return i;
    }
  }

  return -1;
}

function createColumnMapping(headers) {
  const mapping = {
    sapcode: "",
    itemdesc: "",
    orderqty: "",
    dvn: ""
  };

  const aliases = {
    sapcode: ["sapcode", "sap", "code", "itemcode", "item code", "product code"],
    itemdesc: ["itemdesc", "item name", "product name", "product", "description", "desc", "medicine", "name"],
    orderqty: ["orderqty", "order qty", "qty", "quantity"],
    dvn: ["dvn", "division", "div", "company"]
  };

  headers.forEach((header, index) => {
    const normalized = normalizeKey(header);
    
    Object.entries(aliases).forEach(([target, keywords]) => {
      if (keywords.some(kw => normalized === kw || normalized.includes(kw))) {
        if (!mapping[target]) {
          mapping[target] = header;
        }
      }
    });
  });

  return mapping;
}

/* ========================================================================
   TEMPLATE OUTPUT GENERATOR
   
   Strict enforcement of 8-column template
======================================================================== */

function createTemplateOutput(dataRows, customerName) {
  const templateRows = dataRows.map(row => {
    const [customer, sapcode, itemdesc, orderqty, dvn] = row;

    return {
      "CODE": "",
      "CUSTOMER NAME": customer || customerName,
      "SAPCODE": sapcode || "",
      "ITEMDESC": itemdesc || "",
      "ORDERQTY": orderqty || 0,
      "BOX PACK": 0,
      "PACK": 0,
      "DVN": dvn || ""
    };
  });

  return {
    meta: { customerName },
    headers: TEMPLATE_COLUMNS,
    dataRows: templateRows,
    extractedFields: createExtractedFieldsMetadata(templateRows)
  };
}

function createExtractedFieldsMetadata(dataRows) {
  if (!dataRows.length) return [];

  const sample = dataRows[0];

  return [
    {
      id: "code",
      fieldName: "Code",
      sampleValue: sample["CODE"] || "",
      autoMapped: "CODE",
      confidence: "high"
    },
    {
      id: "customer",
      fieldName: "Customer Name",
      sampleValue: sample["CUSTOMER NAME"] || "",
      autoMapped: "CUSTOMER NAME",
      confidence: "high"
    },
    {
      id: "sapcode",
      fieldName: "SAP Code",
      sampleValue: sample["SAPCODE"] || "",
      autoMapped: "SAPCODE",
      confidence: sample["SAPCODE"] ? "high" : "medium"
    },
    {
      id: "itemdesc",
      fieldName: "Item Description",
      sampleValue: sample["ITEMDESC"] || "",
      autoMapped: "ITEMDESC",
      confidence: "high"
    },
    {
      id: "orderqty",
      fieldName: "Order Quantity",
      sampleValue: String(sample["ORDERQTY"] || 0),
      autoMapped: "ORDERQTY",
      confidence: "high"
    },
    {
      id: "boxpack",
      fieldName: "Box Pack",
      sampleValue: String(sample["BOX PACK"] || 0),
      autoMapped: "BOX PACK",
      confidence: "medium"
    },
    {
      id: "pack",
      fieldName: "Pack",
      sampleValue: String(sample["PACK"] || 0),
      autoMapped: "PACK",
      confidence: "medium"
    },
    {
      id: "dvn",
      fieldName: "Division",
      sampleValue: sample["DVN"] || "",
      autoMapped: "DVN",
      confidence: "medium"
    }
  ];
}

function createEmptyResult(error = null) {
  return {
    meta: { customerName: "UNKNOWN CUSTOMER" },
    headers: TEMPLATE_COLUMNS,
    dataRows: [],
    extractedFields: [],
    error
  };
}

/* ========================================================================
   UNIFIED ENTRY POINT
======================================================================== */

export async function unifiedExtract(file) {
  if (!file?.buffer) return createEmptyResult("EMPTY_FILE");

  const name = (file.originalname || "").toLowerCase();

  if (name.endsWith(".pdf")) return extractPurchaseOrderPDF(file);
  if (name.endsWith(".xls") || name.endsWith(".xlsx")) return extractInvoiceExcel(file);
  if (name.endsWith(".txt")) return extractOrderText(file);

  return createEmptyResult("UNSUPPORTED_FORMAT");
}