import { useEffect, useCallback, useRef } from "react";
import { Network, type ConnectionStatus } from "@capacitor/network";
import { trpc } from "@/lib/trpc";
import { getPendingJobs, markJobStatus } from "@/lib/offline-queue";
import { toast } from "sonner";

/**
 * Stage 3.2: The Hardened Sync Engine (Note 1 - 8)
 * Robust background synchronization with conflict awareness.
 */
export function useOfflineSync() {
  const utils = trpc.useUtils();
  const checkoutMutation = trpc.sales.checkout.useMutation();
  const isFlushingRef = useRef(false); // Note 2: Parallel Guard

  const flushQueue = useCallback(async () => {
    if (isFlushingRef.current) return;
    isFlushingRef.current = true;

    let syncedCount = 0;
    let failedCount = 0;

    try {
      const pendingJobs = await getPendingJobs(); // Oldest first (Note 8)
      if (pendingJobs.length === 0) return;

      console.log(`Sync Engine: Processing ${pendingJobs.length} jobs...`);
      
      for (const job of pendingJobs) {
        try {
          if (job.type === "checkout") {
            await checkoutMutation.mutateAsync(job.payload);
            await markJobStatus(job.id, "synced");
            syncedCount += 1;
            console.log(`Sync Success: Invoice ${job.id} ✅`);
          }
        } catch (error: any) {
          // Check if it's a network error (retryable) vs business error (400/500)
          const isNetworkError = /fetch failed|NetworkError|ERR_CONNECTION|ERR_NETWORK|API_REQUEST_TIMEOUT|Failed to fetch/i.test(
            error?.message || ""
          );

          if (isNetworkError) {
            // Note 3: Only interrupt on network loss
            console.warn(`Sync Paused: Network loss detected at job ${job.id}`);
            break; 
          } else {
            // Note 3: Server/Business errors shouldn't block the WHOLE queue
            console.error(`Sync Conflict: Job ${job.id} failed (Permanent)`, error);
            await markJobStatus(job.id, "failed", error?.message || "Business Logic Failure");
            failedCount += 1;
          }
        }
      }

      // Note 5: Comprehensive Invalidation
      if (syncedCount > 0) {
        await Promise.all([
          utils.products.list.invalidate(),
          utils.sales.list.invalidate(),
          utils.analytics.dailyTotal.invalidate(),
          utils.analytics.topProducts.invalidate(),
        ]);
      }

      // Note 1: Accurate Toasts
      if (syncedCount > 0) {
        if (failedCount === 0) {
          toast.success(`تمت مزامنة ${syncedCount} عملية معلقة بنجاح! ✅`);
        } else {
          toast.info(`المزامنة جزئية: نجح ${syncedCount} وفشل ${failedCount} 🔄`);
        }
      } else if (failedCount > 0) {
        toast.error(`المزامنة فشلت: ${failedCount} عمليات تحتاج تدخلاً يدوياً ❌`);
      }
    } finally {
      isFlushingRef.current = false;
    }
  }, [checkoutMutation, utils]);

  useEffect(() => {
    let unregister: (() => void) | undefined;

    const setup = async () => {
      const status = await Network.getStatus();
      if (status.connected) void flushQueue();

      const listener = await Network.addListener("networkStatusChange", (newStatus: ConnectionStatus) => {
        if (newStatus.connected) void flushQueue();
      });

      unregister = () => { void listener.remove(); }; // Note 6
    };

    void setup();
    return () => { if (unregister) unregister(); };
  }, [flushQueue]);

  return { flushQueue };
}
