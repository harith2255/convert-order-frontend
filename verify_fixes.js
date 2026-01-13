
import { unifiedExtract } from './services/unifiedParser.js';

// Mock file object (mimicking what multer provides)
const createMockFile = (content, name = "test.txt") => ({
  originalname: name,
  buffer: Buffer.from(content)
});

const testCases = [
  {
    name: "Header Leakage",
    input: `
ITEMDESC QTY
NOMFR MICR DIAPRIDE 1 MG TAB ITEMNAME 30 S PACKHSNCODE 30049079 BATCHNO EXP 120
    `.trim(),
    expectedDesc: "MICR DIAPRIDE 1 MG TAB 30 S"
  },
  {
    name: "GST Filtering",
    input: `
ITEMDESC QTY
GST Breakup 12% 100
CGST 6% 50
SGST 6% 50
VALID MEDICINE 500
    `.trim(),
    expectedRowCount: 1, // Only "VALID MEDICINE"
  },
  {
    name: "First Row Valid Data",
    input: `
SAPCODE ITEMDESC QTY
A1002 PARACETAMOL 500MG 1000
    `.trim(),
    expectedRowCount: 1 // Should detect header AND data
  }
];

async function runTests() {
  console.log("🚀 Running Parser Verification Tests...\n");

  for (const test of testCases) {
    console.log(`Testing: ${test.name}`);
    const file = createMockFile(test.input);
    const result = await unifiedExtract(file);

    if (test.expectedDesc) {
      if (result.dataRows.length > 0) {
        const itemDesc = result.dataRows[0][3]; // ITEMDESC index
        console.log(`   Expected: "${test.expectedDesc}"`);
        console.log(`   Got:      "${itemDesc}"`);
        if (itemDesc.includes(test.expectedDesc) && !itemDesc.includes("NOMFR") && !itemDesc.includes("ITEMNAME")) {
           console.log("   ✅ PASS");
        } else {
           console.log("   ❌ FAIL");
        }
      } else {
        console.log("   ❌ FAIL (No rows extracted)");
      }
    }

    if (test.expectedRowCount !== undefined) {
      console.log(`   Expected Rows: ${test.expectedRowCount}`);
      console.log(`   Got Rows:      ${result.dataRows.length}`);
      if (result.dataRows.length === test.expectedRowCount) {
        console.log("   ✅ PASS");
      } else {
         // Log actual rows for debug
         result.dataRows.forEach(r => console.log(`      Found: ${r[3]}`));
         console.log("   ❌ FAIL");
      }
    }
    console.log("-----------------------------------");
  }
}

runTests().catch(console.error);
