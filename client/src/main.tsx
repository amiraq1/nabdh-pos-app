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
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnReconnect: false,
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
      toast.error(message, {
        className: "font-display text-destructive border-destructive font-bold",
      });
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

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
