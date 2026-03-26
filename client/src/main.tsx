import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import superjson from "superjson";
import { UNAUTHED_ERR_MSG } from "@shared/const";
import {
  API_REQUEST_TIMEOUT_MS,
  formatApiErrorMessage,
  getBaseUrl,
} from "@/lib/api-config";
import { trpc } from "@/lib/trpc";
import {
  refreshOfflineData,
  syncPendingItems,
} from "@/stores/offlineStore";
import { cacheProducts, cacheCategories } from "@/lib/offline-db";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

// ---------------------------------------------------------------------------
// Query Client
// ---------------------------------------------------------------------------

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error as Error;
    const message = formatApiErrorMessage(error);

    redirectToLoginIfUnauthorized(error);

    if (message && !message.includes(UNAUTHED_ERR_MSG)) {
      // Don't show network errors as toasts when offline — the indicator handles it
      const isOfflineError = /OFFLINE|غير متصل/i.test(message);
      if (!isOfflineError) {
        toast.error(message, {
          className: "font-display text-destructive border-destructive font-bold",
        });
      }
    }

    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error as Error;
    const message = formatApiErrorMessage(error);

    redirectToLoginIfUnauthorized(error);

    if (message && !message.includes(UNAUTHED_ERR_MSG)) {
      toast.error(message, {
        className: "font-display text-destructive border-destructive font-bold",
      });
    }

    console.error("[API Mutation Error]", error);
  }
});

// ---------------------------------------------------------------------------
// Fetch with timeout
// ---------------------------------------------------------------------------

const fetchWithApiTimeout: typeof globalThis.fetch = async (input, init) => {
  const controller = new AbortController();
  const upstreamSignal = init?.signal;
  let timedOut = false;

  const handleUpstreamAbort = () => {
    controller.abort(upstreamSignal?.reason);
  };

  if (upstreamSignal) {
    if (upstreamSignal.aborted) {
      handleUpstreamAbort();
    } else {
      upstreamSignal.addEventListener("abort", handleUpstreamAbort, {
        once: true,
      });
    }
  }

  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, API_REQUEST_TIMEOUT_MS);

  try {
    return await globalThis.fetch(input, {
      ...(init ?? {}),
      credentials: "include",
      signal: controller.signal,
    });
  } catch (error) {
    if (timedOut) {
      throw new Error("API_REQUEST_TIMEOUT");
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
    upstreamSignal?.removeEventListener("abort", handleUpstreamAbort);
  }
};

// ---------------------------------------------------------------------------
// tRPC Client
// ---------------------------------------------------------------------------

console.log(
  `[TRPC] Base: ${getBaseUrl() || "relative"} | Origin: ${window.location.origin}`
);

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
      fetch: fetchWithApiTimeout,
    }),
  ],
});

// ---------------------------------------------------------------------------
// Offline Data Sync — Populate IndexedDB on startup & reconnect
// ---------------------------------------------------------------------------

async function initOfflineData() {
  try {
    await refreshOfflineData(
      async () => {
        const result = await trpcClient.products.list.query(undefined);
        return result as any[];
      },
      async () => {
        const result = await trpcClient.categories.list.query();
        return result as any[];
      },
    );
    console.log("[Offline] Data cached successfully");
  } catch (error) {
    console.warn("[Offline] Initial data cache failed:", error);
  }
}

async function handleReconnect() {
  console.log("[Offline] Network restored — syncing...");

  try {
    // 1. Flush pending mutations
    const result = await syncPendingItems(async (item) => {
      if (item.type === "checkout") {
        await trpcClient.sales.checkout.mutate(item.payload);
      }
    });

    if (result.synced > 0) {
      toast.success(`تمت مزامنة ${result.synced} عملية بنجاح`, {
        className: "font-display",
      });
    }

    if (result.failed > 0) {
      toast.error(`فشلت ${result.failed} عملية أثناء المزامنة`, {
        className: "font-display text-destructive",
      });
    }

    // 2. Refresh cached data
    await initOfflineData();

    // 3. Invalidate all queries to refresh UI
    queryClient.invalidateQueries();
  } catch (error) {
    console.error("[Offline] Sync failed:", error);
  }
}

// Listen for online events
window.addEventListener("online", () => {
  void handleReconnect();
});

// Initial data cache on app start
void initOfflineData();

// ---------------------------------------------------------------------------
// Intercept successful data fetches → auto-cache to IndexedDB
// ---------------------------------------------------------------------------

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "success") {
    const queryKey = event.query.queryKey as any[];
    const data = event.query.state.data;

    if (!data || !Array.isArray(queryKey)) return;

    // Auto-cache products and categories on successful fetch
    const keyStr = JSON.stringify(queryKey);
    if (keyStr.includes("products") && keyStr.includes("list") && Array.isArray(data)) {
      void cacheProducts(data);
    }
    if (keyStr.includes("categories") && keyStr.includes("list") && Array.isArray(data)) {
      void cacheCategories(data);
    }
  }
});

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
