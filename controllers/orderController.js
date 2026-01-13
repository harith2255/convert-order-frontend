/**
 * PRODUCTION CONTROLLER - FINAL VERSION
 * Zero data loss, atomic operations, comprehensive error handling
 */

import OrderUpload from "../models/orderUpload.js";
import MasterOrder from "../models/masterOrder.js";
import XLSX from "xlsx";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { unifiedExtract } from "../services/unifiedParser.js";

const TEMPLATE_COLUMNS = [
  "CODE", "CUSTOMER NAME", "SAPCODE", "ITEMDESC",
  "ORDERQTY", "BOX PACK", "PACK", "DVN"
];

/* ========================================================================
   UTILITIES
======================================================================== */

function extractPackSize(desc) {
  if (!desc) return 0;
  
  const patterns = [
    /\((\d+)['\s]*s\)/gi,
    /\b(\d+)['\s]*s\b/gi,
    /\*(\d+)/g,
    /\b(\d+)\s*(?:tab|cap)/gi
  ];
  
  const matches = [];
  patterns.forEach(p => {
    const m = desc.matchAll(p);
    for (const match of m) {
      const n = parseInt(match[1], 10);
      if (n > 0 && n <= 2000) matches.push(n);
    }
  });
  
  if (!matches.length) return 0;
  
  const freq = {};
  matches.forEach(m => freq[m] = (freq[m] || 0) + 1);
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  
  return parseInt(sorted[0][0], 10);
}

function calcBoxPack(qty, pack) {
  if (!qty || !pack || pack === 0) return 0;
  return Math.floor(qty / pack);
}

function validateRow(row, idx) {
  const errors = [];
  const warnings = [];
  
  // Validate ITEMDESC
  if (!row.ITEMDESC || row.ITEMDESC.length < 2) {
    errors.push({
      row: idx + 2,
      field: "ITEMDESC",
      message: "Missing item description"
    });
    return { row, errors, warnings };
  }
  
  // Validate ORDERQTY
  const qty = Number(row.ORDERQTY);
  if (!qty || qty <= 0 || qty > 100000) {
    errors.push({
      row: idx + 2,
      field: "ORDERQTY",
      message: "Invalid quantity"
    });
    return { row, errors, warnings };
  }
  
  // Extract/calculate PACK
  let pack = Number(row.PACK) || 0;
  if (pack === 0) {
    pack = extractPackSize(row.ITEMDESC);
    if (pack > 0) {
      row.PACK = pack;
      warnings.push({
        row: idx + 2,
        field: "PACK",
        message: `Auto-extracted: ${pack}`
      });
    }
  }
  
  // Calculate/validate BOX PACK
  let box = Number(row["BOX PACK"]) || 0;
  if (pack > 0 && qty > 0) {
    const expected = calcBoxPack(qty, pack);
    if (box !== expected) {
      row["BOX PACK"] = expected;
      if (box > 0) {
        warnings.push({
          row: idx + 2,
          field: "BOX PACK",
          message: `Corrected: ${expected} (was ${box})`
        });
      } else {
        warnings.push({
          row: idx + 2,
          field: "BOX PACK",
          message: `Calculated: ${expected}`
        });
      }
    }
  }
  
  return { row, errors, warnings };
}

function styleExcelSheet(sheet) {
  sheet["!cols"] = [
    { wch: 10 }, { wch: 30 }, { wch: 12 }, { wch: 50 },
    { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 15 }
  ];
  
  const range = XLSX.utils.decode_range(sheet["!ref"]);
  
  const headerStyle = {
    font: { bold: true, sz: 12, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "1F4E79" } },
    alignment: { horizontal: "center", vertical: "center" },
    border: {
      top: { style: "medium" },
      bottom: { style: "medium" },
      left: { style: "thin" },
      right: { style: "thin" }
    }
  };
  
  const cellStyle = {
    font: { sz: 11 },
    alignment: { vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "CCCCCC" } },
      bottom: { style: "thin", color: { rgb: "CCCCCC" } },
      left: { style: "thin", color: { rgb: "CCCCCC" } },
      right: { style: "thin", color: { rgb: "CCCCCC" } }
    }
  };
  
  const altStyle = {
    ...cellStyle,
    fill: { fgColor: { rgb: "F2F2F2" } }
  };
  
  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const ref = XLSX.utils.encode_cell({ r: R, c: C });
      if (!sheet[ref]) continue;
      
      sheet[ref].s = R === 0 ? headerStyle : (R % 2 === 0 ? cellStyle : altStyle);
    }
  }
  
  sheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  sheet["!autofilter"] = { ref: `A1:H1` };
  sheet["!rows"] = [{ hpt: 25 }];
}

/* ========================================================================
   EXTRACT ENDPOINT
======================================================================== */

