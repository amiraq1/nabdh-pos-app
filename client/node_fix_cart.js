import fs from 'fs';
import path from 'path';

const posPath = path.resolve('client/src/pages/POSPage.tsx');
let content = fs.readFileSync(posPath, 'utf8');

content = content.replace("setCart((current) => current.filter(item => item.productId !== productId));", "removeStoreItem(productId);");
content = content.replace("  }, []);", "  }, [removeStoreItem]);");

fs.writeFileSync(posPath, content);
console.log("Fixed setCart calls");
