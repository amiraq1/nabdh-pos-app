import { useEffect, useCallback, useRef } from "react";
import { Network, type ConnectionStatus } from "@capacitor/network";
import { trpc } from "@/lib/trpc";
import { getJobsToSync, markJobStatus } from "@/lib/offline-queue";
import { toast } from "sonner";

/**
 * Stage 3.2: The Hardened Sync Engine (Note 1 - 8)
 * Robust background synchronization with conflict awareness.
 */
export function useOfflineSync() {
  const utils = trpc.useUtils();
  const checkoutMutation = trpc.sales.checkout.useMutation();
  const isFlushingRef = useRef(false);

  const flushQueue = useCallback(async () => {
    if (isFlushingRef.current) return;
    
    const jobs = await getJobsToSync();
    if (jobs.length === 0) return;

    isFlushingRef.current = true;
    let syncedCount = 0;
    let failedCount = 0;

    try {
      console.log(`Sync Engine: Processing ${jobs.length} jobs...`);
      
      for (const job of jobs) {
        try {
          if (job.type === "checkout") {
            // Update UI status to 'processing' before starting
            await markJobStatus(job.id, "processing");
            
            await checkoutMutation.mutateAsync(job.payload);
            await markJobStatus(job.id, "synced");
            syncedCount += 1;
          }
        } catch (error: any) {
          const isNetworkError = /fetch failed|NetworkError|ERR_CONNECTION|ERR_NETWORK|API_REQUEST_TIMEOUT|Failed to fetch/i.test(
            error?.message || ""
          );

          if (isNetworkError) {
            // Put it back to failed to be retried by Exponential Backoff
            await markJobStatus(job.id, "failed", "Network Unreachable");
            console.warn(`Sync Paused: Network issue.`);
            break; 
          } else {
            // Permanent failure or conflict
            console.error(`Sync Conflict: Job ${job.id} failed`, error);
            await markJobStatus(job.id, "failed", error?.message || "Internal Failure");
            failedCount += 1;
          }
        }
      }

      if (syncedCount > 0) {
        await Promise.all([
          utils.products.list.invalidate(),
          utils.sales.list.invalidate(),
          utils.analytics.dailyTotal.invalidate(),
          utils.analytics.topProducts.invalidate(),
        ]);
        toast.success(`تمت مزامنة ${syncedCount} عملية بنجاح! ✅`);
      }
    } finally {
      isFlushingRef.current = false;
    }
  }, [checkoutMutation, utils]);

  // Note 11: Multi-Trigger Sync
  useEffect(() => {
    let unregister: (() => void) | undefined;
    let timerId: ReturnType<typeof setInterval> | undefined;

    const setup = async () => {
      // Trigger 1: App Start
      const status = await Network.getStatus();
      if (status.connected) void flushQueue();

      // Trigger 2: Network Change
      const listener = await Network.addListener("networkStatusChange", (newStatus: ConnectionStatus) => {
        if (newStatus.connected) void flushQueue();
      });
      unregister = () => { void listener.remove(); };

      // Trigger 3: Periodic Retry (Every 30 seconds)
      timerId = setInterval(() => {
        Network.getStatus().then(s => {
          if (s.connected) void flushQueue();
        });
      }, 30000);
    };

    void setup();
    return () => { 
      if (unregister) unregister(); 
      if (timerId) clearInterval(timerId);
    };
  }, [flushQueue]);

  return { flushQueue };
}