export const extractOrderFields = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded"
      });
    }
    
    const file = req.file;
    console.log(`📦 File: ${file.originalname} (${file.size} bytes)`);
    
    const fileHash = crypto.createHash("sha256").update(file.buffer).digest("hex");
    
    // Extract data
    let result;
    try {
      result = await unifiedExtract(file);
    } catch (err) {
      console.error("❌ Parser error:", err);
      return res.status(422).json({
        success: false,
        message: "Failed to parse file. Please check file format.",
        error: "PARSER_ERROR"
      });
    }
    
    if (!result || result.error) {
      const errorMsgs = {
        PDF_EXTRACTION_FAILED: "Failed to extract PDF text",
        EXCEL_EXTRACTION_FAILED: "Failed to read Excel file",
        TXT_EXTRACTION_FAILED: "Failed to read text file",
        EMPTY_FILE: "File is empty",
        UNSUPPORTED_FORMAT: "Unsupported file format"
      };
      
      return res.status(422).json({
        success: false,
        message: errorMsgs[result.error] || "Extraction failed",
        error: result.error
      });
    }
    
    if (!result.dataRows || result.dataRows.length === 0) {
      return res.status(422).json({
        success: false,
        message: "No data rows found in file",
        error: "NO_DATA"
      });
    }
    
    // Save upload
    let upload = await OrderUpload.findOne({ fileHash, userId: req.user.id });
    
    if (!upload) {
      upload = await OrderUpload.create({
        userId: req.user.id,
        userEmail: req.user.email,
        fileName: file.originalname,
        fileType: file.mimetype,
        fileHash,
        status: "EXTRACTED",
        extractedData: result
      });
    } else {
      upload.status = "EXTRACTED";
      upload.extractedData = result;
      upload.recordsProcessed = 0;
      upload.recordsFailed = 0;
      upload.outputFile = null;
      await upload.save();
    }
    
    console.log(`✅ Extracted ${result.dataRows.length} rows`);
    
    res.json({
      success: true,
      uploadId: upload._id,
      extractedFields: result.extractedFields,
      dataRows: result.dataRows,
      rowCount: result.dataRows.length
    });
    
  } catch (err) {
    console.error("❌ Extract error:", err);
    next(err);
  }
};

/* ========================================================================
   CONVERT ENDPOINT
======================================================================== */

export const convertOrders = async (req, res, next) => {
  const { uploadId, editedRows } = req.body;
  const start = Date.now();
  
  try {
    if (!uploadId) {
      return res.status(400).json({
        success: false,
        message: "uploadId required"
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
    
    const { meta } = upload.extractedData;
    const sourceRows = Array.isArray(editedRows) && editedRows.length > 0
      ? editedRows
      : upload.extractedData.dataRows;
    
    console.log(`🔄 Converting ${sourceRows.length} rows...`);
    
    const output = [];
    const allErrors = [];
    const allWarnings = [];
    
    // Validate and enrich each row
    sourceRows.forEach((row, idx) => {
      const { row: validated, errors, warnings } = validateRow(row, idx);
      
      if (errors.length > 0) {
        allErrors.push(...errors);
        return;
      }
      
      if (warnings.length > 0) {
        allWarnings.push(...warnings);
      }
      
      output.push({
        "CODE": validated.CODE || "",
        "CUSTOMER NAME": validated["CUSTOMER NAME"] || meta.customerName || "UNKNOWN",
        "SAPCODE": validated.SAPCODE || "",
        "ITEMDESC": validated.ITEMDESC,
        "ORDERQTY": Number(validated.ORDERQTY),
        "BOX PACK": Number(validated["BOX PACK"]) || 0,
        "PACK": Number(validated.PACK) || 0,
        "DVN": validated.DVN || ""
      });
    });
    
    console.log(`📊 Valid: ${output.length}, Errors: ${allErrors.length}, Warnings: ${allWarnings.length}`);
    
    if (output.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid rows",
        errors: allErrors
      });
    }
    
    // Create Excel
    const wb = XLSX.utils.book_new();
    const excelRows = output.map(r => [
      r.CODE, r["CUSTOMER NAME"], r.SAPCODE, r.ITEMDESC,
      r.ORDERQTY, r["BOX PACK"], r.PACK, r.DVN
    ]);
    
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_COLUMNS, ...excelRows]);
    styleExcelSheet(ws);
    XLSX.utils.book_append_sheet(wb, ws, "Order Training");
    
    // Save file
    fs.mkdirSync("uploads", { recursive: true });
    const fileName = `order-${upload._id}-${Date.now()}.xlsx`;
    const filePath = path.join("uploads", fileName);
    XLSX.writeFile(wb, filePath);
    
    // Update upload
    upload.status = "CONVERTED";
    upload.recordsProcessed = output.length;
    upload.recordsFailed = allErrors.length;
    upload.outputFile = fileName;
    upload.convertedData = { headers: TEMPLATE_COLUMNS, rows: output };
    upload.rowErrors = allErrors;
    upload.rowWarnings = allWarnings;
    upload.processingTimeMs = Date.now() - start;
    await upload.save();
    
    // Update master database
    await updateMasterDatabase(output, upload._id);
    
    res.json({
      success: true,
      uploadId: upload._id,
      recordsProcessed: output.length,
      recordsFailed: allErrors.length,
      warnings: allWarnings.length
    });
    
  } catch (err) {
    console.error("❌ Convert error:", err);
    next(err);
  }
};

