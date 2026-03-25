import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

const queryClient = new QueryClient();

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
    redirectToLoginIfUnauthorized(error);
    if (error?.message && !error.message.includes(UNAUTHED_ERR_MSG)) {
      toast.error(`فشل جلب البيانات: ${error.message}`, { className: "font-display text-destructive border-destructive font-bold" });
    }
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error as Error;
    redirectToLoginIfUnauthorized(error);
    if (error?.message && !error.message.includes(UNAUTHED_ERR_MSG)) {
      toast.error(`فشلت العملية: ${error.message}`, { className: "font-display text-destructive border-destructive font-bold" });
    }
    console.error("[API Mutation Error]", error);
  }
});

import { Capacitor } from '@capacitor/core';

const EMULATOR_API_URL = "http://10.0.2.2:3000";

const getBaseUrl = () => {
  const configuredUrl = import.meta.env.VITE_API_URL?.trim() || "";

  if (typeof window === "undefined") {
    return configuredUrl;
  }

  const isCapacitorOrigin =
    window.location.origin.includes("localhost") && !window.location.port;
  const isNativeRuntime = isCapacitorOrigin || Capacitor.isNativePlatform();

  // Browser sessions already share the same Express origin as the API.
  const result = isNativeRuntime ? configuredUrl || EMULATOR_API_URL : "";

  console.log(`[TRPC] Base: ${result || 'relative'} | Origin: ${window.location.origin}`);
  return result;
};

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
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
