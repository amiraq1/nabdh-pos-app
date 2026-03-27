import { useState, useEffect } from "react";
import { Network } from "@capacitor/network";
import { toast } from "sonner";

/**
 * Stage 1: Smart Network Monitoring Hook (Note 4)
 * Tracks connectivity and provides real-time state.
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    let unregister: (() => void) | undefined;

    const setupListener = async () => {
      // 1. Initial Status
      const status = await Network.getStatus();
      setIsOnline(status.connected);

      // 2. Continuous Listener
      const listener = await Network.addListener("networkStatusChange", (newStatus) => {
        setIsOnline(newStatus.connected);
        
        if (newStatus.connected) {
          toast.success("عادت الشبكة! جاري مزامنة البيانات...", { duration: 3000 });
        } else {
          toast.warning("أنت أوفلاين حالياً. يمكنك الاستمرار في البيع.", { duration: 5000 });
        }
      });

      unregister = () => {
        void listener.remove();
      };
    };

    void setupListener();

    return () => {
      if (unregister) unregister();
    };
  }, []);

  return { isOnline };
}
