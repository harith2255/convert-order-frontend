/**
 * Production-ready PDF Parser
 * File: backend/services/pdfParser.js
 * Dependency: pdfjs-dist
 */

import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

/* ======================================================
   CONFIG
====================================================== */

const ROW_Y_TOLERANCE = 6;


/* ======================================================
   HELPERS
====================================================== */

function clean(text = "") {
  return text.replace(/\s+/g, " ").trim();
}

function cleanItemDesc(text) {
  return text
    .replace(/\b(gm|mg|ml|caps?|tabs?|dtf|strip|box|pack)\b/gi, "")
    .replace(/\s+\d+\s*'?s\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
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

    const items = content.items.map(i => ({
      text: i.str,
      x: i.transform[4],
      y: i.transform[5],
    }));

    /* ---------- GROUP BY Y (ROW DETECTION) ---------- */
    const tempRows = [];

    for (const item of items) {
      let row = tempRows.find(r => Math.abs(r.y - item.y) < ROW_Y_TOLERANCE);
      if (!row) {
        row = { y: item.y, cells: [] };
        tempRows.push(row);
      }
      row.cells.push(item);
    }

    tempRows
      .sort((a, b) => b.y - a.y)
      .forEach(r => {
        r.cells.sort((a, b) => a.x - b.x);
        const rawText = clean(r.cells.map(c => c.text).join(" "));
        if (rawText) {
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
