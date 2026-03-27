import { useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { getCachedProductByBarcode, getCachedProductBySku } from "@/lib/offline-db";
import { toast } from "sonner";

export function usePOSBarcode({
  products,
  isOffline,
  addToCart,
}: {
  products: any[] | undefined;
  isOffline: boolean;
  addToCart: (product: any) => void;
}) {
  const utils = trpc.useUtils();
  const barcodeBuffer = useRef("");
  const barcodeTimeout = useRef<NodeJS.Timeout | null>(null);

  const handleBarcodeDetectedLocal = useCallback(
    (barcode: string) => {
      if (!products) return;
      const product = products.find((item: any) => item.barcode === barcode || item.sku === barcode);
      if (!product) {
        toast.error(`الرقم ${barcode} غير معرّف في النظام`, { className: "font-display" });
        return;
      }
      addToCart(product);
    },
    [products, addToCart]
  );

  const handleBarcodeDetected = useCallback(
    async (barcode: string) => {
      const trimmedCode = barcode.trim();
      if (!trimmedCode) return;

      const productFromVisibleList = products?.find(
        (product: any) => product.barcode === trimmedCode || product.sku === trimmedCode
      );

      if (productFromVisibleList) {
        handleBarcodeDetectedLocal(trimmedCode);
        return;
      }

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
        try {
          const cachedProduct =
            (await getCachedProductByBarcode(trimmedCode)) ||
            (await getCachedProductBySku(trimmedCode));

          if (cachedProduct) {
            addToCart(cachedProduct);
            return;
          }
        } catch {}

        console.error("Barcode lookup error:", error);
        toast.error(
          isOffline
            ? `الرقم ${trimmedCode} غير موجود في البيانات المحلية`
            : "تعذر العثور على المنتج. تحقّق من اتصال التطبيق بالخادم."
        );
      }
    },
    [addToCart, handleBarcodeDetectedLocal, isOffline, products, utils]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes((event.target as HTMLElement).tagName)) {
        return;
      }

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

        // Increased timeout from 100ms to 150ms to prevent truncation by fast scanners
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
