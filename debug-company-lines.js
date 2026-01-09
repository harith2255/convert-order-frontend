/**
 * DEBUG SCRIPT - Analyze Company Name Extraction Issues
 * Run: node backend/debug-company-lines.js
 */

import { extractPurchaseOrderPDF } from './services/unifiedParser.js';
import fs from 'fs';

async function debugCompanyLines() {
  console.log('🔍 DEBUGGING COMPANY NAME EXTRACTION');
  console.log('='.repeat(80));

  const filePath = './test-files/raj 1497.pdf'; // Your multi-company PDF

  if (!fs.existsSync(filePath)) {
    console.log('❌ File not found:', filePath);
    return;
  }

  const buffer = fs.readFileSync(filePath);
  const file = { buffer, originalname: 'raj 1497.pdf' };

  console.log('\n📄 Extracting file...\n');

  const result = await extractPurchaseOrderPDF(file);

  console.log('✅ Extraction complete');
  console.log(`📊 Total rows extracted: ${result.dataRows.length}\n`);

  // Find rows that might be company names
  console.log('🔍 ANALYZING FOR COMPANY NAME ROWS');
  console.log('-'.repeat(80));

  const suspiciousRows = result.dataRows.filter(row => {
    const itemdesc = row["ITEMDESC"] || "";
    const sapcode = row["SAPCODE"] || "";
    const orderqty = row["ORDERQTY"] || 0;

    // Flag rows that look like company names
    const isShort = itemdesc.split(/\s+/).length <= 4;
    const hasCompanyKeywords = /(?:company|comapany|micro|pharma|carsyon|division|labs?|name)/i.test(itemdesc);
    const noSapCode = !sapcode;
    const lowQty = orderqty < 10;

    return hasCompanyKeywords && (isShort || noSapCode || lowQty);
  });

  if (suspiciousRows.length > 0) {
    console.log(`⚠️  Found ${suspiciousRows.length} suspicious rows:\n`);

    suspiciousRows.forEach((row, i) => {
      console.log(`${i + 1}. SUSPICIOUS ROW:`);
      console.log(`   Customer: ${row["CUSTOMER NAME"]}`);
      console.log(`   SAP Code: ${row["SAPCODE"] || "(none)"}`);
      console.log(`   Item Desc: "${row["ITEMDESC"]}"`);
      console.log(`   Qty: ${row["ORDERQTY"]}`);
      console.log(`   DVN: ${row["DVN"] || "(none)"}`);
      console.log('');
    });

    console.log('💡 ANALYSIS:');
    suspiciousRows.forEach((row, i) => {
      const itemdesc = row["ITEMDESC"];
      
      if (/^(?:company|comapany|division)\s*name/i.test(itemdesc)) {
        console.log(`   Row ${i + 1}: Contains "Company Name" or "Division Name" - SHOULD BE FILTERED`);
      }
      
      if (/^(?:micro|carsyon)/i.test(itemdesc) && !row["SAPCODE"]) {
        console.log(`   Row ${i + 1}: Starts with company keyword, no SAP code - LIKELY COMPANY NAME`);
      }
      
      if (row["ORDERQTY"] < 5) {
        console.log(`   Row ${i + 1}: Very low quantity (${row["ORDERQTY"]}) - VERIFY IF VALID PRODUCT`);
      }
    });
  } else {
    console.log('✅ No suspicious company name rows found!\n');
  }

  // Show good examples
  console.log('\n📋 SAMPLE VALID PRODUCTS:');
  console.log('-'.repeat(80));

  const validProducts = result.dataRows
    .filter(row => row["SAPCODE"] && row["ORDERQTY"] >= 10)
    .slice(0, 5);

  validProducts.forEach((row, i) => {
    console.log(`${i + 1}. ${row["ITEMDESC"]}`);
    console.log(`   SAP: ${row["SAPCODE"]} | Qty: ${row["ORDERQTY"]} | DVN: ${row["DVN"]}`);
  });

  // Division analysis
  console.log('\n\n🏢 DIVISION ANALYSIS:');
  console.log('-'.repeat(80));

  const divisions = {};
  result.dataRows.forEach(row => {
    const dvn = row["DVN"] || "No Division";
    if (!divisions[dvn]) {
      divisions[dvn] = 0;
    }
    divisions[dvn]++;
  });

  Object.entries(divisions).forEach(([dvn, count]) => {
    console.log(`   ${dvn}: ${count} products`);
  });

  console.log('\n' + '='.repeat(80));
}

debugCompanyLines().catch(err => {
  console.error('💥 ERROR:', err);
  process.exit(1);
});