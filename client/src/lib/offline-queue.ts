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

export async function getPendingJobs(): Promise<OfflineJob[]> {
  const all: OfflineJob[] = (await get(QUEUE_KEY)) || [];
  // Oldest first for deterministic ordering (Note 8)
  return all
    .filter(j => j.status === "pending" || j.status === "failed")
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
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
