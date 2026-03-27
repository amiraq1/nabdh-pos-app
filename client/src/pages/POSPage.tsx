import { useState, useMemo, useCallback, useDeferredValue, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { type PrintableInvoice } from "@/lib/bluetooth";
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
import { offlineCheckout } from "@/stores/offlineStore";
import { usePOSData } from "@/hooks/usePOSData";
import { usePOSBarcode } from "@/hooks/usePOSBarcode";
import { usePOSCheckout } from "@/hooks/usePOSCheckout";
import { usePOSBluetooth } from "@/hooks/usePOSBluetooth";
import { CartSidebar } from "@/components/pos/CartSidebar";
import { ProductGrid } from "@/components/pos/ProductGrid";

const EDGE_SWIPE_ZONE_PX = 32;


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
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showCheckout, setShowCheckout] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showPrinterSheet, setShowPrinterSheet] = useState(false);
  const [completedInvoice, setCompletedInvoice] = useState<PrintableInvoice | null>(null);
  const [touchStartPos, setTouchStartPos] = useState<{ x: number; y: number } | null>(null);

  const lastAutoPrintedInvoice = useRef<string | null>(null);

  const {
    printerState: {
      printerStatus,
      knownPrinters,
      isRefreshingPrinters,
      isConnectingPrinter,
      isPrintingReceipt,
      autoPrintEnabled,
      preferredPrinterId,
      preferredPrinterName,
      paperWidth,
      printCopies,
      cutAfterPrint,
    },
    printerSetters: {
      setAutoPrintEnabled,
      setPaperWidth,
      setPrintCopies,
      setCutAfterPrint,
    },
    printerActions: {
      syncPrinterSnapshot,
      refreshPrinterCenter,
      handleConnectPrinter,
      handleDisconnectPrinter,
      handleForgetPrinter,
      handleBluetoothPrint,
      handleTestPrint,
    },
  } = usePOSBluetooth({ completedInvoice });


  const { products, categories, productsLoading, isOffline } = usePOSData(selectedCategory);

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

  const { handleBarcodeDetected } = usePOSBarcode({
    products,
    isOffline,
    addToCart,
  });

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



  const handleStartNewSale = useCallback(() => {
    setShowCheckout(false);
    setCompletedInvoice(null);
    lastAutoPrintedInvoice.current = null;
  }, []);

  const { isProcessing, handleCheckout } = usePOSCheckout({
    cart,
    subtotal,
    taxAmount,
    discountAmount,
    total,
    paymentMethod,
    customerName,
    customerPhone,
    lastAutoPrintedInvoice,
    setCompletedInvoice,
    clearCart,
    setCustomerDetails,
    setDiscount,
  });

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

          <ProductGrid
            productsLoading={productsLoading}
            filteredProducts={filteredProducts}
            addToCart={addToCart}
          />
        </div>

        <CartSidebar
          cart={cart}
          subtotal={subtotal}
          discountAmount={discountAmount}
          total={total}
          updateQuantity={updateQuantity}
          onCheckout={() => setShowCheckout(true)}
        />

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
