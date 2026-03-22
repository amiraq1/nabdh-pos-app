import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertCircle, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

export default function InventoryPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [adjustmentData, setAdjustmentData] = useState({
    quantityChange: 0,
    reason: "adjustment",
    notes: "",
  });

  const { data: products, isLoading: productsLoading, refetch: refetchProducts } = trpc.products.list.useQuery();
  const { data: stockHistory, isLoading: historyLoading, refetch: refetchHistory } = trpc.stock.history.useQuery(selectedProduct || 0);
  const addHistoryMutation = trpc.stock.addHistory.useMutation();

  const filteredProducts = products?.filter((p: any) =>
    p.name.includes(searchTerm) || p.sku.includes(searchTerm)
  ) || [];

  const lowStockProducts = products?.filter((p: any) => p.quantity < p.minStockLevel) || [];

  const handleAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedProduct) {
      toast.error("يرجى اختيار منتج");
      return;
    }

    try {
      await addHistoryMutation.mutateAsync({
        productId: selectedProduct,
        quantityChange: adjustmentData.quantityChange,
        reason: adjustmentData.reason,
        notes: adjustmentData.notes,
      });
      
      toast.success("تم تحديث المخزون بنجاح");
      setAdjustmentData({ quantityChange: 0, reason: "adjustment", notes: "" });
      setIsOpen(false);
      refetchProducts();
      refetchHistory();
    } catch (error) {
      toast.error("حدث خطأ ما");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">إدارة المخزون</h1>
          <p className="text-foreground/60 mt-1">تتبع المخزون والتنبيهات</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              تعديل المخزون
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>تعديل المخزون</DialogTitle>
              <DialogDescription>
                قم بتعديل كمية المنتج في المخزون
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAdjustment} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">المنتج</label>
                <Select value={selectedProduct?.toString() || ""} onValueChange={(value) => setSelectedProduct(parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر المنتج" />
                  </SelectTrigger>
                  <SelectContent>
                    {products?.map((p: any) => (
                      <SelectItem key={p.id} value={p.id.toString()}>
                        {p.name} (الكمية الحالية: {p.quantity})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">السبب</label>
                <Select value={adjustmentData.reason} onValueChange={(value) => setAdjustmentData({ ...adjustmentData, reason: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="adjustment">تعديل</SelectItem>
                    <SelectItem value="purchase">شراء</SelectItem>
                    <SelectItem value="return">إرجاع</SelectItem>
                    <SelectItem value="loss">فقدان</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">التغيير في الكمية</label>
                <Input
                  type="number"
                  value={adjustmentData.quantityChange}
                  onChange={(e) => setAdjustmentData({ ...adjustmentData, quantityChange: parseInt(e.target.value) })}
                  placeholder="مثال: 10 أو -5"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">ملاحظات</label>
                <Textarea
                  value={adjustmentData.notes}
                  onChange={(e) => setAdjustmentData({ ...adjustmentData, notes: e.target.value })}
                  placeholder="ملاحظات إضافية"
                />
              </div>
              <Button type="submit" className="w-full" disabled={addHistoryMutation.isPending}>
                {addHistoryMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    جاري التحديث...
                  </>
                ) : (
                  "تحديث"
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              تنبيهات المخزون
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {lowStockProducts.map((product: any) => (
                <div key={product.id} className="flex items-center justify-between p-3 bg-background rounded-lg border border-destructive/20">
                  <div>
                    <p className="font-medium text-foreground">{product.name}</p>
                    <p className="text-sm text-foreground/60">الكمية الحالية: {product.quantity} (الحد الأدنى: {product.minStockLevel})</p>
                  </div>
                  <span className="px-3 py-1 bg-destructive/20 text-destructive rounded text-sm font-medium">
                    منخفض
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search Products */}
      <div className="relative">
        <Search className="absolute right-3 top-3 w-4 h-4 text-foreground/40" />
        <Input
          placeholder="ابحث عن منتج..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-4 pr-10"
        />
      </div>

      {/* Products List */}
      {productsLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      ) : filteredProducts.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((product: any) => (
            <Card key={product.id} className="border-border/50 hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg">{product.name}</CardTitle>
                <CardDescription>{product.sku}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-foreground/60">الكمية الحالية</p>
                    <p className="text-2xl font-bold text-foreground">{product.quantity}</p>
                  </div>
                  <div>
                    <p className="text-sm text-foreground/60">الحد الأدنى</p>
                    <p className="text-2xl font-bold text-foreground">{product.minStockLevel}</p>
                  </div>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${product.quantity < product.minStockLevel ? "bg-destructive" : "bg-accent"}`}
                    style={{ width: `${Math.min((product.quantity / product.minStockLevel) * 100, 100)}%` }}
                  />
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setSelectedProduct(product.id);
                    setIsOpen(true);
                  }}
                >
                  تعديل الكمية
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center">
            <p className="text-foreground/60">لا توجد منتجات حالياً.</p>
          </CardContent>
        </Card>
      )}

      {/* Stock History */}
      {selectedProduct && (
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>سجل حركة المخزون</CardTitle>
            <CardDescription>آخر التعديلات على المخزون</CardDescription>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-accent" />
              </div>
            ) : stockHistory && stockHistory.length > 0 ? (
              <div className="space-y-3">
                {stockHistory.map((history: any) => (
                  <div key={history.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium text-foreground">
                        {history.reason === "sale" ? "بيع" : history.reason === "purchase" ? "شراء" : history.reason === "return" ? "إرجاع" : "تعديل"}
                      </p>
                      {history.notes && <p className="text-sm text-foreground/60">{history.notes}</p>}
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${history.quantityChange > 0 ? "text-accent" : "text-destructive"}`}>
                        {history.quantityChange > 0 ? "+" : ""}{history.quantityChange}
                      </p>
                      <p className="text-xs text-foreground/60">{new Date(history.createdAt).toLocaleDateString("ar-SA")}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-foreground/60 text-center py-8">لا يوجد سجل حركة</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
