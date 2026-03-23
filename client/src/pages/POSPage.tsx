import { useState, useMemo, useCallback, useDeferredValue, useEffect } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { thermalPrinter } from "@/lib/bluetooth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash2, Loader2, Search, Plus, Minus, Barcode, Printer, Send, CheckCircle2, ArrowRight, ShoppingCart } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import BarcodeScanner from "@/components/BarcodeScanner";
import { formatCurrency } from "@/lib/utils";
import { native } from "@/_core/native";

interface CartItem {
  productId: number;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
}

export default function POSPage() {
  const [, navigate] = useLocation();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [taxRate] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [completedInvoice, setCompletedInvoice] = useState<any>(null);
  const [touchStartPos, setTouchStartPos] = useState<{ x: number, y: number } | null>(null);

  const { data: products, isLoading: productsLoading } = trpc.products.list.useQuery(
    selectedCategory && selectedCategory !== "all" ? parseInt(selectedCategory) : undefined
  );
  const { data: categories } = trpc.categories.list.useQuery();
  const createSaleMutation = trpc.sales.create.useMutation();
  const addItemMutation = trpc.sales.addItem.useMutation();
  const updateProductMutation = trpc.products.update.useMutation();
  const utils = trpc.useUtils();

  const deferredSearchTerm = useDeferredValue(searchTerm);

  const filteredProducts = useMemo(() => {
    return products?.filter((p: any) =>
      p.name.includes(deferredSearchTerm) || p.sku.includes(deferredSearchTerm) || p.barcode?.includes(deferredSearchTerm)
    ) || [];
  }, [products, deferredSearchTerm]);

  const addToCart = useCallback((product: any) => {
    native.vibrate();
    if (product.quantity <= 0) {
      toast.error("المنتج غير متوفر في المخزون");
      return;
    }

    const existingItem = cart.find(item => item.productId === product.id);
    if (existingItem) {
      if (existingItem.quantity >= product.quantity) {
        toast.error("لا يمكن إضافة أكثر من الكمية المتوفرة");
        return;
      }
      setCart(cart.map(item =>
        item.productId === product.id
          ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.price }
          : item
      ));
    } else {
      setCart([...cart, {
        productId: product.id,
        name: product.name,
        price: parseFloat(product.price),
        quantity: 1,
        subtotal: parseFloat(product.price),
      }]);
    }
    toast.success("تم إضافة المنتج إلى السلة", { duration: 1500 });
  }, [cart]);

  const removeFromCart = useCallback((productId: number) => {
    setCart((current) => current.filter(item => item.productId !== productId));
  }, []);

  const updateQuantity = useCallback((productId: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((current) => current.map(item =>
      item.productId === productId
        ? { ...item, quantity, subtotal: quantity * item.price }
        : item
    ));
  }, [removeFromCart]);

  const handleSwipeDelete = useCallback((info: PanInfo, productId: number) => {
    // إيماءة الحذف إذا تم السحب يميناً أو يساراً بمقدار يتجاوز 80 بكسل
    if (info.offset.x > 80 || info.offset.x < -80) {
      removeFromCart(productId);
    }
  }, [removeFromCart]);

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.subtotal, 0), [cart]);
  const discountAmount = useMemo(() => {
    return discountType === "percent" ? (subtotal * (discount / 100)) : discount;
  }, [subtotal, discount, discountType]);
  const total = useMemo(() => subtotal - discountAmount, [subtotal, discountAmount]);
  const taxAmount = 0;

  const handleBarcodeDetected = useCallback((barcode: string) => {
    // Find product by barcode
    const product = products?.find((p: any) => p.barcode === barcode);
    if (product) {
      addToCart(product);
    } else {
      toast.error("المنتج غير موجود");
    }
  }, [products, addToCart]);

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error("السلة فارغة");
      return;
    }

    setIsProcessing(true);
    try {
      const invoiceNumber = `INV-${Date.now()}`;
      
      const sale = await createSaleMutation.mutateAsync({
        invoiceNumber,
        totalAmount: subtotal.toString(),
        taxAmount: taxAmount.toString(),
        discountAmount: discountAmount.toString(),
        finalAmount: total.toString(),
        paymentMethod,
        customerName: customerName || "عميل عام",
        customerPhone,
        notes: "",
      });

      // Add items to sale and update stock
      for (const item of cart) {
        // Create sale item
        await addItemMutation.mutateAsync({
          saleId: sale.insertId,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.price.toString(),
          subtotal: item.subtotal.toString(),
        });

        // Reduce stock
        const product = products?.find((p: any) => p.id === item.productId);
        if (product) {
          await updateProductMutation.mutateAsync({
            id: item.productId,
            quantity: Math.max(0, product.quantity - item.quantity),
          });
        }
      }

      utils.products.list.invalidate();

      toast.success("تم إتمام البيع بنجاح!");
      setCompletedInvoice({
        ...(sale as any) || {},
        invoiceNumber,
        cartItems: [...cart],
        total,
        discountAmount,
        taxAmount,
        subtotal
      });
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setDiscount(0);
      // Keep showCheckout true to show the invoice view
    } catch (error) {
      toast.error("حدث خطأ أثناء إتمام البيع");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartPos({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartPos) return;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    
    const deltaX = touchStartPos.x - touchEndX;
    const deltaY = Math.abs(touchStartPos.y - touchEndY);
    
    // إذا كان السحب أفقياً (أكبر من 100 بكسل) ولم يكن مائلاً كثيراً عمودياً
    if (Math.abs(deltaX) > 100 && deltaY < 50) {
      // التحقق مما إذا كان السحب قد بدأ من حواف الشاشة (أول 50 بكسل من اليمين أو اليسار)
      const isFromLeftEdge = touchStartPos.x < 50;
      const isFromRightEdge = touchStartPos.x > window.innerWidth - 50;
      
      if (isFromLeftEdge || isFromRightEdge) {
        native.vibrate();
        navigate("/"); // الخروج والعودة للرئيسية
      }
    }
    setTouchStartPos(null);
  };

  return (
    <div 
      className="min-h-screen" 
      onTouchStart={handleTouchStart} 
      onTouchEnd={handleTouchEnd}
    >
      {/* Products Section */}
      <div className="space-y-4 pb-20 lg:pb-0 lg:grid lg:grid-cols-3 lg:gap-6">
      <div className="lg:col-span-2 space-y-4">
        <div className="mb-4 flex items-center gap-3">
          <Button 
            variant="outline" 
            size="icon" 
            className="rounded-full flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10"
            onClick={() => navigate("/")}
          >
            <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">نقطة البيع</h1>
            <p className="text-foreground/50 mt-0.5 font-medium text-xs sm:text-sm">تجربة بيع سلسة، سريعة، وأنيقة.</p>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-wrap gap-2 sm:gap-4">
          <div className="flex-1 min-w-[180px] relative">
            <Search className="absolute right-3 top-3 w-4 h-4 text-foreground/40" />
            <Input
              placeholder="ابحث بالاسم أو الباركود..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-4 pr-10"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-32 sm:w-48">
              <SelectValue placeholder="جميع الفئات" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الفئات</SelectItem>
              {categories?.map((cat: any) => (
                <SelectItem key={cat.id} value={cat.id.toString()}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => setShowBarcodeScanner(true)}
            className="gap-2"
            variant="outline"
            size="icon"
          >
            <Barcode className="w-4 h-4" />
          </Button>
        </div>

        {/* Products Grid */}
        {productsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
            {filteredProducts.map((product: any) => (
              <Card
                key={product.id}
                className="border-border/50 hover:shadow-lg transition-all cursor-pointer"
                onClick={(e) => {
                  /* Prevent double tap zooming and phantom clicks */
                  e.preventDefault();
                  addToCart(product);
                }}
              >
                {product.imageUrl && (
                  <img src={product.imageUrl} alt={product.name} className="w-full h-32 object-cover rounded-t-lg" />
                )}
                <CardContent className="p-3">
                  <p className="font-semibold text-foreground text-sm truncate">{product.name}</p>
                  <p className="text-xs text-foreground/60 mb-2">{product.sku}</p>
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-accent">{formatCurrency(product.price)}</p>
                    <span className={`text-xs px-2 py-1 rounded ${product.quantity > 0 ? "bg-accent/20 text-accent" : "bg-destructive/20 text-destructive"}`}>
                      {product.quantity}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-border/50">
            <CardContent className="py-12 text-center">
              <p className="text-foreground/60">لا توجد منتجات متطابقة</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Cart Section - hidden on mobile, shown on desktop */}
      <div className="hidden lg:block space-y-4">
        <Card className="border-border/30 bg-background/50 backdrop-blur-xl shadow-2xl sticky top-4">
          <CardHeader>
            <CardTitle>السلة</CardTitle>
            <CardDescription>{cart.length} منتج</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Cart Items */}
            <div className="space-y-3 max-h-[60vh] lg:max-h-64 overflow-y-auto overflow-x-hidden p-1">
              <AnimatePresence mode="popLayout">
                {cart.length > 0 ? (
                  cart.map((item) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, scale: 0.95, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, x: -100, scale: 0.8 }}
                      transition={{ type: "spring", stiffness: 350, damping: 25 }}
                      key={item.productId}
                      className="relative rounded-xl overflow-hidden"
                    >
                      {/* خلفية الحذف الحمراء تظهر تحت العنصر أُثناء السحب */}
                      <div className="absolute inset-0 bg-destructive flex items-center justify-between px-4 rounded-xl">
                        <Trash2 className="w-5 h-5 text-destructive-foreground animate-pulse" />
                        <Trash2 className="w-5 h-5 text-destructive-foreground animate-pulse" />
                      </div>
                      
                      <motion.div 
                        drag="x"
                        dragConstraints={{ left: 0, right: 0 }}
                        dragElastic={0.6}
                        onDragEnd={(_, info) => handleSwipeDelete(info, item.productId)}
                        className="p-4 bg-background/95 backdrop-blur-sm shadow-sm border border-border/40 rounded-xl relative z-10 touch-pan-y"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-semibold text-foreground text-sm">{item.name}</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8"
                            onClick={() => removeFromCart(item.productId)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs text-foreground/60">{formatCurrency(item.price)}</p>
                          <p className="font-bold text-accent">{formatCurrency(item.subtotal)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-10 sm:w-8"
                            onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <Input
                            type="number"
                            value={item.quantity}
                            readOnly
                            className="text-center h-8 w-14 sm:w-12 text-sm font-bold bg-muted/50"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-10 sm:w-8"
                            onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                      </motion.div>
                    </motion.div>
                  ))
                ) : (
                  <motion.p 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    className="text-foreground/60 text-center py-8"
                  >
                    السلة فارغة
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Summary */}
            {cart.length > 0 && (
              <div className="space-y-2 pt-4 border-t border-border">
                <div className="flex justify-between text-sm">
                  <span className="text-foreground/60">الإجمالي الفرعي</span>
                  <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-foreground/60">الخصم ({discount}%)</span>
                  <span className="font-medium text-destructive">-{formatCurrency(discountAmount)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
                  <span>الإجمالي</span>
                  <span className="text-accent">{formatCurrency(total)}</span>
                </div>
              </div>
            )}

            <Button
              className="w-full h-12 text-lg font-bold shadow-lg shadow-accent/20 hover:shadow-accent/40 transition-all rounded-xl"
              onClick={() => setShowCheckout(true)}
              disabled={cart.length === 0}
            >
              إتمام البيع
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Mobile Floating Cart Button */}
      {cart.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 lg:hidden z-40">
          <Button
            className="w-full h-14 text-lg font-bold shadow-2xl shadow-accent/30 rounded-2xl gap-3"
            onClick={() => setShowCheckout(true)}
          >
            <ShoppingCart className="w-5 h-5" />
            <span>إتمام البيع</span>
            <span className="bg-white/20 px-2.5 py-0.5 rounded-full text-sm">{cart.length}</span>
            <span className="mr-auto font-bold">{formatCurrency(total)}</span>
          </Button>
        </div>
      )}
      </div>

      {/* Checkout Dialog */}
      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent aria-describedby={undefined} className="max-w-md sm:max-w-lg print-container bg-background">
          {completedInvoice ? (
            <div className="space-y-6">
              <div className="text-center space-y-2 no-print">
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
                <h2 className="text-2xl font-bold">اكتمل الطلب بنجاح!</h2>
                <p className="text-foreground/60">{completedInvoice.invoiceNumber}</p>
              </div>

              {/* Printable Area */}
              <div className="bg-white text-black p-6 rounded-lg border border-border/50 shadow-sm print:shadow-none print:border-none print-container mx-auto max-w-[350px]">
                <div className="text-center mb-4 pb-4 border-b border-dashed border-gray-300">
                  <h3 className="text-2xl font-bold tracking-tight">نـبـض</h3>
                  <p className="text-sm font-medium">للبيع بالتجزئة والتكنلوجيا</p>
                  <p className="text-[10px] text-gray-500 mt-1">بغداد، الكرادة، شارع 62</p>
                  <p className="text-[10px] text-gray-500">هاتف: 07800000000</p>
                </div>
                
                <div className="flex justify-between text-[11px] mb-4 text-gray-600">
                  <span>فاتورة: {completedInvoice.invoiceNumber}</span>
                  <span>{new Date().toLocaleDateString("ar-SA")}</span>
                </div>
                
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between font-bold text-xs uppercase border-b border-gray-200 pb-1">
                    <span>المنتج</span>
                    <span>المجموع</span>
                  </div>
                  {completedInvoice.cartItems?.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-xs py-0.5">
                      <div className="flex flex-col">
                        <span>{item.name}</span>
                        <span className="text-[10px] text-gray-500">{item.quantity} × {formatCurrency(item.price)}</span>
                      </div>
                      <span className="font-medium">{formatCurrency(item.subtotal)}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5 border-t border-dashed border-gray-300 pt-3">
                  <div className="flex justify-between text-xs">
                    <span>المجموع الفرعي:</span>
                    <span>{formatCurrency(completedInvoice.subtotal)}</span>
                  </div>
                  {completedInvoice.discountAmount > 0 && (
                    <div className="flex justify-between text-xs text-gray-700">
                      <span>الخصم:</span>
                      <span>-{formatCurrency(completedInvoice.discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg mt-2 border-t border-double border-gray-400 pt-2">
                    <span>الإجمالي:</span>
                    <span>{formatCurrency(completedInvoice.total)}</span>
                  </div>
                </div>
                
                <div className="text-center mt-6 pt-4 border-t border-gray-100">
                  <p className="text-[10px] font-medium italic">شكراً لزيارتكم، نرجو رؤيتكم قريباً!</p>
                  <div className="mt-2 flex justify-center opacity-20">
                    <Barcode className="w-24 h-8" />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3 no-print">
                <Button 
                  className="flex-1 gap-2 bg-accent hover:bg-accent/90 text-accent-foreground border-transparent shadow-lg shadow-accent/20" 
                  onClick={async () => {
                    try {
                        toast.loading("جاري الاتصال بالطابعة...", { id: "bt-print" });
                        await thermalPrinter.printRasterReceipt(completedInvoice);
                        toast.success("تم الإرسال للطابعة بنجاح 🖨️", { id: "bt-print" });
                    } catch (e: any) {
                        toast.error(e.message || "فشلت عملية الطباعة. تأكد من تفعيل البلوتوث", { id: "bt-print" });
                    }
                  }}
                >
                  <Printer className="w-4 h-4" /> طباعة البلوتوث
                </Button>
                <Button 
                  className="flex-1 gap-2" 
                  variant="outline" 
                  onClick={() => window.print()}
                >
                  <Printer className="w-4 h-4" /> طباعة سلكية / PDF
                </Button>
              </div>
              
              <Button 
                className="w-full no-print" 
                onClick={() => { setShowCheckout(false); setCompletedInvoice(null); }}
              >
                طلب جديد
              </Button>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>إتمام البيع</DialogTitle>
                <DialogDescription>
                  أدخل تفاصيل العميل وطريقة الدفع
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground">اسم العميل</label>
                  <Input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="اختياري"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">رقم الهاتف</label>
                  <Input
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="اختياري"
                  />
                </div>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="text-sm font-medium text-foreground">الخصم ({discountType === "percent" ? "%" : "د.ع"})</label>
                    <Input
                      type="number"
                      value={discount}
                      onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                      min="0"
                    />
                  </div>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="icon" 
                    onClick={() => setDiscountType(discountType === "percent" ? "amount" : "percent")}
                    title="تبديل نوع الخصم"
                  >
                    {discountType === "percent" ? "%" : "د.ع"}
                  </Button>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">طريقة الدفع</label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">نقد</SelectItem>
                      <SelectItem value="card">بطاقة</SelectItem>
                      <SelectItem value="transfer">تحويل بنكي</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="bg-muted p-4 rounded-lg">
                  <div className="flex justify-between mb-2">
                    <span>الإجمالي</span>
                    <span className="font-bold text-accent">{formatCurrency(total)}</span>
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={handleCheckout}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      جاري المعالجة...
                    </>
                  ) : (
                    "تأكيد البيع"
                  )}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Barcode Scanner */}
      <BarcodeScanner
        isOpen={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onBarcodeDetected={handleBarcodeDetected}
      />
    </div>
  );
}
