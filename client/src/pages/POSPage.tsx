import { useState, useMemo, useCallback, useDeferredValue, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { type PrintableInvoice } from "@/lib/bluetooth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Search,
  Barcode,
  Printer,
  ArrowRight,
  ShoppingCart,
  Zap,
  Database,
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

import BarcodeScanner from "@/components/BarcodeScanner";
import BluetoothPrinterSheet from "@/components/BluetoothPrinterSheet";
import { formatCurrency } from "@/lib/utils";
import { native } from "@/_core/native";
import { useCartStore } from "@/stores/cartStore";
import { usePOSData } from "@/hooks/usePOSData";
import { usePOSBarcode, type POSProduct } from "@/hooks/usePOSBarcode";
import { usePOSCheckout } from "@/hooks/usePOSCheckout";
import { usePOSBluetooth } from "@/hooks/usePOSBluetooth";
import { CartSidebar } from "@/components/pos/CartSidebar";
import { ProductGrid } from "@/components/pos/ProductGrid";
import { CheckoutDialog } from "@/components/pos/CheckoutDialog";
import { SyncHistorySheet } from "@/components/pos/SyncHistorySheet";
import { getJobsToSync } from "@/lib/offline-queue";

const EDGE_SWIPE_ZONE_PX = 32;

function shouldTrackEdgeSwipe(target: EventTarget | null, touchX: number) {
  const isNearEdge =
    touchX <= EDGE_SWIPE_ZONE_PX || touchX >= window.innerWidth - EDGE_SWIPE_ZONE_PX;

  if (!isNearEdge) return false;
  if (!(target instanceof Element)) return true;

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
  const [showSyncHistory, setShowSyncHistory] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [completedInvoice, setCompletedInvoice] = useState<PrintableInvoice | null>(null);
  const [touchStartPos, setTouchStartPos] = useState<{ x: number; y: number } | null>(null);

  const lastAutoPrintedInvoice = useRef<string | null>(null);

  // Externalizing dependencies via hooks
  const {
    printerState,
    printerSetters,
    printerActions,
  } = usePOSBluetooth({ completedInvoice });

  const { products, categories, productsLoading, isOffline } = usePOSData(selectedCategory);
  const deferredSearchTerm = useDeferredValue(searchTerm);

  const filteredProducts = useMemo(() => {
    const q = deferredSearchTerm.trim().toLowerCase();
    if (!q) return products ?? [];
    return products?.filter((p: POSProduct) => 
      p.name?.toLowerCase().includes(q) || 
      p.sku?.toLowerCase().includes(q) || 
      p.barcode?.toLowerCase().includes(q)
    ) ?? [];
  }, [products, deferredSearchTerm]);

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.subtotal, 0), [cart]);
  
  const discountAmount = useMemo(() => {
    const raw = discountType === "percent" ? subtotal * (discount / 100) : discount;
    return Math.min(subtotal, Math.max(0, raw));
  }, [subtotal, discount, discountType]);

  const total = useMemo(() => Math.max(0, subtotal - discountAmount), [subtotal, discountAmount]);
  const taxAmount = 0;

  const printerPreviewInvoice = useMemo<PrintableInvoice | null>(() => {
    if (completedInvoice) return completedInvoice;
    if (cart.length === 0) return null;

    return {
      invoiceNumber: `DRAFT-${cart.length.toString().padStart(2, "0")}`,
      cartItems: cart.map(item => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        subtotal: item.subtotal,
        productId: item.productId,
      })),
      subtotal,
      discountAmount,
      total,
      paymentMethod,
      customerName: customerName || "عميل عام",
      customerPhone,
      createdAt: new Date().toISOString(),
    };
  }, [cart, completedInvoice, customerName, customerPhone, discountAmount, paymentMethod, subtotal, total]);

  const addToCart = useCallback(
    (product: any) => {
      native.vibrate();
      // Note 3: Using available stock limit for safety
      const result = addItem(product, product.quantity);
      if (!result.success) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message, { duration: 1000 });
    },
    [addItem]
  );

  const { handleBarcodeDetected } = usePOSBarcode({ products, isOffline, addToCart });

  const updateQuantity = useCallback(
    (productId: number, quantity: number) => {
      const product = products?.find((item: any) => item.id === productId);
      if (!product) return;
      const success = updateStoreQuantity(productId, quantity, product.quantity);
      if (!success) toast.error("تجاوز الحد المتوفر للمخزون", { duration: 1000 });
    },
    [products, updateStoreQuantity]
  );

  const handleStartNewSale = useCallback(() => {
    setShowCheckout(false);
    setCompletedInvoice(null);
    lastAutoPrintedInvoice.current = null;
  }, []);

  const { isProcessing, handleCheckout } = usePOSCheckout({
    cart, subtotal, taxAmount, discountAmount, total, paymentMethod, customerName, customerPhone,
    lastAutoPrintedInvoice, setCompletedInvoice, clearCart, setCustomerDetails, setDiscount,
  });

  // Touch Handling
  const handleTouchStart = (event: React.TouchEvent) => {
    const touch = event.targetTouches[0];
    if (!shouldTrackEdgeSwipe(event.target, touch.clientX)) {
      setTouchStartPos(null);
      return;
    }
    setTouchStartPos({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (!touchStartPos) return;
    const touchEndX = event.changedTouches[0].clientX;
    const touchEndY = event.changedTouches[0].clientY;
    const deltaX = touchStartPos.x - touchEndX;
    if (Math.abs(deltaX) > 100 && Math.abs(touchStartPos.y - touchEndY) < 50) {
      if (touchStartPos.x < 50 || touchStartPos.x > window.innerWidth - 50) {
        native.vibrate();
        navigate("/");
      }
    }
    setTouchStartPos(null);
  };

  const { syncPrinterSnapshot, handleBluetoothPrint } = printerActions;
  const { autoPrintEnabled, preferredPrinterId, preferredPrinterName } = printerState;

  useEffect(() => {
    void syncPrinterSnapshot(false);
  }, [syncPrinterSnapshot]);

  useEffect(() => {
    if (!completedInvoice || !autoPrintEnabled) return;
    if (!preferredPrinterId && !preferredPrinterName) return;
    if (lastAutoPrintedInvoice.current === completedInvoice.invoiceNumber) return;

    lastAutoPrintedInvoice.current = completedInvoice.invoiceNumber;
    void handleBluetoothPrint({ silent: true, invoice: completedInvoice });
  }, [completedInvoice, autoPrintEnabled, preferredPrinterId, preferredPrinterName, handleBluetoothPrint]);

  // Update sync count periodically for the badge
  useEffect(() => {
    const updateCount = async () => {
      const pending = await getJobsToSync();
      setPendingSyncCount(pending.length);
    };
    updateCount();
    const interval = setInterval(updateCount, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-background"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="pointer-events-none absolute left-0 top-0 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl opacity-50" />
      
      <div className="container relative z-10 h-screen space-y-4 overflow-hidden py-4 pb-24 lg:grid lg:grid-cols-12 lg:gap-8 lg:pb-6">
        <div className="flex h-full flex-col space-y-6 lg:col-span-8">
          <header className="glass-panel flex flex-col justify-between gap-4 rounded-2xl p-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="icon" className="h-12 w-12 rounded-xl border-border/40" onClick={() => navigate("/")}><ArrowRight className="h-5 w-5"/></Button>
              <div>
                <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight font-display"><Zap className="h-5 w-5 text-primary"/>نقطة البيع</h1>
                <p className="text-sm font-medium text-muted-foreground">التوافر الفوري للبيانات والمسح السريع</p>
              </div>
            </div>

            <div className="flex w-full gap-2 sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="ابحث هنا..."
                  value={searchTerm}
                  onChange={event => setSearchTerm(event.target.value)}
                  className="h-11 rounded-xl border-border/40 bg-background/50 pl-4 pr-10"
                />
              </div>
              <div className="relative">
                <Button 
                  onClick={() => setShowSyncHistory(true)} 
                  variant="outline" 
                  size="icon" 
                  className={`h-11 w-11 rounded-xl relative ${pendingSyncCount > 0 ? "border-orange-500/50 bg-orange-500/5" : ""}`}
                >
                  <Database className={`h-5 w-5 ${pendingSyncCount > 0 ? "text-orange-500" : ""}`} />
                  {pendingSyncCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white ring-2 ring-background">
                      {pendingSyncCount}
                    </span>
                  )}
                </Button>
              </div>
              <Button onClick={() => setShowPrinterSheet(true)} variant="outline" size="icon" className={`h-11 w-11 rounded-xl ${printerState.printerStatus.connected ? "bg-primary/10 text-primary border-primary/50" : ""}`}><Printer className="h-5 w-5"/></Button>
              <Button onClick={() => setShowBarcodeScanner(true)} variant="outline" size="icon" className="h-11 w-11 rounded-xl"><Barcode className="h-5 w-5"/></Button>
            </div>
          </header>

          <div className="scrollbar-none flex gap-2 overflow-x-auto pb-2 touch-pan-x">
            <Button variant={selectedCategory === "all" ? "default" : "outline"} className="rounded-full px-6" onClick={() => setSelectedCategory("all")}>الكل</Button>
            {categories?.map((cat: any) => (
              <Button key={cat.id} variant={selectedCategory === cat.id.toString() ? "default" : "outline"} className="rounded-full px-6" onClick={() => setSelectedCategory(cat.id.toString())}>{cat.name}</Button>
            ))}
          </div>

          <ProductGrid productsLoading={productsLoading} filteredProducts={filteredProducts} addToCart={addToCart} />
        </div>

        <CartSidebar cart={cart} subtotal={subtotal} discountAmount={discountAmount} total={total} updateQuantity={updateQuantity} onCheckout={() => setShowCheckout(true)} />

        <AnimatePresence>
          {cart.length > 0 && (
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className="fixed bottom-4 left-4 right-4 z-40 lg:hidden">
              <Button className="h-16 w-full gap-3 rounded-[24px] bg-primary/95 text-lg font-bold shadow-2xl backdrop-blur-md" onClick={() => setShowCheckout(true)}>
                <ShoppingCart className="h-5 w-5" />
                <span>إتمام الدفع</span>
                <span className="rounded-full bg-background/20 px-3 py-1 text-sm">{cart.length}</span>
                <span className="mr-auto text-xl font-display">{formatCurrency(total)}</span>
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <CheckoutDialog
        open={showCheckout}
        onOpenChange={setShowCheckout}
        completedInvoice={completedInvoice}
        isProcessing={isProcessing}
        isPrintingReceipt={printerState.isPrintingReceipt}
        subtotal={subtotal}
        total={total}
        discount={discount}
        discountType={discountType}
        paymentMethod={paymentMethod}
        customerName={customerName}
        customerPhone={customerPhone}
        setCustomerDetails={setCustomerDetails}
        setDiscount={setDiscount}
        setDiscountType={setDiscountType}
        setPaymentMethod={setPaymentMethod}
        handleCheckout={handleCheckout}
        handleBluetoothPrint={() => void printerActions.handleBluetoothPrint()}
        handleStartNewSale={handleStartNewSale}
        setShowPrinterSheet={setShowPrinterSheet}
      />

      <SyncHistorySheet open={showSyncHistory} onOpenChange={setShowSyncHistory} />

      <BarcodeScanner isOpen={showBarcodeScanner} onClose={() => setShowBarcodeScanner(false)} onBarcodeDetected={handleBarcodeDetected} />

      <BluetoothPrinterSheet
        open={showPrinterSheet}
        onOpenChange={setShowPrinterSheet}
        status={printerState.printerStatus}
        printers={printerState.knownPrinters}
        preferredPrinterId={printerState.preferredPrinterId}
        preferredPrinterName={printerState.preferredPrinterName}
        autoPrintEnabled={printerState.autoPrintEnabled}
        paperWidth={printerState.paperWidth}
        printCopies={printerState.printCopies}
        cutAfterPrint={printerState.cutAfterPrint}
        previewInvoice={printerPreviewInvoice}
        previewTitle={completedInvoice ? "آخر فاتورة مكتملة" : "معاينة قبل الطباعة"}
        previewDescription={completedInvoice ? "معاينة لآخر فاتورة تم إنهاؤها." : "معاينة من السلة الحالية."}
        isRefreshing={printerState.isRefreshingPrinters}
        isConnecting={printerState.isConnectingPrinter}
        isPrinting={printerState.isPrintingReceipt}
        hasInvoice={Boolean(completedInvoice)}
        onRefresh={() => void printerActions.refreshPrinterCenter(true)}
        onConnect={p => void printerActions.handleConnectPrinter(p)}
        onDisconnect={() => void printerActions.handleDisconnectPrinter()}
        onPrintTest={() => void printerActions.handleTestPrint()}
        onPrintCurrent={() => void printerActions.handleBluetoothPrint()}
        onAutoPrintChange={printerSetters.setAutoPrintEnabled}
        onPaperWidthChange={printerSetters.setPaperWidth}
        onPrintCopiesChange={printerSetters.setPrintCopies}
        onCutAfterPrintChange={printerSetters.setCutAfterPrint}
        onForgetPrinter={() => void printerActions.handleForgetPrinter()}
      />
    </div>
  );
}
