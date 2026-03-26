import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  addToSyncQueue,
  deductCachedProductQuantity,
  getPendingSyncItems,
  removeSyncItem,
  updateSyncItem,
  getSyncQueueCount,
  type SyncQueueItem,
  cacheProducts,
  cacheCategories,
  getCachedProducts,
  getCachedCategories,
  isDataStale,
  hasAnyCachedData,
} from "@/lib/offline-db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConnectionStatus = "online" | "offline" | "syncing";

interface OfflineState {
  /** Current network/sync status */
  status: ConnectionStatus;
  /** Number of pending items waiting to be synced */
  pendingCount: number;
  /** Last successful sync timestamp */
  lastSyncedAt: number | null;
  /** Whether initial data has been loaded */
  dataReady: boolean;
  /** Sync errors from last attempt */
  lastSyncError: string | null;

  // Actions
  setStatus: (status: ConnectionStatus) => void;
  setPendingCount: (count: number) => void;
  setLastSyncedAt: (timestamp: number) => void;
  setDataReady: (ready: boolean) => void;
  setLastSyncError: (error: string | null) => void;
  refreshPendingCount: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useOfflineStore = create<OfflineState>()(
  persist(
    (set) => ({
      status: navigator.onLine ? "online" : "offline",
      pendingCount: 0,
      lastSyncedAt: null,
      dataReady: false,
      lastSyncError: null,

      setStatus: (status) => set({ status }),
      setPendingCount: (pendingCount) => set({ pendingCount }),
      setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
      setDataReady: (dataReady) => set({ dataReady }),
      setLastSyncError: (lastSyncError) => set({ lastSyncError }),

      refreshPendingCount: async () => {
        const count = await getSyncQueueCount();
        set({ pendingCount: count });
      },
    }),
    {
      name: "nabdh-offline-state",
      partialize: (state) => ({
        lastSyncedAt: state.lastSyncedAt,
      }),
    },
  ),
);

// ---------------------------------------------------------------------------
// Offline Checkout — Save sale locally when offline
// ---------------------------------------------------------------------------

export async function offlineCheckout(checkoutData: {
  invoiceNumber: string;
  totalAmount: string;
  taxAmount: string;
  discountAmount: string;
  finalAmount: string;
  paymentMethod: string;
  customerName: string;
  customerPhone: string;
  notes: string;
  items: Array<{
    productId: number;
    quantity: number;
    unitPrice: string;
    subtotal: string;
  }>;
}): Promise<{ saleId: number; offline: true }> {
  // Create a deterministic idempotency key from invoice number
  const idempotencyKey = `checkout-${checkoutData.invoiceNumber}`;

  // Add to sync queue
  const queueId = await addToSyncQueue({
    type: "checkout",
    payload: checkoutData,
    idempotencyKey,
  });

  // Deduct quantities from local cache so stock appears current
  for (const item of checkoutData.items) {
    await deductCachedProductQuantity(item.productId, item.quantity);
  }

  // Update pending count
  await useOfflineStore.getState().refreshPendingCount();

  return { saleId: queueId, offline: true };
}

// ---------------------------------------------------------------------------
// Sync Engine — Flush pending items to server when back online
// ---------------------------------------------------------------------------

type TRPCClient = {
  sales: {
    checkout: {
      mutate: (input: any) => Promise<any>;
    };
  };
};

let _syncInProgress = false;

export async function syncPendingItems(
  trpcMutate: (item: SyncQueueItem) => Promise<any>,
): Promise<{ synced: number; failed: number }> {
  if (_syncInProgress) return { synced: 0, failed: 0 };

  _syncInProgress = true;
  const store = useOfflineStore.getState();
  store.setStatus("syncing");
  store.setLastSyncError(null);

  let synced = 0;
  let failed = 0;

  try {
    const pendingItems = await getPendingSyncItems();

    for (const item of pendingItems) {
      try {
        // Mark as syncing
        await updateSyncItem(item.id!, {
          status: "syncing",
          lastAttemptAt: Date.now(),
          attempts: item.attempts + 1,
        });

        // Execute the mutation on the server
        await trpcMutate(item);

        // Remove from queue on success
        await removeSyncItem(item.id!);
        synced++;
      } catch (error: any) {
        const errorMessage =
          error?.message || "خطأ غير معروف أثناء المزامنة";

        // If it's a definitive error (not a network issue), mark as failed
        const isNetworkError =
          /fetch failed|NetworkError|ERR_CONNECTION|ERR_NETWORK|API_REQUEST_TIMEOUT/i.test(
            errorMessage,
          );

        if (isNetworkError) {
          // Revert to pending — will retry later
          await updateSyncItem(item.id!, {
            status: "pending",
            error: errorMessage,
          });
          // Stop trying more items if we lost network
          break;
        } else {
          // Permanent failure — keep in queue but mark as failed
          await updateSyncItem(item.id!, {
            status: "failed",
            error: errorMessage,
          });
          failed++;
        }
      }
    }

    if (synced > 0) {
      store.setLastSyncedAt(Date.now());
    }
  } finally {
    _syncInProgress = false;
    store.setStatus(navigator.onLine ? "online" : "offline");
    await store.refreshPendingCount();
  }

  return { synced, failed };
}

// ---------------------------------------------------------------------------
// Data Refresh — Cache products & categories from server
// ---------------------------------------------------------------------------

export async function refreshOfflineData(
  fetchProducts: () => Promise<any[]>,
  fetchCategories: () => Promise<any[]>,
  force = false,
): Promise<void> {
  const store = useOfflineStore.getState();

  try {
    const [productsStale, categoriesStale] = await Promise.all([
      isDataStale("products_updated"),
      isDataStale("categories_updated"),
    ]);

    if (force || productsStale) {
      const products = await fetchProducts();
      await cacheProducts(products);
    }

    if (force || categoriesStale) {
      const categories = await fetchCategories();
      await cacheCategories(categories);
    }

    store.setDataReady(true);
  } catch (error) {
    // If we fail to fetch but have cached data, that's OK
    const hasCached = await hasAnyCachedData();
    if (hasCached) {
      store.setDataReady(true);
    }

    console.warn("[Offline] Data refresh failed, using cache:", error);
  }
}

// ---------------------------------------------------------------------------
// Offline Data Getters (for direct use in components)
// ---------------------------------------------------------------------------

export { getCachedProducts, getCachedCategories };
