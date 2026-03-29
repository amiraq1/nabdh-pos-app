import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useOfflineStore } from "@/stores/offlineStore";
import { getCachedProducts } from "@/lib/offline-db";

export function usePOSData() {
  const offlineStatus = useOfflineStore((s) => s.status);
  const isOffline = offlineStatus === "offline";
  
  const productsQuery = trpc.products.list.useQuery();

  const [offlineProducts, setOfflineProducts] = useState<any[] | null>(null);

  useEffect(() => {
    if (productsQuery.isError || (isOffline && !productsQuery.data)) {
      getCachedProducts().then(setOfflineProducts).catch(() => {});
    } else {
      setOfflineProducts(null);
    }
  }, [productsQuery.isError, isOffline, productsQuery.data]);

  const products = productsQuery.data ?? offlineProducts ?? undefined;
  const productsLoading = productsQuery.isLoading && !offlineProducts;

  return { products, productsLoading, isOffline };
}
