import fs from 'fs';
import path from 'path';

const posPath = path.resolve('client/src/pages/POSPage.tsx');
let lines = fs.readFileSync(posPath, 'utf8').split('\n');

lines.splice(56, 3); // remve lines 57, 58, 59 (0-indexed indices 56, 57, 58)

fs.writeFileSync(posPath, lines.join('\n'));
console.log("Lines removed");
