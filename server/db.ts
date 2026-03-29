import { eq, and, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { InsertUser, users, products, stockHistory, sales, saleItems, Product, InsertProduct, InsertStockHistory, Sale, InsertSale, SaleItem, InsertSaleItem, User, expenses, InsertExpense } from "../drizzle/schema";
import bcrypt from "bcryptjs";
import { ENV } from './_core/env';
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";

let _db: ReturnType<typeof drizzle> | null = null;

// ============ JSON Mock DB Logistics ============
const MOCK_DB_PATH = path.resolve(process.cwd(), "mock_db.json");
const PRODUCT_TRACKING_PREFIX = "PRD-";

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

function formatProductTrackingCode(sequence: number) {
  return `${PRODUCT_TRACKING_PREFIX}${String(sequence).padStart(5, "0")}`;
}

function normalizeNonNegativeInteger(value: unknown, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function sanitizeOptionalText(value: unknown) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized ? normalized : undefined;
}

function sanitizeRequiredText(value: unknown) {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim();
}

function sanitizeOptionalNumberText(value: unknown) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized ? normalized : undefined;
}

function sanitizeProductInput(input: InsertProduct): InsertProduct;
function sanitizeProductInput(input: Partial<InsertProduct>): Partial<InsertProduct>;
function sanitizeProductInput(input: Partial<InsertProduct>) {
  const sanitized = {
    ...input,
    name: input.name === undefined ? input.name : sanitizeRequiredText(input.name),
    description: sanitizeOptionalText(input.description),
    sku: input.sku ? input.sku.trim().toUpperCase() : input.sku,
    barcode: sanitizeOptionalText(input.barcode),
    price: input.price === undefined ? input.price : sanitizeRequiredText(input.price),
    costPrice: sanitizeOptionalNumberText(input.costPrice),
    imageUrl: sanitizeOptionalText(input.imageUrl),
    quantity:
      input.quantity === undefined
        ? input.quantity
        : normalizeNonNegativeInteger(input.quantity, 0),
    minStockLevel:
      input.minStockLevel === undefined
        ? input.minStockLevel
        : normalizeNonNegativeInteger(input.minStockLevel, 10),
  };

  return sanitized as InsertProduct | Partial<InsertProduct>;
}

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && ENV.databaseUrl) {
    try {
      const client = postgres(ENV.databaseUrl, { prepare: false });
      _db = drizzle(client);
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
    await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet });
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
  const sanitizedPin = sanitizePin(pin);
  
  let allUsers: User[] = [];
  if (db) {
    allUsers = await db.select().from(users);
  } else {
    const data = loadMockDb();
    allUsers = data.users;
  }

  for (const user of allUsers) {
    if (user.pin && bcrypt.compareSync(sanitizedPin, user.pin)) {
      return user;
    }
  }
  return undefined;
}

