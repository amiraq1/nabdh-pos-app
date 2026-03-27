import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient } from "@tanstack/react-query";
import { 
  PersistQueryClientProvider 
} from "@tanstack/react-query-persist-client";
import { createIDBPersister } from "./lib/query-persister";
import { trpc, queryClient } from "./lib/trpc";
import { ThemeProvider } from "./contexts/ThemeContext";
import App from "./App";
import "./index.css";
import { Toaster } from "@/components/ui/sonner";

// Note 2: Use IndexedDB for storage (Unlimited / Robust)
const persister = createIDBPersister();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ 
        persister, 
        maxAge: 1000 * 60 * 60 * 24 * 7, // 1 Week Persistence
        buster: "v1" 
      }}
      onSuccess={() => {
        console.log("TanStack Query: Hydration Success ✅");
      }}
    >
      <trpc.Provider client={trpc.client} queryClient={queryClient}>
        <ThemeProvider>
          <App />
          <Toaster position="top-center" richColors />
        </ThemeProvider>
      </trpc.Provider>
    </PersistQueryClientProvider>
  </StrictMode>
);
