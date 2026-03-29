const fs = require('fs');
const { execSync } = require('child_process');

try {
  execSync('git restore client/src/pages/ProductsPage.tsx');
  console.log("Git restore successful for ProductsPage.tsx");
} catch (e) {
  console.log("Could not restore via git, continuing anyway...");
}

// 1. Fix server/db.ts
let dbPath = 'server/db.ts';
if (fs.existsSync(dbPath)) {
  let dbCode = fs.readFileSync(dbPath, 'utf8');
  dbCode = dbCode.replace(/categories,\s*/g, '');
  dbCode = dbCode.replace(/Category,\s*/g, '');
  dbCode = dbCode.replace(/InsertCategory,\s*/g, '');

  dbCode = dbCode.replace(/export async function getCategories\(\) \{[\s\S]*?^}\r?\n/gm, '');
  dbCode = dbCode.replace(/export async function getCategoryById\([^)]+\) \{[\s\S]*?^}\r?\n/gm, '');
  dbCode = dbCode.replace(/export async function createCategory\([^)]+\) \{[\s\S]*?^}\r?\n/gm, '');
  dbCode = dbCode.replace(/export async function updateCategory\([^)]+\) \{[\s\S]*?^}\r?\n/gm, '');
  dbCode = dbCode.replace(/export async function deleteCategory\([^)]+\) \{[\s\S]*?^}\r?\n/gm, '');

  // Remove category filtering inside listProducts
  dbCode = dbCode.replace(/if \(categoryId\) \{[\s\S]*?^\s*\}/gm, '');
  
  // Remove object property references for categoryId
  dbCode = dbCode.replace(/categoryId\??:\s*number;?/g, '');
  dbCode = dbCode.replace(/categoryId:\s*categoryId,?/g, '');
  dbCode = dbCode.replace(/categoryId:\s*data\.categoryId,?/g, '');

  fs.writeFileSync(dbPath, dbCode);
  console.log("Updated server/db.ts");
}

// 2. Fix client/src/pages/ProductsPage.tsx
let prodPagePath = 'client/src/pages/ProductsPage.tsx';
if (fs.existsSync(prodPagePath)) {
  let prodPage = fs.readFileSync(prodPagePath, 'utf8');

  prodPage = prodPage.replace(/categoryId: number;\r?\n/g, '');
  prodPage = prodPage.replace(/categoryId: 0,\r?\n/g, '');
  prodPage = prodPage.replace(/const \[selectedCategory, setSelectedCategory\] = useState\("all"\);\r?\n/g, '');
  prodPage = prodPage.replace(/selectedCategory !== "all" \? Number\.parseInt\(selectedCategory, 10\) : undefined/g, '');
  prodPage = prodPage.replace(/const \{ data: categories \} = trpc\.categories\.list\.useQuery\(\);\r?\n/g, '');
  prodPage = prodPage.replace(/const categoryNameById = useMemo[\s\S]*?\[categories\]\r?\n  \);/m, '');
  prodPage = prodPage.replace(/categoryId: product\.categoryId,\r?\n/g, '');
  prodPage = prodPage.replace(/if \(\!formData\.categoryId\) \{[\s\S]*?return;\r?\n    \}/m, '');
  prodPage = prodPage.replace(/categoryId: formData\.categoryId,\r?\n/g, '');

  // Remove category select from header filter
  prodPage = prodPage.replace(/<Select value=\{selectedCategory\} onValueChange=\{setSelectedCategory\}>[\s\S]*?<\/Select>/m, '');
  
  // Remove category select from creation form
  prodPage = prodPage.replace(/<div className="space-y-2">\r?\n\s*<label className="text-sm font-display font-bold text-muted-foreground">\r?\n\s*التصنيف\r?\n\s*<\/label>\r?\n\s*<Select[\s\S]*?<\/Select>\r?\n\s*<\/div>/m, '');

  fs.writeFileSync(prodPagePath, prodPage);
  console.log("Updated client/src/pages/ProductsPage.tsx");
}

// 3. Fix usePOSData
let posDataPath = 'client/src/hooks/usePOSData.ts';
if (fs.existsSync(posDataPath)) {
  let posData = fs.readFileSync(posDataPath, 'utf8');
  posData = posData.replace(/const \{ data: categories, isLoading: categoriesLoading \} = trpc\.categories\.list\.useQuery\(\);/g, '');
  posData = posData.replace(/categories,\r?\n/g, '');
  posData = posData.replace(/categories: categories \?\? \[\],\r?\n/g, '');
  posData = posData.replace(/categoriesLoading, /g, '');
  posData = posData.replace(/isLoading: productsLoading \|\| categoriesLoading,/g, 'isLoading: productsLoading,');
  fs.writeFileSync(posDataPath, posData);
  console.log("Updated client/src/hooks/usePOSData.ts");
}

// 4. Fix offlineStore.ts
let storePath = 'client/src/stores/offlineStore.ts';
if (fs.existsSync(storePath)) {
  let storeCode = fs.readFileSync(storePath, 'utf8');
  storeCode = storeCode.replace(/categories: Category\[\];/g, '');
  storeCode = storeCode.replace(/categories: \[\]/g, '');
  storeCode = storeCode.replace(/categories:\s*any\[\];/g, '');
  storeCode = storeCode.replace(/categories:\s*any\[\],/g, '');
  storeCode = storeCode.replace(/syncCategories:\s*.*?,/g, '');
  storeCode = storeCode.replace(/syncCategories\(\)[\s\S]*?\},/g, '');
  fs.writeFileSync(storePath, storeCode);
  console.log("Updated offlineStore.ts");
}

console.log("All categories removed successfully.");
