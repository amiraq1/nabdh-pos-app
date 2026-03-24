import { eq, and, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, categories, products, stockHistory, sales, saleItems, Category, InsertCategory, Product, InsertProduct, InsertStockHistory, Sale, InsertSale, SaleItem, InsertSaleItem, User, expenses, InsertExpense } from "../drizzle/schema";
import { ENV } from './_core/env';
import fs from "fs";
import path from "path";

let _db: ReturnType<typeof drizzle> | null = null;

// ============ JSON Mock DB Logistics ============
const MOCK_DB_PATH = path.resolve(process.cwd(), "mock_db.json");

function loadMockDb() {
  if (fs.existsSync(MOCK_DB_PATH)) {
    try {
      const content = fs.readFileSync(MOCK_DB_PATH, "utf-8");
      return JSON.parse(content);
    } catch (e) {
      console.error("[MockDB] Error loading file:", e);
    }
  }
  return {
    users: [
      { id: 1, openId: "dev-mock-user", name: "المدير (وضع التطوير)", role: "admin", pin: "1234", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }
    ],
    categories: [
      { id: 1, name: "إلكترونيات", description: "أجهزة إلكترونية وجوالات", createdAt: new Date(), updatedAt: new Date() },
      { id: 2, name: "أدوات مكتبية", description: "أقلام وأوراق", createdAt: new Date(), updatedAt: new Date() }
    ],
    products: [],
    stockHistory: [],
    sales: [],
    saleItems: [],
    expenses: [],
  };
}

