/**
 * PRODUCTION CONTROLLER V3 - Enhanced BOX PACK & PACK Handling
 * Accurate calculations matching pharmaceutical template requirements
 */

import OrderUpload from "../models/orderUpload.js";
import XLSX from "xlsx";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import MasterOrder from "../models/masterOrder.js";
import { unifiedExtract } from "../services/unifiedParser.js";

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

/* ========================================================================
   HELPER FUNCTIONS
======================================================================== */

/**
 * Extract pack size from item description if not already provided
 */
function extractPackFromDescription(itemDesc) {
  if (!itemDesc) return 0;

  const patterns = [
    /\((\d+)['"`\s]*s\)/gi,       // (30'S)
    /\b(\d+)['"`\s]*s\b/gi,       // 15's
    /\b(\d+)\s*tabs?\b/gi,        // 25 TABS
    /\b(\d+)\s*tablets?\b/gi,     // 10 TABLETS
    /\b(\d+)\s*caps?\b/gi,        // 10 CAPS
    /\b(\d+)\s*capsules?\b/gi,    // 10 CAPSULES
    /\/(\d+)\b/g,                 // 5/25 (second number)
  ];

  const matches = [];
  
  for (const pattern of patterns) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    
    while ((match = regex.exec(itemDesc)) !== null) {
      const num = parseInt(match[1], 10);
      if (num > 0 && num <= 1000) {
        matches.push(num);
      }
    }
  }

  if (matches.length === 0) return 0;

  // Return most common value
  const counts = {};
  matches.forEach(m => counts[m] = (counts[m] || 0) + 1);
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  
  return parseInt(sorted[0][0], 10);
}

/**
 * Calculate BOX PACK from ORDERQTY and PACK
 */
function calculateBoxPack(orderQty, pack) {
  if (!orderQty || !pack || pack === 0) return 0;
  return Math.floor(orderQty / pack);
}

/**
 * Validate and enrich a single row
 */
function validateAndEnrichRow(row, rowIndex) {
  const errors = [];
  const warnings = [];

  // 1. Validate ITEMDESC (required)
  if (!row["ITEMDESC"] || row["ITEMDESC"].length < 2) {
    errors.push({
      rowNumber: rowIndex + 2,
      field: "ITEMDESC",
      error: "Missing or invalid item description"
    });
    return { row, errors, warnings };
  }

  // 2. Validate ORDERQTY (required)
  const orderQty = Number(row["ORDERQTY"]);
  if (!orderQty || orderQty <= 0 || orderQty > 10000) {
    errors.push({
      rowNumber: rowIndex + 2,
      field: "ORDERQTY",
      error: "Invalid quantity (must be 1-10000)"
    });
    return { row, errors, warnings };
  }

  // 3. Extract PACK if missing
  let pack = Number(row["PACK"]) || 0;
  if (pack === 0) {
    pack = extractPackFromDescription(row["ITEMDESC"]);
    if (pack > 0) {
      row["PACK"] = pack;
      warnings.push({
        rowNumber: rowIndex + 2,
        field: "PACK",
        warning: `Auto-extracted pack size: ${pack}`,
        newValue: pack
      });
    }
  }

  // 4. Calculate BOX PACK if missing or zero
  let boxPack = Number(row["BOX PACK"]) || 0;
  if (boxPack === 0 && pack > 0 && orderQty > 0) {
    boxPack = calculateBoxPack(orderQty, pack);
    if (boxPack > 0) {
      row["BOX PACK"] = boxPack;
      warnings.push({
        rowNumber: rowIndex + 2,
        field: "BOX PACK",
        warning: `Auto-calculated: ${boxPack} (${orderQty} ÷ ${pack})`,
        newValue: boxPack
      });
    }
  }

  // 5. Validate BOX PACK calculation
  if (pack > 0 && orderQty > 0) {
    const expectedBox = calculateBoxPack(orderQty, pack);
    if (boxPack !== expectedBox && expectedBox > 0) {
      warnings.push({
        rowNumber: rowIndex + 2,
        field: "BOX PACK",
        warning: `BOX PACK mismatch: Expected ${expectedBox}, got ${boxPack}. Auto-correcting.`,
        newValue: expectedBox
      });
      row["BOX PACK"] = expectedBox;
    }
  }

  return { row, errors, warnings };
}

/* ========================================================================
   EXTRACT ENDPOINT
======================================================================== */

export const extractOrderFields = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No files uploaded"
      });
    }

    const file = req.file;

    console.log("📦 Processing file:", {
      name: file.originalname,
      type: file.mimetype,
      size: file.size
    });

    const fileHash = crypto
      .createHash("sha256")
      .update(file.buffer)
      .digest("hex");

    // Extract using unified parser
    let extractionResult;
    try {
      extractionResult = await unifiedExtract(file);
    } catch (parseError) {
      console.error("❌ Parser error:", parseError);
      return res.status(422).json({
        success: false,
        code: "PARSER_ERROR",
        message: "Failed to parse file. Please ensure it's a valid Excel/PDF/Text file.",
        extractedFields: []
      });
    }

    if (!extractionResult) {
      return res.status(400).json({
        success: false,
        code: "UNSUPPORTED_FORMAT",
        message: "Unsupported file format.",
        extractedFields: []
      });
    }

    if (extractionResult.error) {
      const errorMessages = {
        "TABLE_HEADER_NOT_FOUND": "Could not find table headers in the file.",
        "NO_DATA_ROWS": "No data rows found.",
        "EMPTY_FILE": "The file is empty or corrupted.",
        "PDF_EXTRACTION_FAILED": "Failed to extract text from PDF.",
        "EXCEL_EXTRACTION_FAILED": "Failed to read Excel file.",
        "TXT_EXTRACTION_FAILED": "Failed to read text file."
      };

      return res.status(422).json({
        success: false,
        code: extractionResult.error,
        message: errorMessages[extractionResult.error] || "Extraction failed",
        extractedFields: []
      });
    }

    if (!Array.isArray(extractionResult.dataRows) ||
        extractionResult.dataRows.length === 0) {
      return res.status(422).json({
        success: false,
        code: "NO_EXTRACTABLE_FIELDS",
        message: "No data rows could be extracted.",
        extractedFields: []
      });
    }

    // Find or create upload record
    let upload = await OrderUpload.findOne({
      fileHash,
      userId: req.user.id
    });

    if (!upload) {
      upload = await OrderUpload.create({
        userId: req.user.id,
        userEmail: req.user.email,
        fileName: file.originalname,
        fileType: file.mimetype,
        fileHash,
        status: "EXTRACTED",
        extractedData: extractionResult
      });
    } else {
      upload.status = "EXTRACTED";
      upload.extractedData = extractionResult;
      upload.recordsProcessed = 0;
      upload.recordsFailed = 0;
      upload.outputFile = null;
      await upload.save();
    }

    console.log("✅ Extraction successful:", {
      uploadId: upload._id,
      rows: extractionResult.dataRows.length
    });

    res.json({
      success: true,
      uploadId: upload._id,
      extractedFields: extractionResult.extractedFields,
      dataRows: extractionResult.dataRows,
      rowCount: extractionResult.dataRows.length
    });

  } catch (err) {
    console.error("❌ Extraction error:", err);
    next(err);
  }
};

