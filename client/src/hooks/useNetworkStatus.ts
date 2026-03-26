import { useEffect, useRef } from "react";
import { useOfflineStore } from "@/stores/offlineStore";

/**
 * Hook that monitors navigator.onLine and sets the offline store status.
 * Also triggers sync when coming back online.
 */
export function useNetworkStatus(onReconnect?: () => void) {
  const { status, setStatus, pendingCount } = useOfflineStore();
  const onReconnectRef = useRef(onReconnect);
  onReconnectRef.current = onReconnect;

  useEffect(() => {
    const handleOnline = () => {
      setStatus("online");
      onReconnectRef.current?.();
    };

    const handleOffline = () => {
      setStatus("offline");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Set initial state
    setStatus(navigator.onLine ? "online" : "offline");

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [setStatus]);

  return { status, pendingCount, isOnline: status !== "offline" };
}