function saveMockDb(data: any) {
  fs.writeFileSync(MOCK_DB_PATH, JSON.stringify(data, null, 2));
}

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && ENV.databaseUrl) {
    try {
      _db = drizzle(ENV.databaseUrl);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============ Fallback Aware Handlers ============

export async function upsertUser(user: InsertUser): Promise<void> {
  const db = await getDb();
  if (db) {
    // Real DB Logic
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    textFields.forEach(field => {
       if (user[field] !== undefined) {
          values[field] = user[field];
          updateSet[field] = user[field];
       }
    });
    if (user.lastSignedIn) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role) { values.role = user.role; updateSet.role = user.role; }
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } else {
    // Mock DB Logic
    const data = loadMockDb();
    const existing = data.users.find((u: any) => u.openId === user.openId);
    if (existing) {
      Object.assign(existing, user, { updatedAt: new Date() });
    } else {
      const newUser = { id: data.users.length + 1, ...user, createdAt: new Date(), updatedAt: new Date() };
      data.users.push(newUser);
    }
    saveMockDb(data);
  }
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  const db = await getDb();
  if (db) {
    const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
    return result[0];
  } else {
    const data = loadMockDb();
    return data.users.find((u: any) => u.openId === openId);
  }
}

export async function getUserByPin(pin: string): Promise<User | undefined> {
  const db = await getDb();
  if (db) {
    const result = await db.select().from(users).where(eq(users.pin, pin)).limit(1);
    return result[0];
  } else {
    const data = loadMockDb();
    return data.users.find((u: any) => u.pin === pin);
  }
}

// ============ Categories Queries ============
export async function getCategories() {
  const db = await getDb();
  if (db) return db.select().from(categories).orderBy(categories.name);
  return loadMockDb().categories;
}

export async function getCategoryById(id: number) {
  const db = await getDb();
  if (db) {
    const result = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
    return result[0];
  }
  return loadMockDb().categories.find((c: any) => c.id === id);
}

export async function createCategory(input: InsertCategory) {
  const db = await getDb();
  if (db) {
    const [result] = await db.insert(categories).values(input);
    return { insertId: (result as any).insertId };
  }
  const data = loadMockDb();
  const newCat = { id: data.categories.length + 1, ...input, createdAt: new Date(), updatedAt: new Date() };
  data.categories.push(newCat);
  saveMockDb(data);
  return { insertId: newCat.id };
}

export async function updateCategory(id: number, input: Partial<InsertCategory>) {
  const db = await getDb();
  if (db) return db.update(categories).set(input).where(eq(categories.id, id));
  const data = loadMockDb();
  const idx = data.categories.findIndex((c: any) => c.id === id);
  if (idx !== -1) {
    data.categories[idx] = { ...data.categories[idx], ...input, updatedAt: new Date() };
    saveMockDb(data);
  }
}

export async function deleteCategory(id: number) {
  const db = await getDb();
  if (db) return db.delete(categories).where(eq(categories.id, id));
  const data = loadMockDb();
  data.categories = data.categories.filter((c: any) => c.id !== id);
  saveMockDb(data);
}

// ============ Products Queries ============
export async function getProducts(categoryId?: number) {
  const db = await getDb();
  if (db) {
    let query: any = db.select().from(products);
    if (categoryId) query = query.where(eq(products.categoryId, categoryId));
    return query.orderBy(products.name);
  }
  const data = loadMockDb();
  let list = data.products;
  if (categoryId) list = list.filter((p: any) => p.categoryId === categoryId);
  return list;
}

export async function getProductById(id: number) {
  const db = await getDb();
  if (db) {
    const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
    return result[0];
  }
  return loadMockDb().products.find((p: any) => p.id === id);
}

export async function getProductBySku(sku: string) {
  const db = await getDb();
  if (db) {
    const result = await db.select().from(products).where(eq(products.sku, sku)).limit(1);
    return result[0];
  }
  return loadMockDb().products.find((p: any) => p.sku === sku);
}

export async function getProductByBarcode(barcode: string) {
  const db = await getDb();
  if (db) {
    const result = await db.select().from(products).where(eq(products.barcode, barcode)).limit(1);
    return result[0];
  }
  return loadMockDb().products.find((p: any) => p.barcode === barcode);
}

export async function createProduct(input: InsertProduct) {
  const db = await getDb();
  if (db) {
    const [result] = await db.insert(products).values(input);
    return { insertId: (result as any).insertId };
  }
  const data = loadMockDb();
  const newProduct = { 
    id: data.products.length + 1, 
    ...input, 
    price: input.price.toString(),
    costPrice: input.costPrice?.toString() ?? null,
    createdAt: new Date(), 
    updatedAt: new Date() 
  };
  data.products.push(newProduct);
  saveMockDb(data);
  return { insertId: newProduct.id };
}

export async function updateProduct(id: number, input: Partial<InsertProduct>) {
  const db = await getDb();
  if (db) return db.update(products).set(input).where(eq(products.id, id));
  const data = loadMockDb();
  const idx = data.products.findIndex((p: any) => p.id === id);
  if (idx !== -1) {
    data.products[idx] = { ...data.products[idx], ...input, updatedAt: new Date() };
    saveMockDb(data);
  }
}

export async function deleteProduct(id: number) {
  const db = await getDb();
  if (db) return db.delete(products).where(eq(products.id, id));
  const data = loadMockDb();
  data.products = data.products.filter((p: any) => p.id !== id);
  saveMockDb(data);
}

// ============ Stock History Queries ============
export async function getStockHistory(productId: number) {
  const db = await getDb();
  if (db) return db.select().from(stockHistory).where(eq(stockHistory.productId, productId)).orderBy(stockHistory.createdAt);
  return loadMockDb().stockHistory.filter((s: any) => s.productId === productId);
}

export async function addStockHistory(input: InsertStockHistory) {
  const db = await getDb();
  if (db) {
    const [result] = await db.insert(stockHistory).values(input);
    return { insertId: (result as any).insertId };
  }
  const data = loadMockDb();
  const entry = { id: data.stockHistory.length + 1, ...input, createdAt: new Date() };
  data.stockHistory.push(entry);
  saveMockDb(data);
  return { insertId: entry.id };
}

// ============ Sales Queries ============
export async function getSales(limit = 50, offset = 0) {
  const db = await getDb();
  if (db) return db.select().from(sales).orderBy(sales.createdAt).limit(limit).offset(offset);
  return loadMockDb().sales.slice(offset, offset + limit);
}

export async function getSaleById(id: number) {
  const db = await getDb();
  if (db) {
    const result = await db.select().from(sales).where(eq(sales.id, id)).limit(1);
    return result[0];
  }
  return loadMockDb().sales.find((s: any) => s.id === id);
}

export async function getSaleByInvoiceNumber(invoiceNumber: string) {
  const db = await getDb();
  if (db) {
    const result = await db.select().from(sales).where(eq(sales.invoiceNumber, invoiceNumber)).limit(1);
    return result[0];
  }
  return loadMockDb().sales.find((s: any) => s.invoiceNumber === invoiceNumber);
}

export async function createSale(input: InsertSale) {
  const db = await getDb();
  if (db) {
    const [result] = await db.insert(sales).values(input);
    return { insertId: (result as any).insertId };
  }
  const data = loadMockDb();
  const newSale = { 
    id: data.sales.length + 1, 
    ...input, 
    totalAmount: input.totalAmount.toString(),
    finalAmount: input.finalAmount.toString(),
    createdAt: new Date(), 
    updatedAt: new Date(),
    status: 'completed'
  };
  data.sales.push(newSale);
  saveMockDb(data);
  return { insertId: newSale.id };
}

// ============ Checkout Transaction ============
export async function checkoutTransaction(
  saleInput: InsertSale,
  itemsInput: Omit<InsertSaleItem, "saleId">[]
) {
  const db = await getDb();

  if (db) {
    return await db.transaction(async tx => {
      const [saleResult] = await tx.insert(sales).values(saleInput);
      const saleId = (saleResult as any).insertId;

      for (const item of itemsInput) {
        await tx.insert(saleItems).values({ ...item, saleId });

        await tx
          .update(products)
          .set({ quantity: sql`${products.quantity} - ${item.quantity}` })
          .where(eq(products.id, item.productId));

        await tx.insert(stockHistory).values({
          productId: item.productId,
          quantityChange: -item.quantity,
          reason: "sale",
          notes: `فاتورة مبيعات رقم: ${saleInput.invoiceNumber}`,
        });
      }

      return { saleId };
    });
  }

  const data = loadMockDb();

  const newSale = {
    id: data.sales.length + 1,
    ...saleInput,
    totalAmount: saleInput.totalAmount.toString(),
    finalAmount: saleInput.finalAmount.toString(),
    createdAt: new Date(),
    updatedAt: new Date(),
    status: "completed",
  };
  data.sales.push(newSale);

  for (const item of itemsInput) {
    data.saleItems.push({
      id: data.saleItems.length + 1,
      ...item,
      saleId: newSale.id,
      unitPrice: item.unitPrice.toString(),
      subtotal: item.subtotal.toString(),
      createdAt: new Date(),
    });

    const productIdx = data.products.findIndex((p: any) => p.id === item.productId);
    if (productIdx !== -1) {
      data.products[productIdx].quantity -= item.quantity;
    }

    data.stockHistory.push({
      id: data.stockHistory.length + 1,
      productId: item.productId,
      quantityChange: -item.quantity,
      reason: "sale",
      notes: `فاتورة مبيعات رقم: ${saleInput.invoiceNumber}`,
      createdAt: new Date(),
    });
  }

  saveMockDb(data);
  return { saleId: newSale.id };
}

// ============ Sale Items Queries ============
export async function getSaleItems(saleId: number) {
  const db = await getDb();
  if (db) return db.select().from(saleItems).where(eq(saleItems.saleId, saleId));
  return loadMockDb().saleItems.filter((i: any) => i.saleId === saleId);
}

export async function addSaleItem(input: InsertSaleItem) {
  const db = await getDb();
  if (db) {
    const [result] = await db.insert(saleItems).values(input);
    return { insertId: (result as any).insertId };
  }
  const data = loadMockDb();
  const newItem = { 
    id: data.saleItems.length + 1, 
    ...input, 
    unitPrice: input.unitPrice.toString(),
    subtotal: input.subtotal.toString(),
    createdAt: new Date() 
  };
  data.saleItems.push(newItem);
  saveMockDb(data);
  return { insertId: newItem.id };
}

// ============ Analytics Queries ============
export async function getDailySalesTotal(date: Date) {
  const db = await getDb();
  let salesList = [];
  if (db) {
    const start = new Date(date); start.setHours(0,0,0,0);
    const end = new Date(date); end.setHours(23,59,59,999);
    salesList = await db.select().from(sales).where(and(gte(sales.createdAt, start), lte(sales.createdAt, end), eq(sales.status, 'completed')));
  } else {
    const data = loadMockDb();
    const dStr = date.toDateString();
    salesList = data.sales.filter((s: any) => new Date(s.createdAt).toDateString() === dStr && s.status === 'completed');
  }
  const total = salesList.reduce((sum: number, s: any) => sum + parseFloat(s.finalAmount.toString()), 0);
  return { total, count: salesList.length };
}

export async function getTopProducts(limit = 10) {
  const db = await getDb();
  let items = [];
  let productsList = [];
  if (db) {
    items = await db.select().from(saleItems);
    productsList = await db.select().from(products);
  } else {
    const data = loadMockDb();
    items = data.saleItems;
    productsList = data.products;
  }
  
  const counts: Record<number, number> = {};
  items.forEach((it: any) => counts[it.productId] = (counts[it.productId] || 0) + it.quantity);
  
  return Object.entries(counts)
    .map(([pid, qty]) => {
      const pId = parseInt(pid);
      const product = productsList.find((p: any) => p.id === pId);
      return { productId: pId, name: product?.name || `منتج ${pId}`, quantity: qty };
    })
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, limit);
}

// ============ Expenses Queries ============
export async function getExpenses() {
  const db = await getDb();
  if (db) return db.select().from(expenses).orderBy(expenses.date);
  const data = loadMockDb();
  return (data.expenses || []).map((exp: any) => ({
    ...exp,
    date: new Date(exp.date),
    createdAt: new Date(exp.createdAt)
  }));
}

export async function createExpense(input: InsertExpense) {
  const db = await getDb();
  if (db) {
    const [result] = await db.insert(expenses).values(input);
    return { insertId: (result as any).insertId };
  }
  const data = loadMockDb();
  const newExp = { 
    id: (data.expenses || []).length + 1, 
    ...input, 
    amount: input.amount.toString(),
    date: input.date instanceof Date ? input.date : new Date(),
    createdAt: new Date() 
  };
  if (!data.expenses) data.expenses = [];
  data.expenses.push(newExp);
  saveMockDb(data);
  return { insertId: newExp.id };
}

export async function deleteExpense(id: number) {
  const db = await getDb();
  if (db) return db.delete(expenses).where(eq(expenses.id, id));
  const data = loadMockDb();
  data.expenses = (data.expenses || []).filter((exp: any) => exp.id !== id);
  saveMockDb(data);
}

