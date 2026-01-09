import OrderUpload from "../../models/orderUpload.js";
import XLSX from "xlsx";

export const exportAllConvertedData = async (req, res) => {
  // 🔐 Admin only
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied" });
  }

  // 1️⃣ Fetch only converted uploads
  const uploads = await OrderUpload.find({
    status: "CONVERTED",
    extractedData: { $exists: true }
  }).lean();

  // 2️⃣ Merge rows (NO DUPLICATES)
  const mergedRows = [];
  const seen = new Set(); // 🔥 dedupe safeguard

  uploads.forEach(upload => {
    const rows = upload.extractedData?.rows || [];

    rows.forEach(row => {
      const hashKey = `${row.customer}|${row.sapcode}|${row.itemdesc}|${row.orderqty}`;
      if (!seen.has(hashKey)) {
        seen.add(hashKey);
        mergedRows.push(row);
      }
    });
  });

  if (!mergedRows.length) {
    return res.status(400).json({ message: "No converted data available" });
  }

  // 3️⃣ Create Excel
  const worksheet = XLSX.utils.json_to_sheet(mergedRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Converted Orders");

  const buffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx"
  });

  // 4️⃣ Send file
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=admin_converted_orders.xlsx"
  );
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

  res.send(buffer);
};
