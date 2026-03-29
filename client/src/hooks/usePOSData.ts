import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useOfflineStore } from "@/stores/offlineStore";
import { getCachedProducts, getCachedCategories } from "@/lib/offline-db";

export function usePOSData() {
  const offlineStatus = useOfflineStore((s) => s.status);
  const isOffline = offlineStatus === "offline";
  
  const productsQuery = trpc.products.list.useQuery();
  const categoriesQuery = trpc.categories.list.useQuery();

  const [offlineProducts, setOfflineProducts] = useState<any[] | null>(null);
  const [offlineCategories, setOfflineCategories] = useState<any[] | null>(null);

  useEffect(() => {
    if (productsQuery.isError || (isOffline && !productsQuery.data)) {
      getCachedProducts().then(setOfflineProducts).catch(() => {});
    } else {
      setOfflineProducts(null);
    }
  }, [productsQuery.isError, isOffline, productsQuery.data]);

  useEffect(() => {
    if (categoriesQuery.isError || (isOffline && !categoriesQuery.data)) {
      getCachedCategories().then(setOfflineCategories).catch(() => {});
    } else {
      setOfflineCategories(null);
    }
  }, [categoriesQuery.isError, isOffline, categoriesQuery.data]);

  const products = productsQuery.data ?? offlineProducts ?? undefined;
  const categories = categoriesQuery.data ?? offlineCategories ?? [];
  
  const productsLoading = productsQuery.isLoading && !offlineProducts;
  const categoriesLoading = categoriesQuery.isLoading && !offlineCategories;

  return { products, categories, productsLoading, categoriesLoading, isOffline };
}
