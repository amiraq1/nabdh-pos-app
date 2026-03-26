import { useState, useMemo, useCallback, useDeferredValue, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BluetoothPrinterError,
  thermalPrinter,
  type PrintableInvoice,
  type PrinterDevice,
  type PrinterStatus,
} from "@/lib/bluetooth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  Search,
  Plus,
  Minus,
  Barcode,
  Printer,
  CheckCircle2,
  ArrowRight,
  ShoppingCart,
  Zap,
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

import BarcodeScanner from "@/components/BarcodeScanner";
import BluetoothPrinterSheet from "@/components/BluetoothPrinterSheet";
import { RETURN_POLICIES, STORE_BRANCHES, STORE_NAME } from "@/lib/invoice";
import { formatCurrency } from "@/lib/utils";
import { native } from "@/_core/native";
import { useCartStore } from "@/stores/cartStore";
import { usePrinterStore } from "@/stores/printerStore";
import { offlineCheckout, useOfflineStore } from "@/stores/offlineStore";
import {
  getCachedProducts,
  getCachedCategories,
  getCachedProductByBarcode,
  getCachedProductBySku,
} from "@/lib/offline-db";

const EDGE_SWIPE_ZONE_PX = 32;
const DEFAULT_PRINTER_STATUS: PrinterStatus = {
  supported: false,
  connected: false,
  enabled: false,
  printerId: "",
  printerName: "",
  mode: "unsupported",
  permission: "unknown",
};

function shouldTrackEdgeSwipe(target: EventTarget | null, touchX: number) {
  const isNearEdge =
    touchX <= EDGE_SWIPE_ZONE_PX || touchX >= window.innerWidth - EDGE_SWIPE_ZONE_PX;

  if (!isNearEdge) {
    return false;
  }

  if (!(target instanceof Element)) {
    return true;
  }

  return !target.closest(
    "button, a, input, textarea, select, [role='button'], [data-no-edge-swipe], [contenteditable='true']"
  );
}

