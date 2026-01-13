
import { unifiedExtract } from './services/unifiedParser.js';

// Specific lines from the screenshot
const headerLine = "NoMFR ITEMNAME PACKHSNCODE BATCHNO EXP QTY FREE RATE MRP DIS TAXABLE GST Amount";
const row1 = "1 MICR DIAPRIDE 1 MG TAB 30 S 30049079 120 0 81.19 118.40 0.00 9742.80 5.00 10229.94";
const row2 = "2 MICR DIAPRIDE 2 MG TAB 30 S 30049079 40 0 127.40 185.80 0.00 5096.00 5.00 5350.80";

const inputContent = `
START
${headerLine}
${row1}
${row2}
END
`.trim();

const file = {
  originalname: "invoice.txt",
  buffer: Buffer.from(inputContent)
};

async function runTest() {
  console.log("Analyzing Row 1 Parsing...");
  
  const result = await unifiedExtract(file);
  
  console.log(`\nExtracted ${result.dataRows.length} rows.`);
  result.dataRows.forEach((r, i) => {
    console.log(`Row ${i+1}: ${JSON.stringify(r)}`);
  });

  if (result.dataRows.length === 2) {
    console.log("\n✅ SUCCESS: Both rows extracted.");
  } else {
    console.log("\n❌ FAILURE: Missing rows.");
  }
}

runTest();
