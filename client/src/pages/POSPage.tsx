import { useState, useMemo, useCallback, useDeferredValue, useEffect, useRef } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { thermalPrinter } from "@/lib/bluetooth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash2, Loader2, Search, Plus, Minus, Barcode, Printer, CheckCircle2, ArrowRight, ShoppingCart, Zap } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import BarcodeScanner from "@/components/BarcodeScanner";
import { RETURN_POLICIES, STORE_BRANCHES, STORE_NAME } from "@/lib/invoice";
import { formatCurrency } from "@/lib/utils";
import { native } from "@/_core/native";
import { useCartStore } from "@/stores/cartStore";

interface CartItem {
  productId: number;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
}

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
  const { cart, discount, discountType, paymentMethod, customerName, customerPhone, addItem, updateQuantity: updateStoreQuantity, removeItem: removeStoreItem, setDiscount, setDiscountType, setCustomerDetails, setPaymentMethod, clearCart } = useCartStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [taxRate] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [completedInvoice, setCompletedInvoice] = useState<any>(null);
  const [touchStartPos, setTouchStartPos] = useState<{ x: number, y: number } | null>(null);

  const { data: products, isLoading: productsLoading } = trpc.products.list.useQuery(
    selectedCategory && selectedCategory !== "all" ? parseInt(selectedCategory) : undefined
  );
  const { data: categories } = trpc.categories.list.useQuery();
  const checkoutMutation = trpc.sales.checkout.useMutation();
  const utils = trpc.useUtils();

  const deferredSearchTerm = useDeferredValue(searchTerm);

  const filteredProducts = useMemo(() => {
    return products?.filter((p: any) =>
      p.name.includes(deferredSearchTerm) || p.sku.includes(deferredSearchTerm) || p.barcode?.includes(deferredSearchTerm)
    ) || [];
  }, [products, deferredSearchTerm]);

  const addToCart = useCallback((product: any) => {
    native.vibrate();
    const result = addItem(product, product.quantity);
    if (!result.success) {
      toast.error(result.message, { className: "font-display text-destructive border-destructive" });
    } else {
      toast.success(result.message, { duration: 1000 });
    }
  }, [addItem]);

  const handleBarcodeDetectedLocal = useCallback((barcode: string) => {
    if (!products) return;
    const product = products.find((p: any) => p.barcode === barcode || p.sku === barcode);
    if (product) {
      addToCart(product);
    } else {
      toast.error(`الرقم ${barcode} غير معرّف في النظام`, { className: "font-display" });
    }
  }, [products, addToCart]);

  const handleBarcodeDetected = useCallback(async (barcode: string) => {
    const trimmedCode = barcode.trim();

    if (!trimmedCode) {
      return;
    }

    const productFromVisibleList = products?.find(
      (p: any) => p.barcode === trimmedCode || p.sku === trimmedCode
    );

    if (productFromVisibleList) {
      handleBarcodeDetectedLocal(trimmedCode);
      return;
    }

    try {
      const product =
        (await utils.products.getByBarcode.fetch(trimmedCode)) ||
        (await utils.products.getBySku.fetch(trimmedCode));

      if (product) {
        addToCart(product);
        return;
      }

      toast.error(`الرقم ${trimmedCode} غير معرّف في النظام`, {
        className: "font-display",
      });
    } catch (error) {
      console.error("Barcode lookup error:", error);
      toast.error("تعذر العثور على المنتج. تحقق من اتصال التطبيق بالخادم.");
    }
  }, [handleBarcodeDetectedLocal, addToCart, products, utils.products.getByBarcode, utils.products.getBySku]);

  // Hardware Barcode Scanner Listener (Global)
  const barcodeBuffer = useRef("");
  const barcodeTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field (except the search bar which we might want to override, but logically we ignore inputs)
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }
      
      if (e.key === 'Enter') {
        if (barcodeBuffer.current.length > 3) {
          void handleBarcodeDetected(barcodeBuffer.current);
          barcodeBuffer.current = "";
        }
        return;
      }

      // Barcode scanners act like very fast keyboards
      if (e.key.length === 1) {
        barcodeBuffer.current += e.key;
        
        // Reset buffer if no key is pressed within 100ms (human typing is slower)
        if (barcodeTimeout.current) clearTimeout(barcodeTimeout.current);
        barcodeTimeout.current = setTimeout(() => {
          barcodeBuffer.current = "";
        }, 100);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (barcodeTimeout.current) clearTimeout(barcodeTimeout.current);
    };
  }, [handleBarcodeDetected]);


  const removeFromCart = useCallback((productId: number) => {
    removeStoreItem(productId);
  }, [removeStoreItem]);

  const updateQuantity = useCallback((productId: number, quantity: number) => {
    const product = products?.find((p: any) => p.id === productId);
    if (!product) return;
    const success = updateStoreQuantity(productId, quantity, product.quantity);
    if (!success) toast.error("تجاوز الحد المتوفر للمخزون", { duration: 1000 });
  }, [products, updateStoreQuantity]);

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.subtotal, 0), [cart]);
  const discountAmount = useMemo(() => {
    return discountType === "percent" ? (subtotal * (discount / 100)) : discount;
  }, [subtotal, discount, discountType]);
  const total = useMemo(() => subtotal - discountAmount, [subtotal, discountAmount]);
  const taxAmount = 0;

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    setIsProcessing(true);
    try {
      const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
      
      const sale = await checkoutMutation.mutateAsync({
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
      });

      utils.products.list.invalidate();

      toast.success("تم إتمام دورة البيع بنجاح", { className: "font-display bg-primary text-primary-foreground border-primary" });
      setCompletedInvoice({
        ...sale,
        invoiceNumber,
        cartItems: [...cart],
        total,
        discountAmount,
        taxAmount,
        subtotal
      });
      clearCart();
      
      setCustomerDetails("", "");
      setDiscount(0);
    } catch (error) {
      toast.error("تعذر إتمام العملية، يرجى المحاولة مرة أخرى.");
      console.error("Checkout Error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.targetTouches[0];

    if (!shouldTrackEdgeSwipe(e.target, touch.clientX)) {
      setTouchStartPos(null);
      return;
    }

    setTouchStartPos({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartPos) return;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    
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

  const handleBluetoothPrint = async () => {
    toast.loading("جاري الاتصال بالطابعة", { id: "bt-print" });

    try {
      await thermalPrinter.printRasterReceipt(completedInvoice);
      toast.success("تم الإرسال للطابعة", { id: "bt-print" });
    } catch (e: any) {
      if (e?.code === "cancelled") {
        toast.info(e.message || "تم إلغاء اختيار الطابعة", { id: "bt-print" });
        return;
      }

      toast.error(e?.message || "تأكد من تفعيل طابعة البلوتوث", { id: "bt-print" });
    }
  };

  return (
    <div 
      className="min-h-screen bg-background relative overflow-hidden" 
      onTouchStart={handleTouchStart} 
      onTouchEnd={handleTouchEnd}
    >
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-0 right-0 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl pointer-events-none translate-x-1/3 translate-y-1/3"></div>

      <div className="container py-4 relative z-10 space-y-4 pb-24 lg:pb-6 lg:grid lg:grid-cols-12 lg:gap-8 h-screen overflow-hidden">
        
        {/* ======== المنيتجات (Products Area) ======== */}
        <div className="lg:col-span-8 flex flex-col h-full space-y-6">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-4 rounded-2xl">
            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                size="icon" 
                className="rounded-xl w-12 h-12 shadow-sm border-border/40 hover:bg-muted"
                onClick={() => navigate("/")}
              >
                <ArrowRight className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-display font-bold tracking-tight text-foreground flex items-center gap-2">
                  <Zap className="w-5 h-5 text-primary" />
                  محطة المبيعات 
                </h1>
                <p className="text-muted-foreground text-sm font-medium">استخدم الكاميرا أو ماسح الباركود الخارجي فوراً</p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="ابحث هنا..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-4 pr-10 h-11 bg-background/50 border-border/40 focus:border-primary rounded-xl"
                />
              </div>
              <Button
                onClick={() => setShowBarcodeScanner(true)}
                className="h-11 w-11 rounded-xl glass-panel shadow-sm hover:border-primary transition-colors"
                variant="outline"
                size="icon"
              >
                <Barcode className="w-5 h-5 text-foreground" />
              </Button>
            </div>
          </div>

          {/* Categories Tab (Minimal) */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none touch-pan-x" data-no-edge-swipe>
            <Button 
              type="button"
              variant={selectedCategory === "all" ? "default" : "outline"}
              className={`rounded-full px-6 font-display shadow-none touch-manipulation ${selectedCategory !== "all" && "bg-background/40 border-border/30"}`}
              onClick={() => setSelectedCategory("all")}
            >
              الكل
            </Button>
            {categories?.map((cat: any) => (
              <Button 
                type="button"
                key={cat.id}
                variant={selectedCategory === cat.id.toString() ? "default" : "outline"}
                className={`rounded-full px-6 font-display shadow-none whitespace-nowrap touch-manipulation ${selectedCategory !== cat.id.toString() && "bg-background/40 border-border/30"}`}
                onClick={() => setSelectedCategory(cat.id.toString())}
              >
                {cat.name}
              </Button>
            ))}
          </div>

          {/* Products Grid */}
          <div className="flex-1 overflow-y-auto pb-4 pr-1">
            {productsLoading ? (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredProducts.length > 0 ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredProducts.map((product: any) => (
                  <motion.div
                    whileHover={{ y: -4, scale: 1.01 }}
                    whileTap={{ scale: 0.96 }}
                    key={product.id}
                  >
                    <Card
                      className="h-full border border-border/30 bg-background/40 backdrop-blur-sm hover:border-primary/50 transition-all cursor-pointer overflow-hidden rounded-2xl shadow-sm"
                      onClick={(e) => { e.preventDefault(); addToCart(product); }}
                    >
                      {product.imageUrl ? (
                        <div className="relative h-32 w-full overflow-hidden bg-muted">
                           <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="h-32 w-full bg-gradient-to-br from-muted/50 to-muted flex items-center justify-center">
                           <ShoppingCart className="w-8 h-8 text-muted-foreground/30" />
                        </div>
                      )}
                      <CardContent className="p-4 flex flex-col justify-between h-[104px]">
                        <div>
                          <p className="font-display font-semibold text-foreground text-sm truncate">{product.name}</p>
                          <div className="flex items-center gap-1.5 mt-1 border-t border-border/10 pt-1">
                            <span className="text-[9px] text-muted-foreground font-mono uppercase tracking-tighter truncate">#{product.barcode || product.sku}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <p className="font-bold text-lg text-primary tracking-tight">{formatCurrency(product.price)}</p>
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${product.quantity > 0 ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                            {product.quantity > 0 ? `${product.quantity} متوفر` : 'نفد'}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center glass-panel rounded-2xl border-dashed">
                <p className="text-muted-foreground font-display">لا توجد منتجات تطابق بحثك</p>
              </div>
            )}
          </div>
        </div>

        {/* ======== السلة (Cart Area) ======== */}
        <div className="hidden lg:flex lg:col-span-4 flex-col h-full">
          <div className="glass-panel flex-1 rounded-3xl flex flex-col overflow-hidden relative shadow-2xl border-white/5 dark:border-white/5">
            <div className="p-6 pb-4 border-b border-border/30 bg-background/50">
              <h2 className="text-xl font-display font-bold flex justify-between items-center">
                <span>سلة المشتريات</span>
                <span className="bg-primary text-primary-foreground text-sm px-3 py-1 rounded-full">{cart.length}</span>
              </h2>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <AnimatePresence mode="popLayout">
                {cart.length > 0 ? (
                  cart.map((item) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      key={item.productId}
                      className="group p-3 bg-background/80 border border-border/40 rounded-2xl hover:border-primary/40 transition-colors"
                    >
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <p className="font-display font-medium text-sm text-foreground line-clamp-1">{item.name}</p>
                          <p className="text-xs text-muted-foreground mt-1">{formatCurrency(item.price)}</p>
                        </div>
                        <div className="text-left flex flex-col items-end justify-between">
                          <p className="font-bold text-accent">{formatCurrency(item.subtotal)}</p>
                          <div className="flex items-center gap-1 mt-2 bg-muted/50 p-1 rounded-lg">
                            <button
                              className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-background text-muted-foreground hover:text-foreground transition-colors"
                              onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-8 text-center text-xs font-bold">{item.quantity}</span>
                            <button
                              className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-background text-muted-foreground hover:text-foreground transition-colors"
                              onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground/50 opacity-50 space-y-4">
                    <ShoppingCart className="w-16 h-16" />
                    <p className="font-display">قم بمسح باركود لبدء البيع</p>
                  </div>
                )}
              </AnimatePresence>
            </div>

            {/* Cart Summary */}
            <div className="p-6 bg-background/90 border-t border-border/30 space-y-4">
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
                <div className="flex justify-between text-2xl font-display font-bold text-primary pt-2 border-t border-border/40 mt-2">
                  <span>الإجمالي</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>

              <Button
                className="w-full h-14 text-lg font-bold font-display shadow-lg shadow-primary/20 rounded-2xl tracking-wide group"
                onClick={() => setShowCheckout(true)}
                disabled={cart.length === 0}
              >
                تحديث الدفع
                <ArrowRight className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Floating Cart Button (Avant-Garde Style) */}
        <AnimatePresence>
          {cart.length > 0 && (
            <motion.div 
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="fixed bottom-4 left-4 right-4 lg:hidden z-40"
            >
              <Button
                className="w-full h-16 text-lg font-display font-bold shadow-2xl shadow-primary/30 rounded-[24px] gap-3 backdrop-blur-md bg-primary/95"
                onClick={() => setShowCheckout(true)}
              >
                <ShoppingCart className="w-5 h-5 flex-shrink-0" />
                <span>إتمام الدفع</span>
                <span className="bg-background/20 px-3 py-1 rounded-full text-sm">{cart.length}</span>
                <span className="mr-auto text-xl">{formatCurrency(total)}</span>
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Checkout Dialog (Glassy, Minimalist) */}
      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent aria-describedby={undefined} className="max-w-md sm:max-w-lg p-0 border-0 glass-panel overflow-hidden rounded-[32px]">
          {completedInvoice ? (
            <div className="p-8 space-y-8">
              <div className="text-center space-y-3 no-print">
                <div className="mx-auto w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-green-500" />
                </div>
                <h2 className="text-3xl font-display font-bold text-foreground">عملية ناجحة</h2>
                <p className="text-muted-foreground font-mono">{completedInvoice.invoiceNumber}</p>
              </div>

              {/* Printable Area - Modern Monochrome */}
              <div className="bg-white text-black p-6 rounded-2xl shadow-inner print:shadow-none print:p-0 mx-auto max-w-[320px]">
                <div className="text-center mb-6 border-b-2 border-dashed border-gray-200 pb-4">
                  <h3 className="text-2xl font-black font-display tracking-tight">{STORE_NAME}</h3>
                  <p className="text-[11px] font-semibold text-gray-500 mt-2">الفروع</p>
                  <p className="text-[11px] leading-5 text-gray-600 mt-1">{STORE_BRANCHES.join("، ")}</p>
                </div>
                
                <div className="flex justify-between text-[10px] mb-4 text-gray-400 font-mono">
                  <span>{completedInvoice.invoiceNumber}</span>
                  <span>{new Date().toLocaleString("ar-SA", { dateStyle: 'short', timeStyle: 'short' })}</span>
                </div>
                
                <div className="space-y-3 mb-6">
                  {completedInvoice.cartItems?.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-xs items-start">
                      <div className="flex flex-col flex-1 pr-4">
                        <span className="font-bold">{item.name}</span>
                        <span className="text-[10px] text-gray-400 mt-0.5">{item.quantity} × {formatCurrency(item.price)}</span>
                      </div>
                      <span className="font-bold pt-0.5">{formatCurrency(item.subtotal)}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t-2 border-gray-900 pt-3 space-y-2">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>المجموع</span>
                    <span>{formatCurrency(completedInvoice.subtotal)}</span>
                  </div>
                  {completedInvoice.discountAmount > 0 && (
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>الخصم</span>
                      <span>-{formatCurrency(completedInvoice.discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-black text-xl mt-3">
                    <span>الصافي</span>
                    <span>{formatCurrency(completedInvoice.total)}</span>
                  </div>
                </div>

                <div className="mt-6 border-t border-dashed border-gray-300 pt-4 text-center">
                  <p className="text-[11px] font-bold text-gray-700 mb-2">سياسة الإرجاع</p>
                  <div className="space-y-1 text-[10px] leading-5 text-gray-600">
                    {RETURN_POLICIES.map((policy) => (
                      <p key={policy}>{policy}</p>
                    ))}
                  </div>
                </div>
                
                <div className="mt-8 opacity-50 grayscale flex justify-center">
                  <Barcode className="w-32 h-10" />
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-3 no-print">
                <Button 
                  className="w-full h-14 rounded-2xl gap-2 font-display text-lg" 
                  onClick={handleBluetoothPrint}
                >
                  <Printer className="w-5 h-5" /> طباعة الإيصال
                </Button>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => window.print()}>
                    PDF / سلكية
                  </Button>
                  <Button variant="secondary" className="flex-1 h-12 rounded-xl" onClick={() => { setShowCheckout(false); setCompletedInvoice(null); }}>
                    عملية جديدة
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8">
              <DialogHeader className="mb-6">
                <DialogTitle className="text-2xl font-display font-bold">ملخص الدفع</DialogTitle>
                <DialogDescription>استكمال بيانات المبيعات الحالية</DialogDescription>
              </DialogHeader>
              <div className="space-y-5">
                <div className="space-y-4">
                  <div className="relative">
                    <Input
                      value={customerName}
                      onChange={(e) => setCustomerDetails(e.target.value, customerPhone)}
                      placeholder="اسم العميل (اختياري)"
                      className="h-12 bg-background/50 border-border/50 rounded-xl"
                    />
                  </div>
                  
                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <Input
                        type="number"
                        value={discount === 0 ? "" : discount}
                        onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                        placeholder={`الخصم (${discountType === "percent" ? "%" : "د.ع"})`}
                        className="h-12 bg-background/50 border-border/50 rounded-xl"
                      />
                    </div>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setDiscountType(discountType === "percent" ? "amount" : "percent")}
                      className="h-12 w-12 rounded-xl font-display font-bold text-lg"
                    >
                      {discountType === "percent" ? "%" : "$"}
                    </Button>
                  </div>

                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="h-12 bg-background/50 border-border/50 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="cash">نقداً</SelectItem>
                      <SelectItem value="card">بطاقة ائتمان</SelectItem>
                      <SelectItem value="transfer">تحويل بنكي</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="bg-primary/10 border border-primary/20 p-5 rounded-2xl flex justify-between items-center">
                  <span className="font-display font-medium text-foreground">الإجمالي المستحق</span>
                  <span className="font-black text-2xl text-primary">{formatCurrency(total)}</span>
                </div>

                <Button
                  className="w-full h-14 text-lg font-bold font-display rounded-xl shadow-lg shadow-primary/25"
                  onClick={handleCheckout}
                  disabled={isProcessing}
                >
                  {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : "تأكيد واستلام المبلغ"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Barcode Scanner Modal Component */}
      <BarcodeScanner
        isOpen={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onBarcodeDetected={handleBarcodeDetected}
      />
    </div>
  );
}