export default function POSPage() {
  const [, navigate] = useLocation();
  const {
    cart,
    discount,
    discountType,
    paymentMethod,
    customerName,
    customerPhone,
    addItem,
    updateQuantity: updateStoreQuantity,
    setDiscount,
    setDiscountType,
    setCustomerDetails,
    setPaymentMethod,
    clearCart,
  } = useCartStore();
  const {
    autoPrintEnabled,
    preferredPrinterId,
    preferredPrinterName,
    paperWidth,
    printCopies,
    cutAfterPrint,
    setAutoPrintEnabled,
    setPaperWidth,
    setPrintCopies,
    setCutAfterPrint,
    rememberPrinter,
    clearPrinter,
  } = usePrinterStore();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showPrinterSheet, setShowPrinterSheet] = useState(false);
  const [completedInvoice, setCompletedInvoice] = useState<PrintableInvoice | null>(null);
  const [touchStartPos, setTouchStartPos] = useState<{ x: number; y: number } | null>(null);
  const [printerStatus, setPrinterStatus] = useState<PrinterStatus>(DEFAULT_PRINTER_STATUS);
  const [knownPrinters, setKnownPrinters] = useState<PrinterDevice[]>([]);
  const [isRefreshingPrinters, setIsRefreshingPrinters] = useState(false);
  const [isConnectingPrinter, setIsConnectingPrinter] = useState(false);
  const [isPrintingReceipt, setIsPrintingReceipt] = useState(false);

  const lastAutoPrintedInvoice = useRef<string | null>(null);
  const barcodeBuffer = useRef("");
  const barcodeTimeout = useRef<NodeJS.Timeout | null>(null);

  const offlineStatus = useOfflineStore((s) => s.status);
  const isOffline = offlineStatus === "offline";

  // Products: tRPC query with offline fallback
  const productsQuery = trpc.products.list.useQuery(
    selectedCategory !== "all" ? parseInt(selectedCategory, 10) : undefined
  );
  const categoriesQuery = trpc.categories.list.useQuery();
  const checkoutMutation = trpc.sales.checkout.useMutation();
  const utils = trpc.useUtils();

  // Offline fallback state
  const [offlineProducts, setOfflineProducts] = useState<any[] | null>(null);
  const [offlineCategories, setOfflineCategories] = useState<any[] | null>(null);

  // Load from IndexedDB when tRPC fails or we're offline
  useEffect(() => {
    if (productsQuery.isError || (isOffline && !productsQuery.data)) {
      const catId = selectedCategory !== "all" ? parseInt(selectedCategory, 10) : undefined;
      getCachedProducts(catId).then(setOfflineProducts).catch(() => {});
    } else {
      setOfflineProducts(null);
    }
  }, [productsQuery.isError, isOffline, productsQuery.data, selectedCategory]);

  useEffect(() => {
    if (categoriesQuery.isError || (isOffline && !categoriesQuery.data)) {
      getCachedCategories().then(setOfflineCategories).catch(() => {});
    } else {
      setOfflineCategories(null);
    }
  }, [categoriesQuery.isError, isOffline, categoriesQuery.data]);

  // Use server data when available, otherwise fall back to cached
  const products = productsQuery.data ?? offlineProducts ?? undefined;
  const categories = categoriesQuery.data ?? offlineCategories ?? undefined;
  const productsLoading = productsQuery.isLoading && !offlineProducts;

  const deferredSearchTerm = useDeferredValue(searchTerm);

  const filteredProducts = useMemo(() => {
    return (
      products?.filter(
        (product: any) =>
          product.name.includes(deferredSearchTerm) ||
          product.sku.includes(deferredSearchTerm) ||
          product.barcode?.includes(deferredSearchTerm)
      ) || []
    );
  }, [products, deferredSearchTerm]);

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.subtotal, 0),
    [cart]
  );
  const discountAmount = useMemo(
    () => (discountType === "percent" ? subtotal * (discount / 100) : discount),
    [subtotal, discount, discountType]
  );
  const total = useMemo(() => subtotal - discountAmount, [subtotal, discountAmount]);
  const taxAmount = 0;
  const printerPreviewInvoice = useMemo<PrintableInvoice | null>(() => {
    if (completedInvoice) {
      return completedInvoice;
    }

    if (cart.length === 0) {
      return null;
    }

    return {
      invoiceNumber: `DRAFT-${cart.length.toString().padStart(2, "0")}`,
      cartItems: cart.map(item => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        subtotal: item.subtotal,
      })),
      subtotal,
      discountAmount,
      total,
      paymentMethod,
      customerName: customerName || "عميل عام",
      customerPhone,
      createdAt: new Date().toISOString(),
    };
  }, [
    cart,
    completedInvoice,
    customerName,
    customerPhone,
    discountAmount,
    paymentMethod,
    subtotal,
    total,
  ]);
  const printerPreviewTitle = completedInvoice ? "آخر فاتورة مكتملة" : "معاينة قبل الطباعة";
  const printerPreviewDescription = completedInvoice
    ? "هذه المعاينة تعكس آخر فاتورة تم إنهاؤها، وهي الأقرب لما سيُرسل إلى الطابعة الآن."
    : "المعاينة تتحدث مباشرة من السلة الحالية لتراجع شكل الإيصال قبل إنهاء البيع.";

  const addToCart = useCallback(
    (product: any) => {
      native.vibrate();
      const result = addItem(product, product.quantity);

      if (!result.success) {
        toast.error(result.message, {
          className: "font-display text-destructive border-destructive",
        });
        return;
      }

      toast.success(result.message, { duration: 1000 });
    },
    [addItem]
  );

  const handleBarcodeDetectedLocal = useCallback(
    (barcode: string) => {
      if (!products) {
        return;
      }

      const product = products.find(
        (item: any) => item.barcode === barcode || item.sku === barcode
      );

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

      if (!trimmedCode) {
        return;
      }

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
          toast.error(`الرقم ${trimmedCode} غير معرّف في النظام`, {
            className: "font-display",
          });
          return;
        }

        addToCart(product);
      } catch (error) {
        // Offline fallback: search IndexedDB
        try {
          const cachedProduct =
            (await getCachedProductByBarcode(trimmedCode)) ||
            (await getCachedProductBySku(trimmedCode));

          if (cachedProduct) {
            addToCart(cachedProduct);
            return;
          }
        } catch {
          // IndexedDB also failed — fall through
        }

        console.error("Barcode lookup error:", error);
        toast.error(
          isOffline
            ? `الرقم ${trimmedCode} غير موجود في البيانات المحلية`
            : "تعذر العثور على المنتج. تحقّق من اتصال التطبيق بالخادم."
        );
      }
    },
    [
      addToCart,
      handleBarcodeDetectedLocal,
      isOffline,
      products,
      utils.products.getByBarcode,
      utils.products.getBySku,
    ]
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

        barcodeTimeout.current = setTimeout(() => {
          barcodeBuffer.current = "";
        }, 100);
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

  const updateQuantity = useCallback(
    (productId: number, quantity: number) => {
      const product = products?.find((item: any) => item.id === productId);

      if (!product) {
        return;
      }

      const success = updateStoreQuantity(productId, quantity, product.quantity);

      if (!success) {
        toast.error("تجاوز الحد المتوفر للمخزون", { duration: 1000 });
      }
    },
    [products, updateStoreQuantity]
  );

  const syncPrinterSnapshot = useCallback(
    async (requestPermissions = false) => {
      const [status, printers] = await Promise.all([
        thermalPrinter.getStatus(),
        thermalPrinter.listAvailablePrinters({ requestPermissions }),
      ]);

      setPrinterStatus(status);
      setKnownPrinters(printers);

      if (status.printerId || status.printerName) {
        rememberPrinter({
          id: status.printerId,
          name: status.printerName,
        });
      }
    },
    [rememberPrinter]
  );

  const refreshPrinterCenter = useCallback(
    async (requestPermissions = false) => {
      setIsRefreshingPrinters(true);

      try {
        await syncPrinterSnapshot(requestPermissions);
      } catch (error) {
        console.error("Printer refresh error:", error);
        toast.error("تعذر تحديث حالة الطابعة الآن");
      } finally {
        setIsRefreshingPrinters(false);
      }
    },
    [syncPrinterSnapshot]
  );

  const handleConnectPrinter = useCallback(
    async (printer?: PrinterDevice) => {
      setIsConnectingPrinter(true);
      toast.loading("جارِ تجهيز اتصال الطابعة", { id: "bt-connect" });

      try {
        let targetPrinter = printer;

        if (!targetPrinter && preferredPrinterId) {
          targetPrinter = {
            id: preferredPrinterId,
            name: preferredPrinterName || "الطابعة المحفوظة",
          };
        }

        if (!targetPrinter && printerStatus.mode === "native") {
          const devices = await thermalPrinter.listAvailablePrinters({ requestPermissions: true });
          setKnownPrinters(devices);

          if (devices.length === 1) {
            targetPrinter = devices[0];
          } else if (devices.length > 1) {
            throw new BluetoothPrinterError("اختر الطابعة المطلوبة من القائمة بالأسفل", "selection_required");
          } else {
            throw new BluetoothPrinterError(
              "اقترن بالطابعة من إعدادات البلوتوث أولاً ثم حدّث القائمة",
              "printer_not_found"
            );
          }
        }

        const result = await thermalPrinter.connect({
          printerId: targetPrinter?.id,
          printerName: targetPrinter?.name,
          preferPaired: Boolean(targetPrinter || preferredPrinterId || preferredPrinterName),
          requestDevice: printerStatus.mode !== "native",
        });

        rememberPrinter({
          id: result.printerId,
          name: result.printerName,
        });

        await syncPrinterSnapshot(true);
        toast.success(`تم الاتصال بـ ${result.printerName || "الطابعة"}`, {
          id: "bt-connect",
        });
      } catch (error: unknown) {
        const connectionError = error as { code?: string; message?: string };

        if (connectionError.code === "cancelled") {
          toast.info(connectionError.message || "تم إلغاء اختيار الطابعة", { id: "bt-connect" });
        } else {
          toast.error(connectionError.message || "تعذر الاتصال بالطابعة", {
            id: "bt-connect",
          });
        }
      } finally {
        setIsConnectingPrinter(false);
      }
    },
    [
      preferredPrinterId,
      preferredPrinterName,
      printerStatus.mode,
      rememberPrinter,
      syncPrinterSnapshot,
    ]
  );

  const handleDisconnectPrinter = useCallback(async () => {
    try {
      await thermalPrinter.disconnect();
      await syncPrinterSnapshot(false);
      toast.success("تم قطع الاتصال بالطابعة");
    } catch (error) {
      console.error("Printer disconnect error:", error);
      toast.error("تعذر قطع الاتصال بالطابعة");
    }
  }, [syncPrinterSnapshot]);

  const handleForgetPrinter = useCallback(async () => {
    clearPrinter();

    try {
      await thermalPrinter.disconnect();
      await syncPrinterSnapshot(false);
    } catch (error) {
      console.error("Forget printer error:", error);
    }

    toast.success("تم مسح الطابعة المحفوظة");
  }, [clearPrinter, syncPrinterSnapshot]);

  const handleBluetoothPrint = useCallback(
    async (options: { silent?: boolean; invoice?: PrintableInvoice | null } = {}) => {
      const invoiceToPrint = options.invoice ?? completedInvoice;

      if (!invoiceToPrint) {
        return;
      }

      const toastId = options.silent ? `bt-auto-${invoiceToPrint.invoiceNumber}` : "bt-print";

      if (!options.silent) {
        toast.loading("جارِ الإرسال إلى الطابعة", { id: toastId });
      }

      setIsPrintingReceipt(true);

      try {
        const result = await thermalPrinter.printRasterReceipt(invoiceToPrint, {
          silent: options.silent,
          printerId: preferredPrinterId || undefined,
          printerName: preferredPrinterName || undefined,
          paperWidth,
          copies: printCopies,
          cutAfterPrint,
        });

        rememberPrinter({
          id: result.printerId,
          name: result.printerName,
        });

        await syncPrinterSnapshot(false);
        toast.success(
          options.silent
            ? `تمت الطباعة تلقائياً على ${result.printerName || "الطابعة المحفوظة"}`
            : "تم إرسال الإيصال للطابعة",
          { id: toastId }
        );
      } catch (error: unknown) {
        const printError = error as { code?: string; message?: string };

        if (printError.code === "cancelled") {
          if (!options.silent) {
            toast.info(printError.message || "تم إلغاء اختيار الطابعة", { id: toastId });
          }
          return;
        }

        toast.error(printError.message || "تأكد من تشغيل الطابعة والبلوتوث", {
          id: toastId,
        });
      } finally {
        setIsPrintingReceipt(false);
      }
    },
    [
      cutAfterPrint,
      completedInvoice,
      paperWidth,
      preferredPrinterId,
      preferredPrinterName,
      printCopies,
      rememberPrinter,
      syncPrinterSnapshot,
    ]
  );

  const handleTestPrint = useCallback(async () => {
    toast.loading("جارِ إرسال صفحة الاختبار", { id: "bt-test" });
    setIsPrintingReceipt(true);

    try {
      const result = await thermalPrinter.printTestReceipt({
        printerId: preferredPrinterId || undefined,
        printerName: preferredPrinterName || undefined,
        paperWidth,
        copies: printCopies,
        cutAfterPrint,
      });

      rememberPrinter({
        id: result.printerId,
        name: result.printerName,
      });

      await syncPrinterSnapshot(false);
      toast.success("تمت طباعة صفحة الاختبار", { id: "bt-test" });
    } catch (error: unknown) {
      const printError = error as { message?: string };
      toast.error(printError.message || "تعذر تنفيذ الطباعة التجريبية", {
        id: "bt-test",
      });
    } finally {
      setIsPrintingReceipt(false);
    }
  }, [
    cutAfterPrint,
    paperWidth,
    preferredPrinterId,
    preferredPrinterName,
    printCopies,
    rememberPrinter,
    syncPrinterSnapshot,
  ]);

  const handleStartNewSale = useCallback(() => {
    setShowCheckout(false);
    setCompletedInvoice(null);
    lastAutoPrintedInvoice.current = null;
  }, []);

  const handleCheckout = async () => {
    if (cart.length === 0) {
      return;
    }

    setIsProcessing(true);

    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
    const checkoutPayload = {
      invoiceNumber,
      totalAmount: subtotal.toString(),
      taxAmount: taxAmount.toString(),
      discountAmount: discountAmount.toString(),
      finalAmount: total.toString(),
      paymentMethod,
      customerName: customerName || "عميل عام",
      customerPhone,
      notes: "",
      items: cart.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.price.toString(),
        subtotal: item.subtotal.toString(),
      })),
    };

    try {
      // Try server-side checkout first
      const sale = await checkoutMutation.mutateAsync(checkoutPayload);

      void utils.products.list.invalidate();

      toast.success("تم إتمام دورة البيع بنجاح", {
        className: "font-display bg-primary text-primary-foreground border-primary",
      });

      lastAutoPrintedInvoice.current = null;
      setCompletedInvoice({
        ...sale,
        invoiceNumber,
        cartItems: [...cart],
        total,
        discountAmount,
        subtotal,
        paymentMethod,
        customerName: customerName || "عميل عام",
        customerPhone,
        createdAt: new Date().toISOString(),
      });

      clearCart();
      setCustomerDetails("", "");
      setDiscount(0);
    } catch (error: any) {
      // Check if it's a network error → save offline
      const isNetworkError =
        !navigator.onLine ||
        /fetch failed|NetworkError|ERR_CONNECTION|ERR_NETWORK|API_REQUEST_TIMEOUT|Failed to fetch/i.test(
          error?.message || ""
        );

      if (isNetworkError) {
        try {
          const offlineResult = await offlineCheckout(checkoutPayload);

          toast.success("تم حفظ البيع محلياً — ستتم المزامنة عند عودة الاتصال", {
            className: "font-display bg-amber-500 text-white border-amber-600",
            duration: 4000,
          });

          lastAutoPrintedInvoice.current = null;
          setCompletedInvoice({
            invoiceNumber,
            cartItems: [...cart],
            total,
            discountAmount,
            subtotal,
            paymentMethod,
            customerName: customerName || "عميل عام",
            customerPhone,
            createdAt: new Date().toISOString(),
          });

          clearCart();
          setCustomerDetails("", "");
          setDiscount(0);
        } catch (offlineError) {
          toast.error("تعذر حفظ العملية. يرجى المحاولة مرة أخرى.");
          console.error("Offline checkout error:", offlineError);
        }
      } else {
        toast.error("تعذر إتمام العملية، يرجى المحاولة مرة أخرى.");
        console.error("Checkout error:", error);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTouchStart = (event: React.TouchEvent) => {
    const touch = event.targetTouches[0];

    if (!shouldTrackEdgeSwipe(event.target, touch.clientX)) {
      setTouchStartPos(null);
      return;
    }

    setTouchStartPos({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (!touchStartPos) {
      return;
    }

    const touchEndX = event.changedTouches[0].clientX;
    const touchEndY = event.changedTouches[0].clientY;
    const deltaX = touchStartPos.x - touchEndX;
    const deltaY = Math.abs(touchStartPos.y - touchEndY);

    if (Math.abs(deltaX) > 100 && deltaY < 50) {
      const isFromLeftEdge = touchStartPos.x < 50;
      const isFromRightEdge = touchStartPos.x > window.innerWidth - 50;

      if (isFromLeftEdge || isFromRightEdge) {
        native.vibrate();
        navigate("/");
      }
    }

    setTouchStartPos(null);
  };

  useEffect(() => {
    void syncPrinterSnapshot(false);
  }, [syncPrinterSnapshot]);

  useEffect(() => {
    if (!completedInvoice) {
      lastAutoPrintedInvoice.current = null;
      return;
    }

    if (!autoPrintEnabled || (!preferredPrinterId && !preferredPrinterName)) {
      return;
    }

    if (lastAutoPrintedInvoice.current === completedInvoice.invoiceNumber) {
      return;
    }

    lastAutoPrintedInvoice.current = completedInvoice.invoiceNumber;
    void handleBluetoothPrint({
      silent: true,
      invoice: completedInvoice,
    });
  }, [
    autoPrintEnabled,
    completedInvoice,
    handleBluetoothPrint,
    preferredPrinterId,
    preferredPrinterName,
  ]);

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-background"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="pointer-events-none absolute left-0 top-0 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[800px] w-[800px] translate-x-1/3 translate-y-1/3 rounded-full bg-primary/5 blur-3xl" />

      <div className="container relative z-10 h-screen space-y-4 overflow-hidden py-4 pb-24 lg:grid lg:grid-cols-12 lg:gap-8 lg:pb-6">
        <div className="flex h-full flex-col space-y-6 lg:col-span-8">
          <div className="glass-panel flex flex-col justify-between gap-4 rounded-2xl p-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-xl border-border/40 shadow-sm hover:bg-muted"
                onClick={() => navigate("/")}
              >
                <ArrowRight className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground font-display">
                  <Zap className="h-5 w-5 text-primary" />
                  محطة المبيعات
                </h1>
                <p className="text-sm font-medium text-muted-foreground">
                  استخدم الكاميرا أو ماسح الباركود الخارجي فوراً
                </p>
              </div>
            </div>

            <div className="flex w-full gap-2 sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="ابحث هنا..."
                  value={searchTerm}
                  onChange={event => setSearchTerm(event.target.value)}
                  className="h-11 rounded-xl border-border/40 bg-background/50 pl-4 pr-10 focus:border-primary"
                />
              </div>
              <Button
                onClick={() => setShowPrinterSheet(true)}
                className={`h-11 w-11 rounded-xl shadow-sm transition-colors ${
                  printerStatus.connected
                    ? "border-primary/50 bg-primary/10 text-primary hover:bg-primary/15"
                    : "glass-panel hover:border-primary"
                }`}
                variant="outline"
                size="icon"
              >
                <Printer className="h-5 w-5" />
              </Button>
              <Button
                onClick={() => setShowBarcodeScanner(true)}
                className="glass-panel h-11 w-11 rounded-xl shadow-sm transition-colors hover:border-primary"
                variant="outline"
                size="icon"
              >
                <Barcode className="h-5 w-5 text-foreground" />
              </Button>
            </div>
          </div>

          <div className="scrollbar-none flex gap-2 overflow-x-auto pb-2 touch-pan-x" data-no-edge-swipe>
            <Button
              type="button"
              variant={selectedCategory === "all" ? "default" : "outline"}
              className={`touch-manipulation rounded-full px-6 font-display shadow-none ${
                selectedCategory !== "all" && "border-border/30 bg-background/40"
              }`}
              onClick={() => setSelectedCategory("all")}
            >
              الكل
            </Button>
            {categories?.map((category: any) => (
              <Button
                type="button"
                key={category.id}
                variant={selectedCategory === category.id.toString() ? "default" : "outline"}
                className={`touch-manipulation whitespace-nowrap rounded-full px-6 font-display shadow-none ${
                  selectedCategory !== category.id.toString() && "border-border/30 bg-background/40"
                }`}
                onClick={() => setSelectedCategory(category.id.toString())}
              >
                {category.name}
              </Button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto pb-4 pr-1">
            {productsLoading ? (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredProducts.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
                {filteredProducts.map((product: any) => (
                  <motion.div
                    key={product.id}
                    whileHover={{ y: -4, scale: 1.01 }}
                    whileTap={{ scale: 0.96 }}
                  >
                    <Card
                      className="h-full cursor-pointer overflow-hidden rounded-2xl border border-border/30 bg-background/40 shadow-sm backdrop-blur-sm transition-all hover:border-primary/50"
                      onClick={event => {
                        event.preventDefault();
                        addToCart(product);
                      }}
                    >
                      {product.imageUrl ? (
                        <div className="relative h-32 w-full overflow-hidden bg-muted">
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="flex h-32 w-full items-center justify-center bg-gradient-to-br from-muted/50 to-muted">
                          <ShoppingCart className="h-8 w-8 text-muted-foreground/30" />
                        </div>
                      )}
                      <CardContent className="flex h-[104px] flex-col justify-between p-4">
                        <div>
                          <p className="truncate text-sm font-semibold text-foreground font-display">
                            {product.name}
                          </p>
                          <div className="mt-1 flex items-center gap-1.5 border-t border-border/10 pt-1">
                            <span className="truncate font-mono text-[9px] uppercase tracking-tighter text-muted-foreground">
                              #{product.barcode || product.sku}
                            </span>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <p className="text-lg font-bold tracking-tight text-primary">
                            {formatCurrency(product.price)}
                          </p>
                          <span
                            className={`rounded-md px-2 py-1 text-[10px] font-bold ${
                              product.quantity > 0
                                ? "bg-primary/10 text-primary"
                                : "bg-destructive/10 text-destructive"
                            }`}
                          >
                            {product.quantity > 0 ? `${product.quantity} متوفر` : "نفد"}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="glass-panel flex h-64 items-center justify-center rounded-2xl border-dashed">
                <p className="font-display text-muted-foreground">لا توجد منتجات تطابق بحثك</p>
              </div>
            )}
          </div>
        </div>

        <div className="hidden h-full flex-col lg:col-span-4 lg:flex">
          <div className="glass-panel relative flex flex-1 flex-col overflow-hidden rounded-3xl border-white/5 shadow-2xl dark:border-white/5">
            <div className="border-b border-border/30 bg-background/50 p-6 pb-4">
              <h2 className="flex items-center justify-between text-xl font-bold font-display">
                <span>سلة المشتريات</span>
                <span className="rounded-full bg-primary px-3 py-1 text-sm text-primary-foreground">
                  {cart.length}
                </span>
              </h2>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              <AnimatePresence mode="popLayout">
                {cart.length > 0 ? (
                  cart.map(item => (
                    <motion.div
                      key={item.productId}
                      layout
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      className="group rounded-2xl border border-border/40 bg-background/80 p-3 transition-colors hover:border-primary/40"
                    >
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <p className="line-clamp-1 text-sm font-medium text-foreground font-display">
                            {item.name}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatCurrency(item.price)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end justify-between text-left">
                          <p className="font-bold text-accent">{formatCurrency(item.subtotal)}</p>
                          <div className="mt-2 flex items-center gap-1 rounded-lg bg-muted/50 p-1">
                            <button
                              type="button"
                              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                              onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-8 text-center text-xs font-bold">{item.quantity}</span>
                            <button
                              type="button"
                              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                              onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="flex h-full flex-col items-center justify-center space-y-4 text-muted-foreground/50 opacity-50">
                    <ShoppingCart className="h-16 w-16" />
                    <p className="font-display">قم بمسح باركود لبدء البيع</p>
                  </div>
                )}
              </AnimatePresence>
            </div>

            <div className="space-y-4 border-t border-border/30 bg-background/90 p-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>المجموع الفرعي</span>
                  <span className="font-medium text-foreground">{formatCurrency(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-destructive">
                    <span>الخصم</span>
                    <span className="font-medium">-{formatCurrency(discountAmount)}</span>
                  </div>
                )}
                <div className="mt-2 flex justify-between border-t border-border/40 pt-2 text-2xl font-bold text-primary font-display">
                  <span>الإجمالي</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>

              <Button
                className="group h-14 w-full rounded-2xl text-lg font-bold tracking-wide shadow-lg shadow-primary/20 font-display"
                onClick={() => setShowCheckout(true)}
                disabled={cart.length === 0}
              >
                تحديث الدفع
                <ArrowRight className="mr-2 h-5 w-5 transition-transform group-hover:-translate-x-1" />
              </Button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {cart.length > 0 && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="fixed bottom-4 left-4 right-4 z-40 lg:hidden"
            >
              <Button
                className="h-16 w-full gap-3 rounded-[24px] bg-primary/95 text-lg font-bold shadow-2xl shadow-primary/30 backdrop-blur-md font-display"
                onClick={() => setShowCheckout(true)}
              >
                <ShoppingCart className="h-5 w-5 shrink-0" />
                <span>إتمام الدفع</span>
                <span className="rounded-full bg-background/20 px-3 py-1 text-sm">{cart.length}</span>
                <span className="mr-auto text-xl">{formatCurrency(total)}</span>
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent
          aria-describedby={undefined}
          className="glass-panel max-w-md overflow-hidden rounded-[32px] border-0 p-0 sm:max-w-lg"
        >
          {completedInvoice ? (
            <div className="space-y-8 p-8">
              <div className="no-print space-y-3 text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10">
                  <CheckCircle2 className="h-10 w-10 text-green-500" />
                </div>
                <h2 className="text-3xl font-bold text-foreground font-display">عملية ناجحة</h2>
                <p className="font-mono text-muted-foreground">{completedInvoice.invoiceNumber}</p>
              </div>

              <div className="mx-auto max-w-[320px] rounded-2xl bg-white p-6 text-black shadow-inner print:shadow-none print:p-0">
                <div className="mb-6 border-b-2 border-dashed border-gray-200 pb-4 text-center">
                  <h3 className="text-2xl font-black tracking-tight font-display">{STORE_NAME}</h3>
                  <p className="mt-2 text-[11px] font-semibold text-gray-500">الفروع</p>
                  <p className="mt-1 text-[11px] leading-5 text-gray-600">
                    {STORE_BRANCHES.join("، ")}
                  </p>
                </div>

                <div className="mb-4 flex justify-between font-mono text-[10px] text-gray-400">
                  <span>{completedInvoice.invoiceNumber}</span>
                  <span>
                    {new Date(completedInvoice.createdAt ?? Date.now()).toLocaleString("ar-SA", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                </div>

                <div className="mb-4 space-y-1 rounded-xl bg-gray-50 px-3 py-2 text-[11px] text-gray-500">
                  <div className="flex justify-between gap-3">
                    <span>العميل</span>
                    <span>{completedInvoice.customerName || "عميل عام"}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>الدفع</span>
                    <span>
                      {completedInvoice.paymentMethod === "cash"
                        ? "نقداً"
                        : completedInvoice.paymentMethod === "card"
                          ? "بطاقة ائتمان"
                          : "تحويل بنكي"}
                    </span>
                  </div>
                </div>

                <div className="mb-6 space-y-3">
                  {completedInvoice.cartItems?.map((item, index) => (
                    <div key={`${item.name}-${index}`} className="flex items-start justify-between text-xs">
                      <div className="flex flex-1 flex-col pr-4">
                        <span className="font-bold">{item.name}</span>
                        <span className="mt-0.5 text-[10px] text-gray-400">
                          {item.quantity} × {formatCurrency(item.price)}
                        </span>
                      </div>
                      <span className="pt-0.5 font-bold">{formatCurrency(item.subtotal)}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 border-t-2 border-gray-900 pt-3">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>المجموع</span>
                    <span>{formatCurrency(completedInvoice.subtotal ?? completedInvoice.total)}</span>
                  </div>
                  {completedInvoice.discountAmount && completedInvoice.discountAmount > 0 && (
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>الخصم</span>
                      <span>-{formatCurrency(completedInvoice.discountAmount)}</span>
                    </div>
                  )}
                  <div className="mt-3 flex justify-between text-xl font-black">
                    <span>الصافي</span>
                    <span>{formatCurrency(completedInvoice.total)}</span>
                  </div>
                </div>

                <div className="mt-6 border-t border-dashed border-gray-300 pt-4 text-center">
                  <p className="mb-2 text-[11px] font-bold text-gray-700">سياسة الإرجاع</p>
                  <div className="space-y-1 text-[10px] leading-5 text-gray-600">
                    {RETURN_POLICIES.map(policy => (
                      <p key={policy}>{policy}</p>
                    ))}
                  </div>
                </div>

                <div className="mt-8 flex justify-center opacity-50 grayscale">
                  <Barcode className="h-10 w-32" />
                </div>
              </div>

              <div className="no-print flex flex-col gap-3">
                <Button
                  className="h-14 w-full gap-2 rounded-2xl text-lg font-display"
                  onClick={() => void handleBluetoothPrint()}
                  disabled={isPrintingReceipt}
                >
                  {isPrintingReceipt ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Printer className="h-5 w-5" />
                  )}
                  طباعة الإيصال
                </Button>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    className="h-12 rounded-xl"
                    onClick={() => setShowPrinterSheet(true)}
                  >
                    إعدادات الطابعة
                  </Button>
                  <Button
                    variant="outline"
                    className="h-12 rounded-xl"
                    onClick={() => window.print()}
                  >
                    PDF / سلكية
                  </Button>
                </div>
                <Button
                  variant="secondary"
                  className="h-12 rounded-xl"
                  onClick={handleStartNewSale}
                >
                  عملية جديدة
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-8">
              <DialogHeader className="mb-6">
                <DialogTitle className="text-2xl font-bold font-display">ملخص الدفع</DialogTitle>
                <DialogDescription>استكمال بيانات المبيعات الحالية</DialogDescription>
              </DialogHeader>
              <div className="space-y-5">
                <div className="space-y-4">
                  <Input
                    value={customerName}
                    onChange={event => setCustomerDetails(event.target.value, customerPhone)}
                    placeholder="اسم العميل (اختياري)"
                    className="h-12 rounded-xl border-border/50 bg-background/50"
                  />

                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <Input
                        type="number"
                        value={discount === 0 ? "" : discount}
                        onChange={event => setDiscount(parseFloat(event.target.value) || 0)}
                        placeholder={`الخصم (${discountType === "percent" ? "%" : "د.ع"})`}
                        className="h-12 rounded-xl border-border/50 bg-background/50"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setDiscountType(discountType === "percent" ? "amount" : "percent")
                      }
                      className="h-12 w-12 rounded-xl text-lg font-bold font-display"
                    >
                      {discountType === "percent" ? "%" : "$"}
                    </Button>
                  </div>

                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="h-12 rounded-xl border-border/50 bg-background/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="cash">نقداً</SelectItem>
                      <SelectItem value="card">بطاقة ائتمان</SelectItem>
                      <SelectItem value="transfer">تحويل بنكي</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/10 p-5">
                  <span className="font-medium text-foreground font-display">الإجمالي المستحق</span>
                  <span className="text-2xl font-black text-primary">{formatCurrency(total)}</span>
                </div>

                <Button
                  className="h-14 w-full rounded-xl text-lg font-bold shadow-lg shadow-primary/25 font-display"
                  onClick={handleCheckout}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    "تأكيد واستلام المبلغ"
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BarcodeScanner
        isOpen={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onBarcodeDetected={handleBarcodeDetected}
      />

      <BluetoothPrinterSheet
        open={showPrinterSheet}
        onOpenChange={setShowPrinterSheet}
        status={printerStatus}
        printers={knownPrinters}
        preferredPrinterId={preferredPrinterId}
        preferredPrinterName={preferredPrinterName}
        autoPrintEnabled={autoPrintEnabled}
        paperWidth={paperWidth}
        printCopies={printCopies}
        cutAfterPrint={cutAfterPrint}
        previewInvoice={printerPreviewInvoice}
        previewTitle={printerPreviewTitle}
        previewDescription={printerPreviewDescription}
        isRefreshing={isRefreshingPrinters}
        isConnecting={isConnectingPrinter}
        isPrinting={isPrintingReceipt}
        hasInvoice={Boolean(completedInvoice)}
        onRefresh={() => void refreshPrinterCenter(true)}
        onConnect={printer => void handleConnectPrinter(printer)}
        onDisconnect={() => void handleDisconnectPrinter()}
        onPrintTest={() => void handleTestPrint()}
        onPrintCurrent={() => void handleBluetoothPrint()}
        onAutoPrintChange={setAutoPrintEnabled}
        onPaperWidthChange={setPaperWidth}
        onPrintCopiesChange={setPrintCopies}
        onCutAfterPrintChange={setCutAfterPrint}
        onForgetPrinter={() => void handleForgetPrinter()}
      />
    </div>
  );
}
