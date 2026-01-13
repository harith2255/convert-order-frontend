/**
 * PRODUCTION-GRADE PHARMACEUTICAL PARSER V3
 * Extracts to exact template: Code, Customer Name, SapCode, ItemDesc, OrderQty, Box, Pack, DVN
 * Features: Pack size extraction, Box calculation, multi-layout support
 */

import { extractTextFromPDFAdvanced } from "./pdfParser.js";
import { normalizeKey } from "../utils/normalizeKey.js";
import XLSX from "xlsx";

/* ========================================================================
   CONSTANTS & PATTERNS
======================================================================== */

const TEMPLATE_COLUMNS = [
  "CODE", "CUSTOMER NAME", "SAPCODE", "ITEMDESC",
  "ORDERQTY", "BOX PACK", "PACK", "DVN"
];

const QTY_LIMITS = { MIN: 1, MAX: 10000 };

// SAP Code patterns - pharmaceutical codes (e.g., FTINA0939, TCINA0003)
const SAPCODE_PATTERNS = [
  /^[A-Z]{4,6}\d{4}$/i,        // FTINA0939, TCINA0003
  /^\d{4,7}$/,                  // Pure numeric 4-7 digits
  /^[A-Z]\d{4,6}$/i             // A12345
];

// Pack size patterns in descriptions
const PACK_PATTERNS = [
  /\((\d+)['"`\s]*s\)/gi,                    // (30'S), (15`S)
  /\b(\d+)['"`\s]*s\b/gi,                    // 15's, 30's
  /\b(\d+)\s*tablets?\b/gi,                  // 10 TABLETS
  /\b(\d+)\s*tabs?\b/gi,                     // 25 TABS
  /\b(\d+)\s*capsules?\b/gi,                 // 10 CAPSULES
  /\b(\d+)\s*caps?\b/gi,                     // 10 CAPS
  /\/(\d+)\b/g,                              // 5/25 (second number)
  /\b(\d+)\s*ml\b/gi,                        // 100 ML
  /\b(\d+)\s*gm?\b/gi                        // 50 GM
];

// Banned keywords
const BANNED_KEYWORDS = [
  "TOTAL", "SUBTOTAL", "GRAND TOTAL", "NET VALUE", "GROSS VALUE",
  "PAGE", "INVOICE", "CONTINUED", "NOTE", "REMARKS", "AUTHORISED",
  "SIGNATORY", "POWERED BY", "AMOUNT", "TAXABLE", "GSTIN", "SUMMARY",
  "DISCOUNT", "FREIGHT", "TAX", "CGST", "SGST", "IGST", "E&OE"
];

// City blocklist
const CITY_BLOCKLIST = [
  "ERNAKULAM", "KOZHIKODE", "THRISSUR", "TRIVANDRUM", "KANNUR",
  "WAYANAD", "PALAKKAD", "MALAPPURAM", "IDUKKI", "KOTTAYAM",
  "ALAPPUZHA", "KOLLAM", "PATHANAMTHITTA", "KASARAGOD", "COCHIN",
  "CALICUT", "TRICHUR", "DELHI", "MUMBAI", "BANGALORE", "CHENNAI",
  "HYDERABAD", "PUNE", "KOLKATA", "AHMEDABAD", "JAIPUR"
];

// Table stop patterns
const TABLE_STOP_PATTERNS = [
  /^(grand\s*total|net\s*total|gross\s*total|total\s*order)/i,
  /^(sub\s*total|page\s*total|continued)/i,
  /^(total\s*amount|total\s*value|net\s*amount)/i,
  /^(approx\s*value|despatch|delivery|remarks|note)/i,
  /^(authorised\s*signatory|terms\s*and\s*conditions)/i,
  /^(powered\s*by|generated\s*by|page\s*\d+)/i,
  /^(e\s*&\s*o\s*e|subject\s*to)/i
];

/* ========================================================================
   UTILITY LAYER
======================================================================== */

function clean(text = "") {
  return String(text).replace(/\s+/g, " ").trim();
}

function cleanDVN(text = "") {
  return clean(text)
    .replace(/\[\s*approx\s*value\s*:[^\]]+\]/gi, "")
    .replace(/division\s*[:\-]\s*/gi, "")
    .replace(/company\s*[:\-]\s*/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .toUpperCase();
}

function validateQty(value) {
  if (value === null || value === undefined) return 0;

  const raw = String(value).toLowerCase()
    .replace(/free|bonus|sch/gi, "");

  const match = raw.match(/\d+/);
  if (!match) return 0;

  const n = parseInt(match[0], 10);
  return (n >= QTY_LIMITS.MIN && n <= QTY_LIMITS.MAX) ? n : 0;
}

/**
 * Extract pack size from item description
 * Returns: number or 0
 */
function extractPackSize(itemDesc) {
  if (!itemDesc) return 0;

  const matches = [];

  // Try all patterns
  for (const pattern of PACK_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    
    while ((match = regex.exec(itemDesc)) !== null) {
      const num = parseInt(match[1], 10);
      if (num > 0 && num <= 1000) {  // Reasonable pack size
        matches.push(num);
      }
    }
  }

  if (matches.length === 0) return 0;

  // Return the most common pack size (or first if all unique)
  const counts = {};
  matches.forEach(m => counts[m] = (counts[m] || 0) + 1);
  
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return parseInt(sorted[0][0], 10);
}

/**
 * Calculate BOX PACK from OrderQty and Pack
 * Formula: BOX PACK = OrderQty / Pack (rounded down)
 */
function calculateBoxPack(orderQty, pack) {
  if (!orderQty || !pack || pack === 0) return 0;
  return Math.floor(orderQty / pack);
}

/**
 * Clean item description (remove pack info that's extracted separately)
 */
function cleanItemDesc(text) {
  let cleaned = clean(text)
    .replace(/\[approx\s*value\s*:.*?\]/gi, "")
    .replace(/\*\d+/g, "")
    .replace(/\+\d+\s*(free|bonus)/gi, "")
    .replace(/^[\s*]+|[\s*]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .toUpperCase();

  return cleaned;
}

function cleanCustomerName(text) {
  return clean(text)
    .replace(/\d{2}\/\d{2}\/\d{4}/g, "")
    .replace(/(address|gstin|gst|pan|dl\s*no|mob|mobile|email|phone|fssai|tin)[\s:].*/gi, "")
    .replace(/[,;:]+$/, "")
    .trim()
    .toUpperCase();
}

/* ========================================================================
   CONTEXT ANALYSIS
======================================================================== */

function extractCustomerName(lines) {
  const patterns = [
    /(?:supplier|party\s*name|buyer|customer|bill\s*to|ship\s*to)\s*[:\-]\s*(.+)/i,
    /^([A-Z][A-Z\s&.]+(?:ENTERPRISES|AGENCIES|DISTRIBUTORS|PHARMA|HEALTHCARE|MEDICALS?|LTD|PVT|LIMITED|INC|CORPORATION))/i,
  ];

  for (let i = 0; i < Math.min(lines.length, 40); i++) {
    const line = clean(lines[i]);
    
    if (/^(gstin|gst|pan|dl|mob|email|phone|address|fssai|tin)/i.test(line)) continue;
    
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

/**
 * Analyze if line is a division marker
 */
function analyzeDivisionLine(line) {
  const cleaned = clean(line);
  const upper = cleaned.toUpperCase();

  // 1. Explicit markers
  if (/^(division|company|branch)\s*[:\-]\s*/i.test(cleaned)) {
    return {
      isDivision: true,
      dvnText: cleanDVN(cleaned.replace(/^(division|company|branch)\s*[:\-]\s*/i, ""))
    };
  }

  // 2. Reject cities (unless in context)
  if (CITY_BLOCKLIST.some(city => upper === city)) {
    return { isDivision: false, dvnText: "" };
  }

  // 3. Reject business entities without explicit division marker
  if (/DISTRIBUTORS|AGENCIES|ENTERPRISES|TRADERS|PHARMA|HEALTHCARE|MEDICALS?|LTD|PVT|LIMITED/i.test(cleaned)) {
    if (!/^(division|company|branch)/i.test(cleaned)) {
      return { isDivision: false, dvnText: "" };
    }
  }

  // 4. Reject table keywords
  if (/TOTAL|ORDER|PURCHASE|INVOICE|SUMMARY|ABSTRACT/i.test(cleaned)) {
    return { isDivision: false, dvnText: "" };
  }

  // 5. Short uppercase codes (CAR1, KER1, etc.)
  if (/^[A-Z]{2,6}\d{0,2}$/.test(cleaned) && cleaned.length >= 3 && cleaned.length <= 8) {
    return { isDivision: true, dvnText: cleanDVN(cleaned) };
  }

  // 6. Uppercase text without numbers or prices
  if (/^[A-Z][A-Z\s\-()\.]{4,50}$/.test(cleaned)) {
    const tokens = cleaned.split(/\s+/);
    const hasNumbers = tokens.some(t => /^\d+$/.test(t));
    const hasPrice = tokens.some(t => /^\d+\.\d{2}$/.test(t));
    
    if (!hasNumbers && !hasPrice) {
      return { isDivision: true, dvnText: cleanDVN(cleaned) };
    }
  }

  return { isDivision: false, dvnText: "" };
}

function isTableStopLine(line) {
  return TABLE_STOP_PATTERNS.some(pattern => pattern.test(line));
}

/* ========================================================================
   SAPCODE DETECTION
======================================================================== */

function isSAPCode(token) {
  if (!token || token.length < 4) return false;
  
  // Check against patterns
  return SAPCODE_PATTERNS.some(pattern => pattern.test(token));
}

function extractSAPCode(tokens, excludeIndices = []) {
  for (let i = 0; i < tokens.length; i++) {
    if (excludeIndices.includes(i)) continue;
    
    const token = tokens[i];
    
    if (isSAPCode(token)) {
      // Additional validation: not a dosage or year
      const num = parseInt(token, 10);
      if (!isNaN(num)) {
        // Skip common dosages
        if ([5, 10, 20, 25, 50, 100, 250, 500, 650, 1000].includes(num)) continue;
        // Skip years
        if (num >= 2000 && num <= 2100) continue;
      }
      
      return { index: i, code: token.toUpperCase() };
    }
  }
  
  return { index: -1, code: "" };
}

/* ========================================================================
   SEMANTIC ROW EXTRACTION
======================================================================== */

function tokenizeLine(line) {
  return line.split(/\s+/).filter(t => t.length > 0);
}

/**
 * Parse row with pharmaceutical-specific logic
 */
function parsePharmaceuticalRow(line, lineIndex = 0) {
  const cleanLine = clean(line);
  if (!cleanLine || cleanLine.length < 5) return null;

  // Stop at table end
  if (isTableStopLine(cleanLine)) return null;

  const tokens = tokenizeLine(cleanLine);
  if (tokens.length < 2) return null;

  const result = {
    sapcode: "",
    itemdesc: "",
    orderqty: 0,
    pack: 0,
    boxpack: 0
  };

  // 1. Detect serial number
  let startIdx = 0;
  if (/^\d{1,3}$/.test(tokens[0]) && tokens.length > 3) {
    startIdx = 1;
  }

  // 2. Extract SAP code
  const sapResult = extractSAPCode(tokens.slice(startIdx), []);
  if (sapResult.index !== -1) {
    result.sapcode = sapResult.code;
    startIdx = startIdx + sapResult.index + 1;
  }

  // 3. Find quantity (rightmost valid integer)
  let qtyIdx = -1;
  for (let i = tokens.length - 1; i >= startIdx; i--) {
    const token = tokens[i];
    
    // Skip prices
    if (token.includes(".")) continue;
    
    // Skip non-numeric
    if (!/^\d+$/.test(token)) continue;
    
    // Skip bonus/free
    if (i > 0 && /^(free|bonus|sch)$/i.test(tokens[i - 1])) continue;
    
    const qty = validateQty(token);
    if (qty > 0) {
      result.orderqty = qty;
      qtyIdx = i;
      break;
    }
  }

  if (result.orderqty === 0) return null;

  // 4. Extract description (between start and qty)
  let endIdx = qtyIdx !== -1 ? qtyIdx : tokens.length;
  
  // Refine end index (stop at prices)
  for (let i = startIdx; i < endIdx; i++) {
    if (tokens[i].includes(".") && /\d/.test(tokens[i])) {
      endIdx = i;
      break;
    }
  }

  if (endIdx > startIdx) {
    const descTokens = tokens.slice(startIdx, endIdx);
    result.itemdesc = cleanItemDesc(descTokens.join(" "));
  }

  // 5. Extract pack size from description
  result.pack = extractPackSize(result.itemdesc);

  // 6. Calculate box pack
  if (result.pack > 0 && result.orderqty > 0) {
    result.boxpack = calculateBoxPack(result.orderqty, result.pack);
  }

  // Validation
  if (!isValidExtraction(result)) return null;

  return result;
}

function isValidExtraction(result) {
  if (!result.itemdesc || result.itemdesc.length < 3) return false;
  if (!result.orderqty || result.orderqty <= 0) return false;

  const upperDesc = result.itemdesc.toUpperCase();
  
  // Check banned keywords
  if (BANNED_KEYWORDS.some(kw => upperDesc.includes(kw))) return false;

  // Reject pure numbers
  if (/^\d+$/.test(result.itemdesc)) return false;

  // Reject city names
  if (CITY_BLOCKLIST.some(city => upperDesc === city)) return false;

  return true;
}

/* ========================================================================
   PDF HANDLER
======================================================================== */

export async function extractPurchaseOrderPDF(file) {
  try {
    const { lines } = await extractTextFromPDFAdvanced(file.buffer);
    const customerName = extractCustomerName(lines);
    const dataRows = [];

    let currentDVN = "";
    let tableStarted = false;

    console.log(`📄 PDF: Processing ${lines.length} lines...`);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const cleanLine = clean(line);

      if (!cleanLine) continue;

      // Table header detection - must be a real header, not a data row
      if (!tableStarted) {
        const hasItemHeader = /item|product|desc|particular|material/i.test(cleanLine);
        const hasQtyHeader = /qty|quantity|order|bil/i.test(cleanLine);
        
        // Only treat as header if it's ACTUALLY a header row (no SAP codes or quantities)
        if (hasItemHeader && hasQtyHeader) {
          const tokens = tokenizeLine(cleanLine);
          const hasSAPCode = tokens.some(t => isSAPCode(t));
          const hasValidQty = tokens.some(t => /^\d+$/.test(t) && validateQty(t) > 0);
          
          // If it has SAP code or quantity, it's a data row, not a header
          if (!hasSAPCode && !hasValidQty) {
            tableStarted = true;
            console.log(`✓ Table header at line ${i + 1}`);
            continue;
          } else {
            // This is actually a data row, start processing
            tableStarted = true;
          }
        }
      }

      // Table stop
      if (isTableStopLine(cleanLine)) {
        console.log(`✓ Table end at line ${i + 1}`);
        break;
      }

      // Division detection
      const divCheck = analyzeDivisionLine(cleanLine);
      if (divCheck.isDivision) {
        currentDVN = divCheck.dvnText;
        console.log(`✓ Division: ${currentDVN}`);
        continue;
      }

      // Parse row
      const row = parsePharmaceuticalRow(cleanLine, i);
      if (row) {
        console.log(`✓ Row ${i + 1}: ${row.itemdesc} - Qty: ${row.orderqty}`);
        dataRows.push([
          "",                    // CODE (empty)
          customerName,          // CUSTOMER NAME
          row.sapcode,          // SAPCODE
          row.itemdesc,         // ITEMDESC
          row.orderqty,         // ORDERQTY
          row.boxpack,          // BOX PACK
          row.pack,             // PACK
          currentDVN            // DVN
        ]);
      }
    }

    console.log(`✅ PDF: Extracted ${dataRows.length} rows`);
    return createTemplateOutput(dataRows, customerName);

  } catch (err) {
    console.error("❌ PDF extraction failed:", err);
    return createEmptyResult("PDF_EXTRACTION_FAILED");
  }
}

/* ========================================================================
   EXCEL HANDLER
======================================================================== */

export async function extractInvoiceExcel(file) {
  try {
    const workbook = XLSX.read(file.buffer, { type: "buffer", cellText: false });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

    if (!rows.length) return createEmptyResult("EMPTY_FILE");

    console.log(`📊 Excel: Processing ${rows.length} rows...`);

    const topText = rows.slice(0, 10).map(r => r.join(" ")).join("\n");
    const customerName = extractCustomerName(topText.split("\n"));

    // Find header - enhanced validation
    let headerIdx = -1;
    let colMap = { item: -1, qty: -1, sap: -1, pack: -1, box: -1 };

    for (let i = 0; i < Math.min(rows.length, 50); i++) {
      const row = rows[i].map(c => normalizeKey(String(c)));

      // Skip invoice header rows
      if (row.some(c => c.includes("invoice") || c.includes("credit") || c.includes("nomfr"))) {
        continue;
      }

      const descIdx = row.findIndex(c =>
        (c.includes("item") || c.includes("product") || c.includes("desc") ||
         c.includes("particular") || c.includes("material") || c === "itemname") &&
        !c.includes("total")
      );

      const qtyIdx = row.findIndex(c =>
        (c.includes("qty") || c.includes("quantity") || c.includes("order")) &&
        !c.includes("free") && !c.includes("sch")
      );

      if (descIdx !== -1 && qtyIdx !== -1) {
        // Verify this is actually a header row, not a data row
        const originalRow = rows[i];
        const hasSAPCode = originalRow.some(cell => {
          const str = String(cell || "");
          return isSAPCode(str);
        });
        const hasValidQty = originalRow.some(cell => validateQty(cell) > 0);
        
        // If it has data, it's not a header - skip to next
        if (hasSAPCode || hasValidQty) {
          continue;
        }
        
        headerIdx = i;
        colMap.item = descIdx;
        colMap.qty = qtyIdx;
        colMap.sap = row.findIndex(c => c.includes("sap") || c.includes("code") || c.includes("mat"));
        colMap.pack = row.findIndex(c => c.includes("pack") && !c.includes("box"));
        colMap.box = row.findIndex(c => c.includes("box"));
        console.log(`✓ Header at row ${i + 1}`);
        break;
      }
    }

    const dataRows = [];
    let currentDVN = "";
    
    // Smart start: If header found, start after it; otherwise start from row 0
    const startRow = headerIdx !== -1 ? headerIdx + 1 : 0;
    
    console.log(`📊 Excel: Starting data extraction from row ${startRow + 1}...`);

    for (let i = startRow; i < rows.length; i++) {
      const row = rows[i];

      // Division check
      const filledCells = row.filter(c => c && String(c).trim());
      if (filledCells.length === 1) {
        const cellVal = String(filledCells[0]).trim();
        const divCheck = analyzeDivisionLine(cellVal);
        if (divCheck.isDivision) {
          currentDVN = divCheck.dvnText;
          continue;
        }
      }

      // Stop check
      const lineText = row.join(" ");
      if (isTableStopLine(lineText)) break;

      // Extract data
      let sapcode = "";
      let itemdesc = "";
      let orderqty = 0;
      let pack = 0;
      let boxpack = 0;

      // Column mapping strategy
      if (headerIdx !== -1) {
        itemdesc = cleanItemDesc(String(row[colMap.item] || ""));
        orderqty = validateQty(row[colMap.qty]);
        
        if (colMap.sap !== -1) {
          sapcode = String(row[colMap.sap] || "").toUpperCase();
        }
        
        if (colMap.pack !== -1) {
          pack = validateQty(row[colMap.pack]);
        }
        
        if (colMap.box !== -1) {
          boxpack = validateQty(row[colMap.box]);
        }

        // Extract pack from description if not in column
        if (pack === 0 && itemdesc) {
          pack = extractPackSize(itemdesc);
        }

        // Calculate box pack if not provided
        if (boxpack === 0 && pack > 0 && orderqty > 0) {
          boxpack = calculateBoxPack(orderqty, pack);
        }

        if (itemdesc && orderqty > 0) {
          dataRows.push([
            "",
            customerName,
            sapcode,
            itemdesc,
            orderqty,
            boxpack,
            pack,
            currentDVN
          ]);
          continue;
        }
      }

      // Fallback: semantic parsing
      const parsed = parsePharmaceuticalRow(lineText, i);
      if (parsed) {
        dataRows.push([
          "",
          customerName,
          parsed.sapcode,
          parsed.itemdesc,
          parsed.orderqty,
          parsed.boxpack,
          parsed.pack,
          currentDVN
        ]);
      }
    }

    console.log(`✅ Excel: Extracted ${dataRows.length} rows`);
    return createTemplateOutput(dataRows, customerName);

  } catch (err) {
    console.error("❌ Excel extraction failed:", err);
    return createEmptyResult("EXCEL_EXTRACTION_FAILED");
  }
}

/* ========================================================================
   TEXT HANDLER
======================================================================== */

export async function extractOrderText(file) {
  try {
    const text = file.buffer.toString("utf8");
    const lines = text.split(/\r?\n/);
    const customerName = extractCustomerName(lines);

    console.log(`📝 Text: Processing ${lines.length} lines...`);

    const dataRows = [];
    let currentDVN = "";
    let tableStarted = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const cleanLine = clean(line);
      
      if (!cleanLine) continue;

      // Table header - must not contain actual data
      if (!tableStarted) {
        const hasItemHeader = /item|product|desc/i.test(cleanLine);
        const hasQtyHeader = /qty|quantity|order/i.test(cleanLine);
        
        if (hasItemHeader && hasQtyHeader) {
          const tokens = tokenizeLine(cleanLine);
          const hasSAPCode = tokens.some(t => isSAPCode(t));
          const hasValidQty = tokens.some(t => /^\d+$/.test(t) && validateQty(t) > 0);
          
          // Only skip if it's truly a header (no data)
          if (!hasSAPCode && !hasValidQty) {
            tableStarted = true;
            console.log(`✓ Header at line ${i + 1}`);
            continue;
          } else {
            // Data row detected, start processing
            tableStarted = true;
          }
        }
      }

      // Table stop
      if (isTableStopLine(cleanLine)) break;

      // Division
      const divCheck = analyzeDivisionLine(cleanLine);
      if (divCheck.isDivision) {
        currentDVN = divCheck.dvnText;
        continue;
      }

      // Parse row
      const row = parsePharmaceuticalRow(cleanLine, i);
      if (row) {
        dataRows.push([
          "",
          customerName,
          row.sapcode,
          row.itemdesc,
          row.orderqty,
          row.boxpack,
          row.pack,
          currentDVN
        ]);
      }
    }

    console.log(`✅ Text: Extracted ${dataRows.length} rows`);
    return createTemplateOutput(dataRows, customerName);

  } catch (err) {
    console.error("❌ Text extraction failed:", err);
    return createEmptyResult("TXT_EXTRACTION_FAILED");
  }
}

/* ========================================================================
   OUTPUT GENERATOR
======================================================================== */

function createTemplateOutput(dataRows, customerName) {
  const templateRows = dataRows.map(row => {
    const [code, customer, sapcode, itemdesc, orderqty, boxpack, pack, dvn] = row;

    return {
      "CODE": code || "",
      "CUSTOMER NAME": customer || customerName,
      "SAPCODE": sapcode || "",
      "ITEMDESC": itemdesc || "",
      "ORDERQTY": orderqty || 0,
      "BOX PACK": boxpack || 0,
      "PACK": pack || 0,
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
  
  return Object.keys(sample).map(key => ({
    id: key.toLowerCase().replace(/\s+/g, "_"),
    fieldName: key,
    sampleValue: String(sample[key] || ""),
    autoMapped: key,
    confidence: ["ITEMDESC", "ORDERQTY"].includes(key) ? "high" : "medium"
  }));
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
   MAIN ENTRY POINT
======================================================================== */

export async function unifiedExtract(file) {
  if (!file?.buffer) return createEmptyResult("EMPTY_FILE");

  const name = (file.originalname || "").toLowerCase();

  if (name.endsWith(".pdf")) return extractPurchaseOrderPDF(file);
  if (name.endsWith(".xls") || name.endsWith(".xlsx")) return extractInvoiceExcel(file);
  if (name.endsWith(".txt")) return extractOrderText(file);

  return createEmptyResult("UNSUPPORTED_FORMAT");
}