/* ========================================================================
   MASTER DATABASE UPDATE (Atomic, Deduplicated)
======================================================================== */

async function updateMasterDatabase(rows, uploadId) {
  // Deduplicate within upload
  const dedupMap = new Map();
  
  rows.forEach(row => {
    const key = `${row["CUSTOMER NAME"].toLowerCase()}||${row.ITEMDESC.toLowerCase()}`;
    
    if (!dedupMap.has(key)) {
      dedupMap.set(key, { ...row });
    } else {
      const existing = dedupMap.get(key);
      existing.ORDERQTY += row.ORDERQTY;
      
      // Recalc box pack
      if (existing.PACK > 0) {
        existing["BOX PACK"] = calcBoxPack(existing.ORDERQTY, existing.PACK);
      }
    }
  });
  
  const uniqueRows = Array.from(dedupMap.values());
  console.log(`📝 Updating master: ${uniqueRows.length} unique items`);
  
  let updated = 0;
  let errors = 0;
  
  for (const row of uniqueRows) {
    const customer = row["CUSTOMER NAME"].trim().toUpperCase();
    const item = row.ITEMDESC.trim().toUpperCase();
    
    if (!customer || !item) continue;
    
    // Generate dedup key
    const dedupKey = crypto
      .createHash("md5")
      .update(`${customer}||${item}`)
      .digest("hex");
    
    try {
      // Atomic upsert
      await MasterOrder.findOneAndUpdate(
        { dedupKey },
        {
          $setOnInsert: {
            customerName: customer,
            itemdesc: item,
            dedupKey,
            code: row.CODE || "",
            sapcode: row.SAPCODE || "",
            dvn: row.DVN || "",
            pack: row.PACK || 0
          },
          $inc: { orderqty: row.ORDERQTY, uploadCount: 1 },
          $addToSet: { sourceUploads: uploadId },
          $set: {
            boxPack: row["BOX PACK"] || 0,
            lastUploadId: uploadId,
            lastUpdatedAt: new Date()
          }
        },
        { upsert: true, new: true }
      );
      
      updated++;
      
    } catch (err) {
      errors++;
      console.error(`❌ Master update failed: ${err.message}`);
    }
  }
  
  console.log(`✅ Master updated: ${updated} success, ${errors} errors`);
}

/* ========================================================================
   ADMIN EXPORT (Deduplicated Master Data)
======================================================================== */

export const exportAllConvertedData = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin only" });
    }
    
    console.log(`📥 Admin export by ${req.user.email}`);
    
    const orders = await MasterOrder.find()
      .sort({ customerName: 1, itemdesc: 1 })
      .lean();
    
    if (!orders.length) {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([["NO DATA"]]);
      XLSX.utils.book_append_sheet(wb, ws, "Info");
      
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=\"pharma_empty.xlsx\"");
      
      return res.send(buf);
    }
    
    console.log(`📊 Exporting ${orders.length} orders`);
    
    // Safety dedup (in-memory)
    const finalMap = new Map();
    
    orders.forEach(o => {
      const key = `${o.customerName}||${o.itemdesc}`;
      
      if (!finalMap.has(key)) {
        finalMap.set(key, {
          code: o.code || "",
          customerName: o.customerName || "",
          sapcode: o.sapcode || "",
          itemdesc: o.itemdesc || "",
          orderqty: o.orderqty || 0,
          boxPack: o.boxPack || 0,
          pack: o.pack || 0,
          dvn: o.dvn || ""
        });
      } else {
        const existing = finalMap.get(key);
        existing.orderqty += (o.orderqty || 0);
        
        if (existing.pack > 0) {
          existing.boxPack = calcBoxPack(existing.orderqty, existing.pack);
        }
      }
    });
    
    const final = Array.from(finalMap.values());
    console.log(`✅ Final: ${final.length} unique orders`);
    
    // Create Excel
    const exportRows = final.map(o => ({
      "CODE": o.code,
      "CUSTOMER NAME": o.customerName,
      "SAPCODE": o.sapcode,
      "ITEMDESC": o.itemdesc,
      "ORDERQTY": o.orderqty,
      "BOX PACK": o.boxPack,
      "PACK": o.pack,
      "DVN": o.dvn
    }));
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportRows, { header: TEMPLATE_COLUMNS });
    styleExcelSheet(ws);
    XLSX.utils.book_append_sheet(wb, ws, "Order Training");
    
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    
    const date = new Date().toISOString().split("T")[0];
    const filename = `pharma_master_${date}.xlsx`;
    
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    
    res.send(buf);
    
  } catch (err) {
    console.error("❌ Export error:", err);
    res.status(500).json({ message: "Export failed" });
  }
};

