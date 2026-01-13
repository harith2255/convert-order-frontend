
import fs from 'fs';
import path from 'path';
import { unifiedExtract } from './services/unifiedParser.js';

async function run() {
    const dir = './test-files';
    if (!fs.existsSync(dir)) {
        console.log("No test-files directory found");
        return;
    }
    const files = fs.readdirSync(dir);

    console.log('File Name'.padEnd(40) + 'Rows'.padEnd(10) + 'Status');
    console.log('-'.repeat(70));

    for (const file of files) {
        if (file.startsWith('.')) continue; 
        const filePath = path.join(dir, file);
        const buffer = fs.readFileSync(filePath);
        const fileObj = {
            buffer,
            originalname: file, 
            mimetype: 'application/octet-stream'
        };

        try {
            const result = await unifiedExtract(fileObj);
            const rowCount = result.dataRows ? result.dataRows.length : 0;
            const status = result.error ? `ERROR: ${result.error}` : (rowCount > 0 ? 'OK' : 'EMPTY');
            console.log(file.padEnd(40) + String(rowCount).padEnd(10) + status);
        } catch (e) {
            console.log(file.padEnd(40) + 'ERR'.padEnd(10) + e.message);
        }
    }
}

run().catch(console.error);
