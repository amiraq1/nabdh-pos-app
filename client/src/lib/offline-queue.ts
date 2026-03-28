import { get, set, update } from "idb-keyval";
import { toast } from "sonner";

export type SyncStatus = "pending" | "failed" | "synced" | "processing";

export interface OfflineJob {
  id: string; // Idempotency Key (e.g. Invoice Number)
  type: "checkout" | "expense" | "inventory";
  payload: any;
  createdAt: string;
  status: SyncStatus;
  retryCount: number;
  lastAttemptAt?: string;
  error?: string;
}

const QUEUE_KEY = "nabdh-offline-queue";

/**
 * Stage 2.5: Enhanced Offline Queue (Note 3 / 7)
 * Adds retry tracking and ordered processing.
 */
export async function enqueueOfflineJob(job: Omit<OfflineJob, "createdAt" | "status" | "retryCount">) {
  const newJob: OfflineJob = {
    ...job,
    createdAt: new Date().toISOString(),
    status: "pending",
    retryCount: 0
  };

  await update<OfflineJob[]>(QUEUE_KEY, (val) => [...(val || []), newJob]);
  toast.info("تم حفظ العملية محلياً للمزامنة لاحقاً 💾", { duration: 2500 });
}

export async function getAllJobs(): Promise<OfflineJob[]> {
  return (await get(QUEUE_KEY)) || [];
}

export async function getJobsToSync(): Promise<OfflineJob[]> {
  const all: OfflineJob[] = (await get(QUEUE_KEY)) || [];
  const now = new Date().getTime();

  // Note 10: Smart Selection (Retry Thresholds)
  return all
    .filter(j => {
      if (j.status === "synced") return false;
      if (j.status === "pending") return true; // New jobs sync immediately
      if (j.retryCount >= 10) return false; // Stop auto-retrying after 10 fails (Note 3)

      if (j.status === "failed" && j.lastAttemptAt) {
        // Simple Exponential Backoff: delay = 5s * (2^retryCount)
        const delay = Math.pow(2, j.retryCount) * 5000;
        const lastAttempt = new Date(j.lastAttemptAt).getTime();
        return now - lastAttempt > delay;
      }
      return false;
    })
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export async function clearSyncedJobs() {
  await update<OfflineJob[]>(QUEUE_KEY, (val) => (val || []).filter(j => j.status !== "synced"));
}

export async function markJobStatus(jobId: string, status: SyncStatus, error?: string) {
  await update<OfflineJob[]>(QUEUE_KEY, (val) => 
    (val || []).map(j => j.id === jobId ? { 
      ...j, 
      status, 
      error, 
      lastAttemptAt: new Date().toISOString(),
      retryCount: j.retryCount + (status === "failed" ? 1 : 0)
    } : j)
  );
}
