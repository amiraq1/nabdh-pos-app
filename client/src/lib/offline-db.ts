/**
 * Nabdh POS — Offline Database (IndexedDB)
 *
 * Stores:
 *   products   — full mirror of server products for offline reads
 *   categories — full mirror of server categories
 *   syncQueue  — pending mutations (sales, expenses, etc.) awaiting network
 *   meta       — timestamps for stale-while-revalidate logic
 */

const DB_NAME = "nabdh-pos-offline";
const DB_VERSION = 1;

const STORE = {
  PRODUCTS: "products",
  CATEGORIES: "categories",
  SYNC_QUEUE: "syncQueue",
  META: "meta",
} as const;

// ---------------------------------------------------------------------------
// DB Lifecycle
// ---------------------------------------------------------------------------

let _db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE.PRODUCTS)) {
        const ps = db.createObjectStore(STORE.PRODUCTS, { keyPath: "id" });
        ps.createIndex("categoryId", "categoryId", { unique: false });
        ps.createIndex("sku", "sku", { unique: false });
        ps.createIndex("barcode", "barcode", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE.CATEGORIES)) {
        db.createObjectStore(STORE.CATEGORIES, { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains(STORE.SYNC_QUEUE)) {
        const sq = db.createObjectStore(STORE.SYNC_QUEUE, {
          keyPath: "id",
          autoIncrement: true,
        });
        sq.createIndex("status", "status", { unique: false });
        sq.createIndex("createdAt", "createdAt", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE.META)) {
        db.createObjectStore(STORE.META, { keyPath: "key" });
      }
    };

    request.onsuccess = () => {
      _db = request.result;

      _db.onclose = () => {
        _db = null;
      };

      resolve(_db);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

// ---------------------------------------------------------------------------
// Generic Helpers
// ---------------------------------------------------------------------------

async function tx(
  storeName: string,
  mode: IDBTransactionMode,
): Promise<IDBObjectStore> {
  const db = await openDB();
  return db.transaction(storeName, mode).objectStore(storeName);
}

function req<T>(idbRequest: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    idbRequest.onsuccess = () => resolve(idbRequest.result);
    idbRequest.onerror = () => reject(idbRequest.error);
  });
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export async function cacheProducts(products: any[]): Promise<void> {
  const store = await tx(STORE.PRODUCTS, "readwrite");
  const txn = store.transaction;

  await new Promise<void>((resolve, reject) => {
    // Clear existing, then re-populate
    const clearReq = store.clear();
    clearReq.onsuccess = () => {
      for (const product of products) {
        store.put(product);
      }
    };
    clearReq.onerror = () => reject(clearReq.error);
    txn.oncomplete = () => resolve();
    txn.onerror = () => reject(txn.error);
  });

  await setMeta("products_updated", Date.now());
}

export async function getCachedProducts(
  categoryId?: number,
): Promise<any[]> {
  const store = await tx(STORE.PRODUCTS, "readonly");

  if (categoryId !== undefined) {
    const index = store.index("categoryId");
    return req(index.getAll(categoryId));
  }

  return req(store.getAll());
}

export async function getCachedProductByBarcode(
  barcode: string,
): Promise<any | undefined> {
  const store = await tx(STORE.PRODUCTS, "readonly");
  const index = store.index("barcode");
  const results = await req(index.getAll(barcode));
  return results[0];
}

export async function getCachedProductBySku(
  sku: string,
): Promise<any | undefined> {
  const store = await tx(STORE.PRODUCTS, "readonly");
  const index = store.index("sku");
  const results = await req(index.getAll(sku));
  return results[0];
}

/**
 * Deduct quantity from a cached product after an offline sale.
 * This keeps the local "virtual stock" accurate between syncs.
 */
export async function deductCachedProductQuantity(
  productId: number,
  quantitySold: number,
): Promise<void> {
  const store = await tx(STORE.PRODUCTS, "readwrite");
  const product = await req(store.get(productId));
  if (!product) return;

  product.quantity = Math.max(0, (product.quantity ?? 0) - quantitySold);
  await req(store.put(product));
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function cacheCategories(categories: any[]): Promise<void> {
  const store = await tx(STORE.CATEGORIES, "readwrite");
  const txn = store.transaction;

  await new Promise<void>((resolve, reject) => {
    const clearReq = store.clear();
    clearReq.onsuccess = () => {
      for (const cat of categories) {
        store.put(cat);
      }
    };
    clearReq.onerror = () => reject(clearReq.error);
    txn.oncomplete = () => resolve();
    txn.onerror = () => reject(txn.error);
  });

  await setMeta("categories_updated", Date.now());
}

export async function getCachedCategories(): Promise<any[]> {
  const store = await tx(STORE.CATEGORIES, "readonly");
  return req(store.getAll());
}

// ---------------------------------------------------------------------------
// Sync Queue
// ---------------------------------------------------------------------------

export interface SyncQueueItem {
  id?: number;
  type: "checkout" | "expense" | "sale";
  payload: any;
  idempotencyKey: string;
  status: "pending" | "syncing" | "failed";
  attempts: number;
  createdAt: number;
  lastAttemptAt?: number;
  error?: string;
}

const MAX_QUEUE_SIZE = 500;

export async function addToSyncQueue(
  item: Omit<SyncQueueItem, "id" | "status" | "attempts" | "createdAt">,
): Promise<number> {
  const store = await tx(STORE.SYNC_QUEUE, "readwrite");

  // Check queue size
  const count = await req(store.count());
  if (count >= MAX_QUEUE_SIZE) {
    throw new Error("وصل عدد العمليات المعلقة للحد الأقصى. يرجى المزامنة أولاً.");
  }

  const entry: Omit<SyncQueueItem, "id"> = {
    ...item,
    status: "pending",
    attempts: 0,
    createdAt: Date.now(),
  };

  const id = await req(store.add(entry));
  return id as number;
}

export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  const store = await tx(STORE.SYNC_QUEUE, "readonly");
  const index = store.index("status");
  return req(index.getAll("pending"));
}

export async function getAllSyncItems(): Promise<SyncQueueItem[]> {
  const store = await tx(STORE.SYNC_QUEUE, "readonly");
  return req(store.getAll());
}

export async function updateSyncItem(
  id: number,
  updates: Partial<SyncQueueItem>,
): Promise<void> {
  const store = await tx(STORE.SYNC_QUEUE, "readwrite");
  const existing = await req(store.get(id));
  if (!existing) return;

  const updated = { ...existing, ...updates };
  await req(store.put(updated));
}

export async function removeSyncItem(id: number): Promise<void> {
  const store = await tx(STORE.SYNC_QUEUE, "readwrite");
  await req(store.delete(id));
}

export async function clearCompletedSyncItems(): Promise<void> {
  const store = await tx(STORE.SYNC_QUEUE, "readwrite");
  const all: SyncQueueItem[] = await req(store.getAll());

  for (const item of all) {
    if (item.status !== "pending" && item.status !== "syncing") {
      store.delete(item.id!);
    }
  }
}

export async function getSyncQueueCount(): Promise<number> {
  const store = await tx(STORE.SYNC_QUEUE, "readonly");
  return req(store.count());
}

// ---------------------------------------------------------------------------
// Meta (timestamps, etc.)
// ---------------------------------------------------------------------------

async function setMeta(key: string, value: any): Promise<void> {
  const store = await tx(STORE.META, "readwrite");
  await req(store.put({ key, value }));
}

export async function getMeta(key: string): Promise<any | undefined> {
  const store = await tx(STORE.META, "readonly");
  const result = await req(store.get(key));
  return result?.value;
}

// ---------------------------------------------------------------------------
// Data Freshness Check
// ---------------------------------------------------------------------------

const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export async function isDataStale(
  dataKey: "products_updated" | "categories_updated",
): Promise<boolean> {
  const lastUpdated = await getMeta(dataKey);
  if (!lastUpdated) return true;

  return Date.now() - lastUpdated > STALE_THRESHOLD_MS;
}

export async function hasAnyCachedData(): Promise<boolean> {
  const store = await tx(STORE.PRODUCTS, "readonly");
  const count = await req(store.count());
  return count > 0;
}