/* ========================================================================
   CONVERT ENDPOINT
======================================================================== */

export const convertOrders = async (req, res, next) => {
  const { uploadId, editedRows } = req.body;
  const startTime = Date.now();

  try {
    if (!uploadId) {
      return res.status(400).json({
        success: false,
        message: "uploadId is required"
      });
    }

    const upload = await OrderUpload.findOne({
      _id: uploadId,
      userId: req.user.id
    });

    if (!upload) {
      return res.status(404).json({
        success: false,
        message: "Upload not found"
      });
    }

    if (upload.status === "CONVERTED") {
      upload.status = "EXTRACTED";
    }

    const { meta } = upload.extractedData;
    const dataRows = Array.isArray(editedRows) && editedRows.length > 0
      ? editedRows
      : upload.extractedData.dataRows;

    console.log("🔄 Conversion started:", {
      uploadId,
      rowCount: dataRows.length
    });

    const outputRows = [];
    const rowErrors = [];
    const rowWarnings = [];

    // Process each row
    dataRows.forEach((row, rowIndex) => {
      const { row: enrichedRow, errors, warnings } = validateAndEnrichRow(row, rowIndex);

      if (errors.length > 0) {
        rowErrors.push(...errors);
        return;
      }

      if (warnings.length > 0) {
        rowWarnings.push(...warnings);
      }

      // Add to output
      outputRows.push({
        "CODE": enrichedRow["CODE"] || "",
        "CUSTOMER NAME": enrichedRow["CUSTOMER NAME"] || meta.customerName || "UNKNOWN CUSTOMER",
        "SAPCODE": enrichedRow["SAPCODE"] || "",
        "ITEMDESC": enrichedRow["ITEMDESC"],
        "ORDERQTY": Number(enrichedRow["ORDERQTY"]),
        "BOX PACK": Number(enrichedRow["BOX PACK"]) || 0,
        "PACK": Number(enrichedRow["PACK"]) || 0,
        "DVN": enrichedRow["DVN"] || ""
      });
    });

    console.log("📊 Conversion Summary:", {
      totalRows: dataRows.length,
      successfulRows: outputRows.length,
      failedRows: rowErrors.length,
      warnings: rowWarnings.length
    });

    if (!outputRows.length) {
      return res.status(400).json({
        success: false,
        message: "No valid rows after conversion",
        errors: rowErrors
      });
    }

    // Create Excel workbook
    const workbook = XLSX.utils.book_new();

    const excelRows = outputRows.map(row => [
      row["CODE"],
      row["CUSTOMER NAME"],
      row["SAPCODE"],
      row["ITEMDESC"],
      row["ORDERQTY"],
      row["BOX PACK"],
      row["PACK"],
      row["DVN"]
    ]);

    const sheet = XLSX.utils.aoa_to_sheet([
      TEMPLATE_COLUMNS,
      ...excelRows
    ]);

    styleSheet(sheet, excelRows.length);

    XLSX.utils.book_append_sheet(workbook, sheet, "Order Training");

    // Save file
    fs.mkdirSync("uploads", { recursive: true });
    const fileName = `order-${upload._id}-${Date.now()}.xlsx`;
    const outputPath = path.join("uploads", fileName);
    XLSX.writeFile(workbook, outputPath);

    // Update upload record
    upload.status = "CONVERTED";
    upload.recordsProcessed = outputRows.length;
    upload.recordsFailed = rowErrors.length;
    upload.outputFile = fileName;
    upload.convertedData = {
      headers: TEMPLATE_COLUMNS,
      rows: outputRows
    };
    upload.rowErrors = rowErrors;
    upload.rowWarnings = rowWarnings;
    upload.processingTimeMs = Date.now() - startTime;

    await upload.save();

    console.log("✅ Conversion completed successfully");

    // Update master database
    const dedupedMap = new Map();

    for (const row of outputRows) {
      const key = `${String(row["CUSTOMER NAME"]).toLowerCase().trim()}||${String(row["ITEMDESC"]).toLowerCase().trim()}`;

      if (!dedupedMap.has(key)) {
        dedupedMap.set(key, { ...row });
      } else {
        const existing = dedupedMap.get(key);
        existing.ORDERQTY += row["ORDERQTY"];
        
        // Recalculate BOX PACK after summing quantities
        if (existing.PACK > 0) {
          existing["BOX PACK"] = calculateBoxPack(existing.ORDERQTY, existing.PACK);
        }
      }
    }

    const dedupedRows = Array.from(dedupedMap.values());

    console.log(`📝 Updating master database with ${dedupedRows.length} deduplicated rows...`);

    let masterUpdates = 0;
    let masterErrors = 0;

    for (const row of dedupedRows) {
      const customerName = String(row["CUSTOMER NAME"] || "").trim();
      const itemdesc = String(row["ITEMDESC"] || "").trim();

      if (!customerName || !itemdesc) continue;

      try {
        const existing = await MasterOrder.findOne({ customerName, itemdesc });

        if (existing) {
          const newQty = existing.orderqty + row["ORDERQTY"];
          const newBoxPack = row["PACK"] > 0 ? calculateBoxPack(newQty, row["PACK"]) : existing.boxPack;

          await MasterOrder.updateOne(
            { _id: existing._id },
            {
              $inc: { uploadCount: 1 },
              $addToSet: { sourceUploads: upload._id },
              $set: {
                orderqty: newQty,
                boxPack: newBoxPack,
                pack: row["PACK"] || existing.pack,
                lastUploadId: upload._id,
                lastUpdatedAt: new Date()
              }
            }
          );
        } else {
          await MasterOrder.create({
            customerName,
            itemdesc,
            code: row["CODE"] || "",
            sapcode: row["SAPCODE"] || "",
            dvn: row["DVN"] || "",
            pack: row["PACK"] || 0,
            boxPack: row["BOX PACK"] || 0,
            orderqty: row["ORDERQTY"],
            uploadCount: 1,
            sourceUploads: [upload._id],
            lastUploadId: upload._id,
            lastUpdatedAt: new Date()
          });
        }

        masterUpdates++;

      } catch (dbError) {
        masterErrors++;
        console.error("❌ Master update error:", dbError.message);

        if (dbError.code === 11000) {
          try {
            await MasterOrder.updateOne(
              { customerName, itemdesc },
              {
                $inc: { orderqty: row["ORDERQTY"], uploadCount: 1 },
                $addToSet: { sourceUploads: upload._id },
                $set: { lastUploadId: upload._id, lastUpdatedAt: new Date() }
              }
            );
            masterUpdates++;
          } catch (retryError) {
            console.error("❌ Retry failed:", retryError.message);
          }
        }
      }
    }

    console.log(`✅ Master database updated: ${masterUpdates} records, ${masterErrors} errors`);

    res.json({
      success: true,
      uploadId: upload._id,
      recordsProcessed: outputRows.length,
      recordsFailed: rowErrors.length,
      warnings: rowWarnings.length,
      masterRecordsUpdated: masterUpdates
    });

  } catch (err) {
    console.error("❌ Conversion error:", err);
    next(err);
  }
};

