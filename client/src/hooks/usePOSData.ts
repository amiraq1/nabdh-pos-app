import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useOfflineStore } from "@/stores/offlineStore";
import { getCachedProducts, getCachedCategories } from "@/lib/offline-db";

export function usePOSData(selectedCategory: string) {
  const offlineStatus = useOfflineStore((s) => s.status);
  const isOffline = offlineStatus === "offline";
  
  const categoryId = selectedCategory !== "all" ? parseInt(selectedCategory, 10) : undefined;
  
  const productsQuery = trpc.products.list.useQuery(categoryId);
  const categoriesQuery = trpc.categories.list.useQuery();

  const [offlineProducts, setOfflineProducts] = useState<any[] | null>(null);
  const [offlineCategories, setOfflineCategories] = useState<any[] | null>(null);

  useEffect(() => {
    if (productsQuery.isError || (isOffline && !productsQuery.data)) {
      getCachedProducts(categoryId).then(setOfflineProducts).catch(() => {});
    } else {
      setOfflineProducts(null);
    }
  }, [productsQuery.isError, isOffline, productsQuery.data, categoryId]);

  useEffect(() => {
    if (categoriesQuery.isError || (isOffline && !categoriesQuery.data)) {
      getCachedCategories().then(setOfflineCategories).catch(() => {});
    } else {
      setOfflineCategories(null);
    }
  }, [categoriesQuery.isError, isOffline, categoriesQuery.data]);

  const products = productsQuery.data ?? offlineProducts ?? undefined;
  const categories = categoriesQuery.data ?? offlineCategories ?? undefined;
  const productsLoading = productsQuery.isLoading && !offlineProducts;

  return { products, categories, productsLoading, isOffline };
}
