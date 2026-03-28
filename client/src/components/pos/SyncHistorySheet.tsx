import { useState, useEffect } from "react";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription 
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  RefreshCcw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle,
  Database
} from "lucide-react";
import { getAllJobs, clearSyncedJobs, type OfflineJob } from "@/lib/offline-queue";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { useOfflineSync } from "@/hooks/useOfflineSync";

interface SyncHistorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SyncHistorySheet({ open, onOpenChange }: SyncHistorySheetProps) {
  const [jobs, setJobs] = useState<OfflineJob[]>([]);
  const { flushQueue } = useOfflineSync();
  const [isSyncing, setIsSyncing] = useState(false);

  const loadJobs = async () => {
    const allJobs = await getAllJobs();
    // Sort by date descending for the log
    setJobs(allJobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  };

  useEffect(() => {
    if (open) {
      loadJobs();
      const interval = setInterval(loadJobs, 2000);
      return () => clearInterval(interval);
    }
  }, [open]);

  const handleManualSync = async () => {
    setIsSyncing(true);
    await flushQueue();
    await loadJobs();
    setIsSyncing(false);
  };

  const handleClearHistory = async () => {
    await clearSyncedJobs();
    await loadJobs();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "synced": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "failed": return <XCircle className="h-4 w-4 text-destructive" />;
      case "processing": return <RefreshCcw className="h-4 w-4 animate-spin text-primary" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full sm:max-w-md flex flex-col gap-0 p-0">
        <SheetHeader className="p-6 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 font-display">
              <Database className="h-5 w-5" />
              سجل المزامنة
            </SheetTitle>
            <div className="flex gap-2">
               <Button 
                variant="outline" 
                size="sm" 
                onClick={handleClearHistory}
                disabled={!jobs.some(j => j.status === "synced")}
              >
                تنظيف
              </Button>
              <Button 
                size="sm" 
                onClick={handleManualSync} 
                disabled={isSyncing}
                className="gap-2"
              >
                <RefreshCcw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                مزامنة الآن
              </Button>
            </div>
          </div>
          <SheetDescription className="text-right">
            تتبع حالة العمليات التي تم تنفيذها في وضع الأوفلاين.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 p-6">
          <div className="space-y-4">
            {jobs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Database className="h-12 w-12 mx-auto mb-4 opacity-10" />
                <p>لا توجد عمليات مسجلة حالياً</p>
              </div>
            ) : (
              jobs.map((job) => (
                <div 
                  key={job.id} 
                  className="flex flex-col gap-2 p-4 rounded-xl border bg-card/50 transition-colors hover:bg-accent/5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2 overflow-hidden">
                      {getStatusIcon(job.status)}
                      <span className="font-medium truncate text-sm">
                        {job.type === 'checkout' ? `فاتورة #${job.id}` : job.type}
                      </span>
                    </div>
                    <Badge variant={job.status === 'synced' ? 'secondary' : job.status === 'failed' ? 'destructive' : 'outline'} className="capitalize">
                      {job.status === 'synced' ? 'تمت' : job.status === 'failed' ? 'فشلت' : 'معلقة'}
                    </Badge>
                  </div>
                  
                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <span>{format(new Date(job.createdAt), "do MMMM, HH:mm", { locale: ar })}</span>
                    {job.retryCount > 0 && (
                      <span className="flex items-center gap-1 text-orange-500">
                        <AlertCircle className="h-3 w-3" />
                        محاولات: {job.retryCount}
                      </span>
                    )}
                  </div>

                  {job.error && job.status === 'failed' && (
                    <div className="mt-2 p-2 rounded bg-destructive/5 text-[10px] text-destructive font-mono break-words border border-destructive/10">
                      {job.error}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
