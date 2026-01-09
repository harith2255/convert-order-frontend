export async function extractOrderText(file) {
  try {
    const text = file.buffer.toString("utf8");

    const lines = text
      .split(/\r?\n/)
      .map(l => l.replace(/\s+/g, " ").trim())
      .filter(Boolean);

    /* ---------------- CUSTOMER ---------------- */
    let customerName = "UNKNOWN CUSTOMER";
    for (const line of lines.slice(0, 20)) {
      const m =
        line.match(/^([A-Z][A-Z\s&]+ENTERPRISES)/i) ||
        line.match(/supplier\s*:\s*(.+)/i);

      if (m?.[1]) {
        customerName = m[1].trim();
        break;
      }
    }

    /* ---------------- PRODUCTS ---------------- */
    const dataRows = [];
    let tableStarted = false;

    for (const line of lines) {
      // detect table header
      if (/code\s+product\s+pack\s+order/i.test(line)) {
        tableStarted = true;
        continue;
      }

      if (!tableStarted) continue;

      // stop at totals
      if (/total value|despatch date/i.test(line)) break;

      /**
       * EXPECTED FORMAT:
       * DOLO 1000 10's *5 50 +10FREE
       */
      const match = line.match(
        /^(.+?)\s+\d+['"]?s\s*\*?\s*\d*\s+(\d+)\s*(?:\+\d+free)?$/i
      );

      if (!match) continue;

      const itemDesc = match[1].trim();
      const qty = Number(match[2]);

      if (!itemDesc || qty <= 0) continue;

      dataRows.push([
        "",            // SAPCODE (blank by rule)
        itemDesc,      // ITEMDESC
        qty,           // ORDERQTY
      ]);
    }

    /* ---------------- NEVER FAIL ---------------- */
    return {
      meta: { customerName },
      headers: ["sapcode", "itemdesc", "orderqty"],
      dataRows,
      extractedFields: [
        {
          id: "itemdesc",
          fieldName: "Item Description",
          sampleValue: dataRows[0]?.[1] || "",
          autoMapped: "itemdesc",
          confidence: "high",
        },
        {
          id: "orderqty",
          fieldName: "Order Quantity",
          sampleValue: String(dataRows[0]?.[2] || ""),
          autoMapped: "orderqty",
          confidence: "high",
        },
      ],
    };
  } catch (err) {
    console.error("TXT extraction failed:", err);

    return {
      meta: { customerName: "UNKNOWN CUSTOMER" },
      headers: ["sapcode", "itemdesc", "orderqty"],
      dataRows: [],
      extractedFields: [],
    };
  }
}
