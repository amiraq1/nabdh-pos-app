import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Search, Box, History, TrendingUp, TrendingDown, RefreshCcw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import PageShell from "@/components/PageShell";
import PageHeader from "@/components/PageHeader";

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

  const filteredProducts = useMemo(() => {
    return products?.filter((p: any) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.sku.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];
  }, [products, searchTerm]);

  const lowStockProducts = useMemo(() => {
    return products?.filter((p: any) => p.quantity < p.minStockLevel) || [];
  }, [products]);

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
      toast.error("فشل تحديث المخزون");
    }
  };

  return (
    <PageShell>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <PageHeader
          title="إدارة الجرد والمخزن"
          subtitle="تتبع مستويات المخزون وحركات الإدخال والإخراج"
          icon={Box}
          actions={
            <DialogTrigger asChild>
              <Button className="h-14 px-8 rounded-2xl font-display font-bold text-lg shadow-xl shadow-primary/20 gap-3">
                <RefreshCcw className="w-5 h-5" />
                تعديل الرصيد
              </Button>
            </DialogTrigger>
          }
        />
        <DialogContent className="max-w-xl p-0 border-0 glass-panel overflow-hidden rounded-[32px] shadow-2xl">
          <div className="p-8 space-y-6">
            <DialogHeader>
              <DialogTitle className="text-2xl font-display font-bold">حركة مخزنية</DialogTitle>
              <DialogDescription className="font-medium">أضف أو اخصم من رصيد المنتج الحالي مع ذكر السبب.</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleAdjustment} className="space-y-6 text-right">
              <div className="space-y-2">
                <label className="text-sm font-display font-bold text-muted-foreground">المنتج المراد تعديله</label>
                <Select 
                  value={selectedProduct?.toString() || ""} 
                  onValueChange={(value) => setSelectedProduct(parseInt(value))}
                >
                  <SelectTrigger className="h-12 bg-background/50 border-border/40 rounded-xl">
                    <SelectValue placeholder="اختر المنتج من القائمة..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {products?.map((p: any) => (
                      <SelectItem key={p.id} value={p.id.toString()}>
                        {p.name} (الرصيد: {p.quantity})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                    <label className="text-sm font-display font-bold text-muted-foreground text-right block">نوع التصحيح</label>
                    <Select 
                        value={adjustmentData.reason} 
                        onValueChange={(value) => setAdjustmentData({ ...adjustmentData, reason: value })}
                    >
                        <SelectTrigger className="h-12 bg-background/50 border-border/40 rounded-xl">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="adjustment">تصحيح جرد</SelectItem>
                            <SelectItem value="purchase">شراء معزز</SelectItem>
                            <SelectItem value="return">مرتجع مبيعات</SelectItem>
                            <SelectItem value="loss">تالف / مفقود</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-display font-bold text-muted-foreground text-right block">الكمية (+ أو -)</label>
                    <Input
                        type="number"
                        value={adjustmentData.quantityChange}
                        onChange={(e) => setAdjustmentData({ ...adjustmentData, quantityChange: parseInt(e.target.value) })}
                        placeholder="0"
                        className="h-12 bg-background/50 border-border/40 rounded-xl text-center font-bold text-lg"
                        required
                    />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-display font-bold text-muted-foreground text-right block">ملاحظات الحركة</label>
                <Textarea
                  value={adjustmentData.notes}
                  onChange={(e) => setAdjustmentData({ ...adjustmentData, notes: e.target.value })}
                  placeholder="اذكر سبب التعديل هنا..."
                  className="bg-background/50 border-border/40 rounded-xl min-h-[80px]"
                />
              </div>

              <Button type="submit" className="w-full h-14 rounded-2xl text-lg font-display font-bold shadow-xl shadow-primary/20" disabled={addHistoryMutation.isPending}>
                {addHistoryMutation.isPending ? <Loader2 className="w-6 h-6 animate-spin" /> : "تأكيد العملية"}
              </Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Alerts Section */}
      {lowStockProducts.length > 0 && (
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
           <Card className="glass-panel border-rose-500/20 bg-rose-500/[0.03] rounded-[32px] overflow-hidden">
              <div className="p-6 border-b border-rose-500/10 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-rose-500 font-display font-black">
                      <AlertTriangle className="w-6 h-6 animate-pulse" />
                      تنبيه: مخزون حرج ({lowStockProducts.length})
                  </div>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {lowStockProducts.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between p-4 bg-background/60 rounded-2xl border border-rose-500/10 hover:border-rose-500/30 transition-colors">
                          <div>
                              <h4 className="font-display font-bold text-foreground text-sm">{p.name}</h4>
                              <p className="text-[10px] font-bold opacity-50 uppercase">{p.sku}</p>
                          </div>
                          <div className="text-right">
                              <span className="text-rose-500 font-display font-black text-lg">{p.quantity}</span>
                              <p className="text-[10px] text-muted-foreground">الحد: {p.minStockLevel}</p>
                          </div>
                      </div>
                  ))}
              </div>
           </Card>
        </motion.div>
      )}

      {/* Main List Section */}
      <div className="space-y-6">
          <div className="relative group">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                  placeholder="ابحث عن منتج بالاسم أو SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-14 bg-background/40 glass-panel border-border/30 rounded-[20px] pl-4 pr-12 text-lg focus:border-primary/40"
              />
          </div>

          {productsLoading ? (
              <div className="h-96 flex items-center justify-center">
                  <Loader2 className="w-12 h-12 animate-spin text-primary opacity-20" />
              </div>
          ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <AnimatePresence>
                      {filteredProducts.map((p: any) => (
                          <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} key={p.id}>
                              <Card className="glass-panel p-6 rounded-[32px] border-border/20 relative overflow-hidden group hover:border-primary/30 transition-all">
                                  <div className="flex justify-between items-start mb-6">
                                      <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center">
                                          <Box className="w-7 h-7 text-muted-foreground group-hover:text-primary transition-colors" />
                                      </div>
                                      <Button variant="ghost" className="rounded-xl h-10 px-4 font-display font-bold text-xs" onClick={() => { setSelectedProduct(p.id); setIsOpen(true); }}>
                                          تعديل سريع
                                      </Button>
                                  </div>
                                  <div className="mb-6">
                                      <h3 className="text-xl font-display font-bold text-foreground truncate">{p.name}</h3>
                                      <p className="text-xs font-mono opacity-40 uppercase tracking-tighter">{p.sku}</p>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4 mb-4">
                                      <div className="p-4 rounded-2xl bg-background/40 border border-border/10">
                                          <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">الرصيد</p>
                                          <p className={`text-2xl font-display font-black ${p.quantity < p.minStockLevel ? 'text-rose-500' : 'text-primary'}`}>{p.quantity}</p>
                                      </div>
                                      <div className="p-4 rounded-2xl bg-background/40 border border-border/10">
                                          <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">الحد الأدنى</p>
                                          <p className="text-2xl font-display font-black text-foreground/40">{p.minStockLevel}</p>
                                      </div>
                                  </div>
                                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                      <div 
                                          className={`h-full transition-all duration-1000 ${p.quantity < p.minStockLevel ? 'bg-rose-500' : 'bg-primary'}`} 
                                          style={{ width: `${Math.min(100, (p.quantity / (p.minStockLevel || 1)) * 50)}%` }}
                                      />
                                  </div>
                              </Card>
                          </motion.div>
                      ))}
                  </AnimatePresence>
              </div>
          )}
      </div>

      {/* History Section */}
      <AnimatePresence>
          {selectedProduct && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="glass-panel rounded-[40px] border-border/20 overflow-hidden">
                      <div className="p-8 border-b border-border/10 flex items-center justify-between">
                          <h3 className="text-xl font-display font-bold text-foreground flex items-center gap-3">
                              <History className="w-6 h-6 text-primary" /> سجل الحركة التاريخية للمنتج
                          </h3>
                          <Button variant="ghost" onClick={() => setSelectedProduct(null)} className="text-xs font-bold opacity-50">إغلاق السجل</Button>
                      </div>
                      <div className="p-8">
                          {historyLoading ? (
                              <Loader2 className="w-8 h-8 animate-spin mx-auto opacity-10" />
                          ) : stockHistory && stockHistory.length > 0 ? (
                              <div className="space-y-4">
                                  {stockHistory.map((h: any) => (
                                      <div key={h.id} className="flex items-center justify-between p-5 bg-background/40 rounded-[24px] border border-border/5 shadow-sm">
                                          <div className="flex items-center gap-4">
                                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${h.quantityChange > 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
                                                  {h.quantityChange > 0 ? <TrendingUp className="w-5 h-5 text-emerald-500" /> : <TrendingDown className="w-5 h-5 text-rose-500" />}
                                              </div>
                                              <div>
                                                  <p className="font-display font-bold text-foreground text-sm">
                                                      {h.reason === "sale" ? "عملية بيع" : h.reason === "purchase" ? "تغذية مخزنية" : h.reason === "return" ? "مرتجع" : "تعديل يدوي"}
                                                  </p>
                                                  {h.notes && <p className="text-xs text-muted-foreground mt-0.5">{h.notes}</p>}
                                              </div>
                                          </div>
                                          <div className="text-right">
                                              <p className={`text-xl font-display font-black ${h.quantityChange > 0 ? "text-emerald-500" : "text-rose-500"}`}>
                                                  {h.quantityChange > 0 ? "+" : ""}{h.quantityChange}
                                              </p>
                                              <p className="text-[10px] font-bold opacity-30 mt-1">{new Date(h.createdAt).toLocaleString("ar-SA")}</p>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          ) : (
                              <div className="py-12 text-center opacity-30 italic">لا توجد حركات مسجلة لهذا المنتج</div>
                          )}
                      </div>
                  </Card>
              </motion.div>
          )}
      </AnimatePresence>
    </PageShell>
  );
}
