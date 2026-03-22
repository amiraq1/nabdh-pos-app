import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash2, Loader2, Search, Plus, Minus } from "lucide-react";
import { toast } from "sonner";

interface CartItem {
  productId: number;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
}

export default function POSPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [discount, setDiscount] = useState(0);
  const [taxRate, setTaxRate] = useState(15);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);

  const { data: products, isLoading: productsLoading } = trpc.products.list.useQuery(selectedCategory ? parseInt(selectedCategory) : undefined);
  const { data: categories } = trpc.categories.list.useQuery();
  const createSaleMutation = trpc.sales.create.useMutation();
  const addItemMutation = trpc.sales.addItem.useMutation();

  const filteredProducts = products?.filter((p: any) =>
    p.name.includes(searchTerm) || p.sku.includes(searchTerm) || p.barcode?.includes(searchTerm)
  ) || [];

  const addToCart = (product: any) => {
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
    toast.success("تم إضافة المنتج إلى السلة");
  };

  const removeFromCart = (productId: number) => {
    setCart(cart.filter(item => item.productId !== productId));
  };

  const updateQuantity = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(cart.map(item =>
      item.productId === productId
        ? { ...item, quantity, subtotal: quantity * item.price }
        : item
    ));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const discountAmount = subtotal * (discount / 100);
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = taxableAmount * (taxRate / 100);
  const total = taxableAmount + taxAmount;

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

      // Add items to sale
      for (const item of cart) {
        await addItemMutation.mutateAsync({
          saleId: (sale as any).insertId || 0,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.price.toString(),
          subtotal: item.subtotal.toString(),
        });
      }

      toast.success("تم إتمام البيع بنجاح!");
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setDiscount(0);
      setShowCheckout(false);
    } catch (error) {
      toast.error("حدث خطأ أثناء إتمام البيع");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Products Section */}
      <div className="lg:col-span-2 space-y-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">نقطة البيع</h1>
          <p className="text-foreground/60 mt-1">اختر المنتجات وأكمل البيع</p>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute right-3 top-3 w-4 h-4 text-foreground/40" />
            <Input
              placeholder="ابحث بالاسم أو SKU أو الباركود..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-4 pr-10"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="جميع الفئات" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">جميع الفئات</SelectItem>
              {categories?.map((cat: any) => (
                <SelectItem key={cat.id} value={cat.id.toString()}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Products Grid */}
        {productsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {filteredProducts.map((product: any) => (
              <Card
                key={product.id}
                className="border-border/50 hover:shadow-lg transition-all cursor-pointer"
                onClick={() => addToCart(product)}
              >
                {product.imageUrl && (
                  <img src={product.imageUrl} alt={product.name} className="w-full h-32 object-cover rounded-t-lg" />
                )}
                <CardContent className="p-3">
                  <p className="font-semibold text-foreground text-sm truncate">{product.name}</p>
                  <p className="text-xs text-foreground/60 mb-2">{product.sku}</p>
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-accent">{parseFloat(product.price).toFixed(2)} ر.س</p>
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

      {/* Cart Section */}
      <div className="space-y-4">
        <Card className="border-border/50 sticky top-4">
          <CardHeader>
            <CardTitle>السلة</CardTitle>
            <CardDescription>{cart.length} منتج</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Cart Items */}
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {cart.length > 0 ? (
                cart.map((item) => (
                  <div key={item.productId} className="p-3 bg-muted rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-foreground text-sm">{item.name}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFromCart(item.productId)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-foreground/60">{item.price.toFixed(2)} ر.س</p>
                      <p className="font-bold text-accent">{item.subtotal.toFixed(2)} ر.س</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateQuantity(item.productId, parseInt(e.target.value))}
                        className="text-center h-8 w-12"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-foreground/60 text-center py-8">السلة فارغة</p>
              )}
            </div>

            {/* Summary */}
            {cart.length > 0 && (
              <div className="space-y-2 pt-4 border-t border-border">
                <div className="flex justify-between text-sm">
                  <span className="text-foreground/60">الإجمالي الفرعي</span>
                  <span className="font-medium">{subtotal.toFixed(2)} ر.س</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-foreground/60">الخصم ({discount}%)</span>
                  <span className="font-medium text-destructive">-{discountAmount.toFixed(2)} ر.س</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-foreground/60">الضريبة ({taxRate}%)</span>
                  <span className="font-medium">{taxAmount.toFixed(2)} ر.س</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
                  <span>الإجمالي</span>
                  <span className="text-accent">{total.toFixed(2)} ر.س</span>
                </div>
              </div>
            )}

            <Button
              className="w-full"
              onClick={() => setShowCheckout(true)}
              disabled={cart.length === 0}
            >
              إتمام البيع
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Checkout Dialog */}
      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent>
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
            <div>
              <label className="text-sm font-medium text-foreground">الخصم (%)</label>
              <Input
                type="number"
                value={discount}
                onChange={(e) => setDiscount(parseFloat(e.target.value))}
                min="0"
                max="100"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">الضريبة (%)</label>
              <Input
                type="number"
                value={taxRate}
                onChange={(e) => setTaxRate(parseFloat(e.target.value))}
                min="0"
              />
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
                <span className="font-bold text-accent">{total.toFixed(2)} ر.س</span>
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
