/**
 * Production-ready PDF Text Extractor
 * File: backend/services/pdfParser.js
 * Dependency: pdfjs-dist
 */

import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

/* ======================================================
   CONFIG
====================================================== */

// Increased tolerance for real-world invoices
const ROW_Y_TOLERANCE = 9;

/* ======================================================
   HELPERS
====================================================== */

function clean(text = "") {
  return String(text).replace(/\s+/g, " ").trim();
}

/* ======================================================
   CORE PDF EXTRACTION
====================================================== */

export async function extractTextFromPDFAdvanced(buffer) {
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;

  const rows = [];
  const lines = [];

  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();

    const items = content.items
      .map(i => ({
        text: i.str,
        x: i.transform?.[4] ?? 0,
        y: i.transform?.[5] ?? 0,
      }))
      .filter(i => i.text && i.text.trim());

    /* ---------- GROUP BY Y (ROW DETECTION) ---------- */
    const tempRows = [];

    for (const item of items) {
      let row = tempRows.find(r => Math.abs(r.y - item.y) <= ROW_Y_TOLERANCE);

      if (!row) {
        row = { y: item.y, cells: [] };
        tempRows.push(row);
      }

      row.cells.push(item);
    }

    tempRows
      .sort((a, b) => b.y - a.y) // top → bottom
      .forEach(r => {
        r.cells.sort((a, b) => a.x - b.x); // left → right

        const rawText = clean(
          r.cells.map(c => c.text).join(" ")
        );

        if (rawText.length > 1) {
          rows.push({ rawText, cells: r.cells });
          lines.push(rawText);
        }
      });
  }

  await pdf.destroy();

  return { rows, lines };
}

export default {
  extractTextFromPDFAdvanced,
};
