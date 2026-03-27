import { useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { getCachedProductByBarcode, getCachedProductBySku } from "@/lib/offline-db";
import { toast } from "sonner";

// Note 1: Define a clear Product Interface
export interface POSProduct {
  id: number;
  name: string;
  price: number;
  barcode?: string | null;
  sku?: string | null;
  imageUrl?: string | null;
  stock?: number;
}

export function usePOSBarcode({
  products,
  isOffline,
  addToCart,
}: {
  products: POSProduct[] | undefined;
  isOffline: boolean;
  addToCart: (product: any) => void;
}) {
  const utils = trpc.useUtils();
  const barcodeBuffer = useRef("");
  // Note 4: Browser-compatible timeout type
  const barcodeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleBarcodeDetected = useCallback(
    async (barcode: string) => {
      const trimmedCode = barcode.trim();
      if (!trimmedCode) return;

      // Note 2: Direct local search first (The Efficiency Fix)
      const productFromVisibleList = products?.find(
        (p) => p.barcode === trimmedCode || p.sku === trimmedCode
      );

      if (productFromVisibleList) {
        addToCart(productFromVisibleList);
        return;
      }

      // Note 3: Strict Offline Mode handling (Note 3 Fix)
      if (isOffline) {
        try {
          const cachedProduct =
            (await getCachedProductByBarcode(trimmedCode)) ||
            (await getCachedProductBySku(trimmedCode));

          if (cachedProduct) {
            addToCart(cachedProduct);
            return;
          }
        } catch (cacheError) {
          console.warn("Offline cache lookup failed:", cacheError);
        }
        
        toast.error(`الرقم ${trimmedCode} غير موجود في البيانات المحلية`);
        return;
      }

      // Online Path: Fetch from network
      try {
        const product =
          (await utils.products.getByBarcode.fetch(trimmedCode)) ||
          (await utils.products.getBySku.fetch(trimmedCode));

        if (!product) {
          toast.error(`الرقم ${trimmedCode} غير معرّف في النظام`, { className: "font-display" });
          return;
        }

        addToCart(product);
      } catch (error) {
        console.error("Network barcode lookup error:", error);
        toast.error("تعذر العثور على المنتج. تحقّق من اتصال التطبيق بالخادم.");
      }
    },
    [addToCart, isOffline, products, utils]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      
      // Note 6: Enhanced input detection
      const isInput = ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || 
                      target.isContentEditable || 
                      target.getAttribute("data-no-barcode") === "true";
                      
      if (isInput) return;

      if (event.key === "Enter") {
        if (barcodeBuffer.current.length > 3) {
          void handleBarcodeDetected(barcodeBuffer.current);
          barcodeBuffer.current = "";
        }
        return;
      }

      if (event.key.length === 1) {
        barcodeBuffer.current += event.key;

        if (barcodeTimeout.current) {
          clearTimeout(barcodeTimeout.current);
        }

        // Note 7: Heuristic timeout for fast scanners (150ms)
        barcodeTimeout.current = setTimeout(() => {
          barcodeBuffer.current = "";
        }, 150);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (barcodeTimeout.current) {
        clearTimeout(barcodeTimeout.current);
      }
    };
  }, [handleBarcodeDetected]);

  return { handleBarcodeDetected };
}