export async function getUserById(id: number): Promise<User | undefined> {
  const db = await getDb();
  if (db) {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  const data = loadMockDb();
  return data.users.find((user: any) => user.id === id);
}

function sanitizePin(pin: string) {
  return pin.replace(/\D+/g, "").slice(0, 4);
}

async function assertPinAvailable(pin: string, excludeUserId?: number) {
  const normalizedPin = sanitizePin(pin);

  if (normalizedPin.length !== 4) {
    throw new Error("رمز الدخول يجب أن يتكون من 4 أرقام");
  }

  const db = await getDb();

  if (db) {
    const matches = await db.select().from(users).where(eq(users.pin, normalizedPin));
    const conflict = matches.find(user => user.id !== excludeUserId);

    if (conflict) {
      throw new Error("رمز الدخول مستخدم من حساب آخر");
    }
  } else {
    const data = loadMockDb();
    const conflict = data.users.find(
      (user: any) => user.pin === normalizedPin && user.id !== excludeUserId
    );

    if (conflict) {
      throw new Error("رمز الدخول مستخدم من حساب آخر");
    }
  }

  return normalizedPin;
}

export async function updateUserProfile(id: number, input: Pick<InsertUser, "name">) {
  const name = sanitizeRequiredText(input.name);

  if (!name) {
    throw new Error("اسم المستخدم مطلوب");
  }

  const db = await getDb();
  if (db) {
    await db.update(users).set({ name }).where(eq(users.id, id));
    return getUserById(id);
  }

  const data = loadMockDb();
  const existingUser = data.users.find((user: any) => user.id === id);

  if (!existingUser) {
    throw new Error("المستخدم غير موجود");
  }

  existingUser.name = name;
  existingUser.updatedAt = new Date();
  saveMockDb(data);

  return existingUser;
}

export async function updateUserPin(id: number, currentPin: string, nextPin: string) {
  const sanitizedCurrentPin = sanitizePin(currentPin);
  const sanitizedNextPin = sanitizePin(nextPin);

  if (sanitizedCurrentPin === sanitizedNextPin) {
    throw new Error("الرمز الجديد يجب أن يكون مختلفًا عن الحالي");
  }

  const existingUser = await getUserById(id);

  if (!existingUser) {
    throw new Error("المستخدم غير موجود");
  }

  if (!existingUser.pin || !bcrypt.compareSync(sanitizedCurrentPin, existingUser.pin)) {
    throw new Error("رمز الدخول الحالي غير صحيح");
  }

  const hashedNextPin = bcrypt.hashSync(sanitizedNextPin, 10);

  const db = await getDb();
  if (db) {
    await db.update(users).set({ pin: hashedNextPin }).where(eq(users.id, id));
    return { success: true } as const;
  }

  const data = loadMockDb();
  const userIndex = data.users.findIndex((user: any) => user.id === id);

  if (userIndex === -1) {
    throw new Error("المستخدم غير موجود");
  }

  data.users[userIndex].pin = hashedNextPin;
  data.users[userIndex].updatedAt = new Date();
  saveMockDb(data);

  return { success: true } as const;
}

export async function getUsers() {
  const db = await getDb();
  const rolePriority = {
    admin: 0,
    cashier: 1,
    user: 2,
  } as const;

  const sortUsers = (items: User[]) =>
    [...items].sort((left, right) => {
      const roleDiff = rolePriority[left.role] - rolePriority[right.role];

      if (roleDiff !== 0) {
        return roleDiff;
      }

      return (left.name ?? "").localeCompare(right.name ?? "", "ar");
    });

  if (db) {
    const items = await db.select().from(users);
    return sortUsers(items);
  }

  const data = loadMockDb();
  return sortUsers(data.users as User[]);
}

export async function createManagedUser(
  input: Pick<InsertUser, "name" | "role"> & { pin: string; email?: string }
) {
  const name = sanitizeRequiredText(input.name);

  if (!name) {
    throw new Error("اسم المستخدم مطلوب");
  }

  const pin = await assertPinAvailable(input.pin);
  const hashedPin = bcrypt.hashSync(pin, 10);
  const email = sanitizeOptionalText(input.email);
  const payload: InsertUser = {
    openId: `local-${randomUUID()}`,
    name,
    role: input.role,
    pin: hashedPin,
    email,
    loginMethod: "pin",
  };

  const db = await getDb();

  if (db) {
    const [result] = await db.insert(users).values(payload);
    return getUserById((result as any).insertId);
  }

  const data = loadMockDb();
  const nextUserId = getNextId(data.users);

  const newUser = {
    id: nextUserId,
    ...payload,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  data.users.push(newUser);
  saveMockDb(data);

  return newUser;
}

export async function updateManagedUser(
  id: number,
  input: Partial<Pick<InsertUser, "name" | "role">> & { pin?: string; email?: string }
) {
  const existingUser = await getUserById(id);

  if (!existingUser) {
    throw new Error("المستخدم غير موجود");
  }

  const updateSet: Partial<InsertUser> = {};

  if (input.name !== undefined) {
    const name = sanitizeRequiredText(input.name);

    if (!name) {
      throw new Error("اسم المستخدم مطلوب");
    }

    updateSet.name = name;
  }

  if (input.role !== undefined) {
    updateSet.role = input.role;
  }

  if (input.email !== undefined) {
    updateSet.email = sanitizeOptionalText(input.email);
  }

  if (input.pin !== undefined) {
    const pin = await assertPinAvailable(input.pin, id);
    updateSet.pin = bcrypt.hashSync(pin, 10);
  }

  const db = await getDb();

  if (db) {
    await db.update(users).set(updateSet).where(eq(users.id, id));
    return getUserById(id);
  }

  const data = loadMockDb();
  const userIndex = data.users.findIndex((user: any) => user.id === id);

  if (userIndex === -1) {
    throw new Error("المستخدم غير موجود");
  }

  data.users[userIndex] = {
    ...data.users[userIndex],
    ...updateSet,
    updatedAt: new Date(),
  };
  saveMockDb(data);

  return data.users[userIndex];
}

// ============ Products Queries ============
export async function getProducts() {
  const db = await getDb();
  if (db) {
    let query: any = db.select().from(products);
    return query.orderBy(products.name);
  }
  const data = loadMockDb();
  let list = data.products;
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

export async function getNextProductTrackingCode() {
  const db = await getDb();

  if (db) {
    const result = await db
      .select({
        maxId: sql<number>`coalesce(max(${products.id}), 0)`,
      })
      .from(products);

    const nextSequence = (Number(result[0]?.maxId ?? 0) || 0) + 1;
    return formatProductTrackingCode(nextSequence);
  }

  const data = loadMockDb();
  const nextSequence =
    data.products.reduce((maxId: number, product: any) => {
      const currentId = Number(product.id) || 0;
      return currentId > maxId ? currentId : maxId;
    }, 0) + 1;

  return formatProductTrackingCode(nextSequence);
}

export async function createProduct(input: InsertProduct) {
  const nextTrackingCode = await getNextProductTrackingCode();
  const sanitizedInput = sanitizeProductInput({
    ...input,
    sku: input.sku?.trim() || nextTrackingCode,
  });
  const db = await getDb();
  if (db) {
    const [result] = await db.insert(products).values(sanitizedInput);
    return { insertId: (result as any).insertId };
  }
  const data = loadMockDb();
  const nextProductId = getNextId(data.products);
  const newProduct = { 
    id: nextProductId, 
    ...sanitizedInput, 
    price: sanitizedInput.price?.toString() ?? "0",
    costPrice: sanitizedInput.costPrice?.toString() ?? null,
    createdAt: new Date(), 
    updatedAt: new Date() 
  };
  data.products.push(newProduct);
  saveMockDb(data);
  return { insertId: newProduct.id };
}

export async function updateProduct(id: number, input: Partial<InsertProduct>) {
  const sanitizedInput = sanitizeProductInput(input);
  const db = await getDb();
  if (db) return db.update(products).set(sanitizedInput).where(eq(products.id, id));
  const data = loadMockDb();
  const idx = data.products.findIndex((p: any) => p.id === id);
  if (idx !== -1) {
    data.products[idx] = { ...data.products[idx], ...sanitizedInput, updatedAt: new Date() };
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
  const entry = { id: getNextId(data.stockHistory), ...input, createdAt: new Date() };
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
    id: getNextId(data.sales), 
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
    id: getNextId(data.sales),
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
      id: getNextId(data.saleItems),
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
      id: getNextId(data.stockHistory),
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
    id: getNextId(data.saleItems), 
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
    id: getNextId(data.expenses || []), 
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

function getNextId(items: Array<{ id: unknown }>) {
  return items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
}