/* ========================================================================
   EXCEL STYLING
======================================================================== */

function styleSheet(sheet, dataRowCount) {
  sheet["!cols"] = [
    { wch: 10 },  // CODE
    { wch: 30 },  // CUSTOMER NAME
    { wch: 12 },  // SAPCODE
    { wch: 50 },  // ITEMDESC
    { wch: 12 },  // ORDERQTY
    { wch: 10 },  // BOX PACK
    { wch: 10 },  // PACK
    { wch: 15 }   // DVN
  ];

  const range = XLSX.utils.decode_range(sheet["!ref"]);

  const headerStyle = {
    font: { bold: true, sz: 12, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "1F4E79" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: {
      top: { style: "medium", color: { rgb: "000000" } },
      bottom: { style: "medium", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } }
    }
  };

  const cellStyle = {
    font: { sz: 11 },
    alignment: { vertical: "center", wrapText: true },
    border: {
      top: { style: "thin", color: { rgb: "CCCCCC" } },
      bottom: { style: "thin", color: { rgb: "CCCCCC" } },
      left: { style: "thin", color: { rgb: "CCCCCC" } },
      right: { style: "thin", color: { rgb: "CCCCCC" } }
    }
  };

  const altRowStyle = {
    ...cellStyle,
    fill: { fgColor: { rgb: "F2F2F2" } }
  };

  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const ref = XLSX.utils.encode_cell({ r: R, c: C });
      if (!sheet[ref]) continue;

      if (R === 0) {
        sheet[ref].s = headerStyle;
      } else {
        sheet[ref].s = (R % 2 === 0) ? cellStyle : altRowStyle;
      }
    }
  }

  sheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  sheet["!autofilter"] = { ref: `A1:${XLSX.utils.encode_col(range.e.c)}1` };
  sheet["!rows"] = [{ hpt: 25 }];
}

