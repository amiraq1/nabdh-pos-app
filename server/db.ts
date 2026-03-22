import { eq, and, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, categories, products, stockHistory, sales, saleItems, Category, InsertCategory, Product, InsertProduct, InsertStockHistory, Sale, InsertSale, SaleItem, InsertSaleItem } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ============ Categories Queries ============
export async function getCategories() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(categories).orderBy(categories.name);
}

export async function getCategoryById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  return result[0];
}

export async function createCategory(data: InsertCategory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(categories).values(data);
  return result;
}

export async function updateCategory(id: number, data: Partial<InsertCategory>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(categories).set(data).where(eq(categories.id, id));
}

export async function deleteCategory(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(categories).where(eq(categories.id, id));
}

// ============ Products Queries ============
export async function getProducts(categoryId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  let query: any = db.select().from(products);
  if (categoryId) {
    query = query.where(eq(products.categoryId, categoryId));
  }
  return query.orderBy(products.name);
}

export async function getProductById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return result[0];
}

export async function getProductBySku(sku: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(products).where(eq(products.sku, sku)).limit(1);
  return result[0];
}

export async function getProductByBarcode(barcode: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(products).where(eq(products.barcode, barcode)).limit(1);
  return result[0];
}

export async function createProduct(data: InsertProduct) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(products).values(data);
  return result;
}

export async function updateProduct(id: number, data: Partial<InsertProduct>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(products).set(data).where(eq(products.id, id));
}

export async function deleteProduct(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(products).where(eq(products.id, id));
}

// ============ Stock History Queries ============
export async function getStockHistory(productId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(stockHistory).where(eq(stockHistory.productId, productId)).orderBy(stockHistory.createdAt);
}

export async function addStockHistory(data: InsertStockHistory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(stockHistory).values(data);
}

// ============ Sales Queries ============
export async function getSales(limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sales).orderBy(sales.createdAt).limit(limit).offset(offset);
}

export async function getSaleById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(sales).where(eq(sales.id, id)).limit(1);
  return result[0];
}

export async function getSaleByInvoiceNumber(invoiceNumber: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(sales).where(eq(sales.invoiceNumber, invoiceNumber)).limit(1);
  return result[0];
}

export async function createSale(data: InsertSale) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(sales).values(data);
}

export async function updateSale(id: number, data: Partial<InsertSale>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(sales).set(data).where(eq(sales.id, id));
}

// ============ Sale Items Queries ============
export async function getSaleItems(saleId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(saleItems).where(eq(saleItems.saleId, saleId));
}

export async function addSaleItem(data: InsertSaleItem) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(saleItems).values(data);
}

// ============ Analytics Queries ============
export async function getDailySalesTotal(date: Date) {
  const db = await getDb();
  if (!db) return { total: 0, count: 0 };
  
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  const dailySales = await db.select().from(sales)
    .where(
      and(
        gte(sales.createdAt, startOfDay),
        lte(sales.createdAt, endOfDay),
        eq(sales.status, 'completed')
      )
    );
  
  const total = dailySales.reduce((sum, sale) => sum + parseFloat(sale.finalAmount.toString()), 0);
  return { total, count: dailySales.length };
}

export async function getTopProducts(limit = 10) {
  const db = await getDb();
  if (!db) return [];
  
  const allSaleItems = await db.select().from(saleItems);
  const productCounts: Record<number, { quantity: number; productId: number }> = {};
  
  allSaleItems.forEach(item => {
    if (!productCounts[item.productId]) {
      productCounts[item.productId] = { quantity: 0, productId: item.productId };
    }
    productCounts[item.productId].quantity += item.quantity;
  });
  
  return Object.values(productCounts)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, limit);
}