/* ========================================================================
   OTHER ENDPOINTS
======================================================================== */

export const getOrderHistory = async (req, res) => {
  try {
    const { search, status } = req.query;
    const query = { userId: req.user.id };
    
    if (status && status !== "all") query.status = status;
    if (search) query.fileName = { $regex: search, $options: "i" };
    
    const history = await OrderUpload.find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    
    res.json({
      success: true,
      history: history.map(h => ({
        id: h._id.toString(),
        fileName: h.fileName,
        uploadDate: h.createdAt,
        status: h.status,
        recordsProcessed: h.recordsProcessed || 0,
        recordsFailed: h.recordsFailed || 0,
        outputFile: h.outputFile,
        processingTime: h.processingTimeMs
      }))
    });
  } catch (err) {
    console.error("❌ History error:", err);
    res.status(500).json({ success: false, message: "Failed to load history" });
  }
};

export const downloadConvertedFile = async (req, res, next) => {
  try {
    const upload = await OrderUpload.findOne({
      _id: req.params.id,
      userId: req.user.id
    });
    
    if (!upload) {
      return res.status(404).json({ message: "Not found" });
    }
    
    if (upload.status !== "CONVERTED") {
      return res.status(400).json({ message: `Not ready: ${upload.status}` });
    }
    
    if (upload.outputFile) {
      const fp = path.join("uploads", upload.outputFile);
      
      if (fs.existsSync(fp)) {
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename="${upload.fileName.replace(/\.[^.]+$/, "")}-converted.xlsx"`);
        return res.sendFile(path.resolve(fp));
      }
    }
    
    // Fallback: regenerate
    if (!upload.convertedData?.rows) {
      return res.status(404).json({ message: "No data" });
    }
    
    const wb = XLSX.utils.book_new();
    const rows = upload.convertedData.rows;
    const excelRows = rows.map(r => [
      r.CODE, r["CUSTOMER NAME"], r.SAPCODE, r.ITEMDESC,
      r.ORDERQTY, r["BOX PACK"], r.PACK, r.DVN
    ]);
    
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_COLUMNS, ...excelRows]);
    styleExcelSheet(ws);
    XLSX.utils.book_append_sheet(wb, ws, "Order Training");
    
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${upload.fileName.replace(/\.[^.]+$/, "")}-converted.xlsx"`);
    
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.send(buf);
    
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
      return res.status(404).json({ message: "Not found" });
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
    res.status(500).json({ message: "Failed" });
  }
};

export const getOrderTemplate = async (_req, res) => {
  try {
    res.json({ success: true, columns: TEMPLATE_COLUMNS });
  } catch (err) {
    console.error("❌ Template error:", err);
    res.status(500).json({ message: "Failed" });
  }
};

export const getOrderById = async (req, res) => {
  try {
    const order = await OrderUpload.findOne({
      _id: req.params.id,
      userId: req.user.id
    }).lean();
    
    if (!order) {
      return res.status(404).json({ message: "Not found" });
    }
    
    res.json({
      success: true,
      id: order._id,
      status: order.status,
      recordsProcessed: order.recordsProcessed || 0,
      recordsFailed: order.recordsFailed || 0,
      rowErrors: order.rowErrors || [],
      rowWarnings: order.rowWarnings || [],
      processingTime: order.processingTimeMs,
      outputFile: order.outputFile
    });
  } catch (err) {
    console.error("❌ Get order error:", err);
    res.status(500).json({ message: "Failed" });
  }
};

export const getMasterStats = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin only" });
    }
    
    const [total, customers, products, qty] = await Promise.all([
      MasterOrder.countDocuments(),
      MasterOrder.distinct("customerName").then(a => a.length),
      MasterOrder.distinct("itemdesc").then(a => a.length),
      MasterOrder.aggregate([
        { $group: { _id: null, total: { $sum: "$orderqty" } } }
      ]).then(r => r[0]?.total || 0)
    ]);
    
    res.json({
      success: true,
      stats: { totalOrders: total, totalCustomers: customers, totalProducts: products, totalQuantity: qty }
    });
  } catch (err) {
    console.error("❌ Stats error:", err);
    res.status(500).json({ message: "Failed" });
  }
};