/* ========================================================================
   OTHER ENDPOINTS (unchanged)
======================================================================== */

export const getOrderHistory = async (req, res) => {
  try {
    const { search, status } = req.query;
    const query = { userId: req.user.id };

    if (status && status !== "all") {
      query.status = status;
    }

    if (search) {
      query.fileName = { $regex: search, $options: "i" };
    }

    const history = await OrderUpload.find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json({
      success: true,
      history: history.map(item => ({
        id: item._id.toString(),
        fileName: item.fileName,
        uploadDate: item.createdAt,
        status: item.status,
        recordsProcessed: item.recordsProcessed || 0,
        recordsFailed: item.recordsFailed || 0,
        outputFile: item.outputFile || null,
        processingTime: item.processingTimeMs || null
      }))
    });
  } catch (err) {
    console.error("❌ History error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to load history"
    });
  }
};

export const downloadConvertedFile = async (req, res, next) => {
  try {
    const upload = await OrderUpload.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!upload) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    if (upload.status !== "CONVERTED") {
      return res.status(400).json({
        success: false,
        message: `File not ready. Status: ${upload.status}`
      });
    }

    if (upload.outputFile) {
      const filePath = path.join("uploads", upload.outputFile);

      if (fs.existsSync(filePath)) {
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${upload.fileName.replace(/\.[^/.]+$/, "")}-converted.xlsx"`
        );

        return res.sendFile(path.resolve(filePath));
      }
    }

    // Fallback: regenerate
    if (!upload.convertedData || !upload.convertedData.rows) {
      return res.status(404).json({
        success: false,
        message: "No converted data available"
      });
    }

    const workbook = XLSX.utils.book_new();
    const headers = upload.convertedData.headers || TEMPLATE_COLUMNS;
    const rows = upload.convertedData.rows;

    const excelRows = rows.map(row =>
      headers.map(header => row[header] || "")
    );

    const sheet = XLSX.utils.aoa_to_sheet([headers, ...excelRows]);
    styleSheet(sheet, excelRows.length);

    XLSX.utils.book_append_sheet(workbook, sheet, "Order Training");

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${upload.fileName.replace(/\.[^/.]+$/, "")}-converted.xlsx"`
    );

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    res.send(buffer);

  } catch (err) {
    console.error("❌ Download error:", err);
    next(err);
  }
};

