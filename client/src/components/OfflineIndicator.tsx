import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, RefreshCw, Check, CloudOff } from "lucide-react";
import { useOfflineStore, type ConnectionStatus } from "@/stores/offlineStore";
import { useEffect, useState } from "react";

const STATUS_CONFIG: Record<
  ConnectionStatus,
  {
    label: string;
    icon: typeof WifiOff;
    bg: string;
    text: string;
    pulse?: boolean;
  }
> = {
  online: {
    label: "متصل",
    icon: Check,
    bg: "bg-emerald-500/15 border-emerald-500/30",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  offline: {
    label: "غير متصل — الوضع المحلي",
    icon: CloudOff,
    bg: "bg-amber-500/15 border-amber-500/30",
    text: "text-amber-600 dark:text-amber-400",
    pulse: true,
  },
  syncing: {
    label: "جارِ المزامنة…",
    icon: RefreshCw,
    bg: "bg-blue-500/15 border-blue-500/30",
    text: "text-blue-600 dark:text-blue-400",
  },
};

export default function OfflineIndicator() {
  const { status, pendingCount } = useOfflineStore();
  const [show, setShow] = useState(false);

  // Show the indicator for offline / syncing states, or briefly when going back online
  useEffect(() => {
    if (status === "offline" || status === "syncing") {
      setShow(true);
      return;
    }

    // Show "online" briefly then auto-hide
    if (status === "online") {
      setShow(true);
      const timer = setTimeout(() => setShow(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className={`fixed top-[calc(env(safe-area-inset-top,0px)+12px)] left-1/2 -translate-x-1/2 z-[9999] 
            flex items-center gap-2.5 px-4 py-2.5 rounded-full border backdrop-blur-xl shadow-lg
            ${config.bg} ${config.text}`}
        >
          <Icon
            className={`h-4 w-4 flex-shrink-0 ${
              status === "syncing" ? "animate-spin" : ""
            } ${config.pulse ? "animate-pulse" : ""}`}
          />
          <span className="text-xs font-display font-bold whitespace-nowrap">
            {config.label}
          </span>
          {pendingCount > 0 && status !== "online" && (
            <span
              className="flex items-center justify-center min-w-[20px] h-5 px-1.5 
              rounded-full bg-current/15 text-[10px] font-bold"
            >
              {pendingCount}
            </span>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
