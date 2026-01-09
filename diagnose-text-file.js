/**
 * DIAGNOSTIC SCRIPT - TEXT FILE ANALYSIS
 * Run: node backend/diagnose-text-file.js
 * 
 * Use this to understand exact format of text files
 */

import fs from 'fs';

function analyzeTextFile(filePath) {
  console.log('🔍 ANALYZING TEXT FILE');
  console.log('='.repeat(80));
  console.log(`File: ${filePath}\n`);

  if (!fs.existsSync(filePath)) {
    console.log('❌ File not found');
    return;
  }

  const buffer = fs.readFileSync(filePath);
  const text = buffer.toString('utf8');
  const lines = text.split(/\r?\n/);

  console.log(`📊 Total Lines: ${lines.length}\n`);
  console.log('📝 RAW CONTENT (First 50 lines):');
  console.log('-'.repeat(80));

  lines.slice(0, 50).forEach((line, i) => {
    // Show line number, length, and content
    const display = line.trim();
    if (display) {
      console.log(`${String(i + 1).padStart(3, ' ')} [${String(line.length).padStart(3, ' ')} chars] ${display}`);
    }
  });

  console.log('\n' + '='.repeat(80));
  console.log('🎯 PATTERN ANALYSIS');
  console.log('-'.repeat(80));

  // Look for product lines
  const productPatterns = [];
  let tableStarted = false;

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    
    // Detect table start
    if (/(item|product).*(qty|quantity)/i.test(trimmed)) {
      console.log(`✅ Table header found at line ${i + 1}: "${trimmed}"`);
      tableStarted = true;
      return;
    }

    if (!tableStarted) return;

    // Look for lines with numbers (potential products)
    if (/\d/.test(trimmed) && trimmed.length > 5) {
      productPatterns.push({
        line: i + 1,
        content: trimmed,
        tokens: trimmed.split(/\s+/),
        hasNumbers: /\d+/.test(trimmed),
        endsWithNumber: /\d+\s*$/.test(trimmed)
      });
    }
  });

  console.log(`\n📦 Potential Product Lines: ${productPatterns.length}`);
  console.log('-'.repeat(80));

  productPatterns.slice(0, 10).forEach((pattern, i) => {
    console.log(`\n${i + 1}. Line ${pattern.line}:`);
    console.log(`   Content: "${pattern.content}"`);
    console.log(`   Tokens: [${pattern.tokens.join('] [')}]`);
    console.log(`   Token Count: ${pattern.tokens.length}`);
    console.log(`   Ends with number: ${pattern.endsWithNumber}`);
    
    // Try to identify parts
    const lastToken = pattern.tokens[pattern.tokens.length - 1];
    const isLastTokenQty = /^\d{1,5}$/.test(lastToken);
    
    if (isLastTokenQty) {
      const qty = parseInt(lastToken, 10);
      const itemTokens = pattern.tokens.slice(0, -1);
      console.log(`   >>> Likely QTY: ${qty}`);
      console.log(`   >>> Likely ITEM: "${itemTokens.join(' ')}"`);
    }
  });

  console.log('\n' + '='.repeat(80));
}

// Analyze the test file
analyzeTextFile('./test-files/577.MICROLABS.txt');

console.log('\n💡 RECOMMENDATIONS:');
console.log('-'.repeat(80));
console.log('1. Check if product names contain special characters (*, -, etc)');
console.log('2. Verify quantity position (last token vs specific column)');
console.log('3. Identify any pack size multipliers (10\'S, *5, etc)');
console.log('4. Check for free quantity annotations (+10 FREE)');
console.log('5. Look for embedded metadata in product names');
console.log('='.repeat(80));