export const getOrderResult = async (req, res) => {
  try {
    const upload = await OrderUpload.findOne({
      _id: req.params.id,
      userId: req.user.id
    }).lean();

    if (!upload) {
      return res.status(404).json({
        success: false,
        message: "Result not found"
      });
    }

    res.json({
      success: true,
      status: upload.status,
      recordsProcessed: upload.recordsProcessed || 0,
      recordsFailed: upload.recordsFailed || 0,
      warnings: upload.rowWarnings || [],
      errors: upload.rowErrors || [],
      outputFile: upload.outputFile,
      processingTime: upload.processingTimeMs
    });
  } catch (err) {
    console.error("❌ Result error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to load result"
    });
  }
};

export const getOrderTemplate = async (_req, res) => {
  try {
    res.json({
      success: true,
      columns: TEMPLATE_COLUMNS
    });
  } catch (err) {
    console.error("Template load error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to load template"
    });
  }
};

export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await OrderUpload.findOne({
      _id: id,
      userId: req.user.id
    }).lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    res.json({
      success: true,
      id: order._id,
      status: order.status,
      recordsProcessed: order.recordsProcessed || 0,
      recordsFailed: order.recordsFailed || 0,
      rowErrors: order.rowErrors || [],
      rowWarnings: order.rowWarnings || [],
      processingTime: order.processingTimeMs || null,
      outputFile: order.outputFile || null
    });
  } catch (err) {
    console.error("❌ Get order error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to load order"
    });
  }
};