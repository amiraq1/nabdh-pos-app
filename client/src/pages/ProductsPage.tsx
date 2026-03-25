import { useState, useMemo, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, Loader2, Search, Camera, Package, Barcode, AlertCircle, Zap } from "lucide-react";
import { toast } from "sonner";
import BarcodeScanner from "@/components/BarcodeScanner";
import { formatCurrency } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import PageShell from "@/components/PageShell";
import PageHeader from "@/components/PageHeader";

export default function ProductsPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  
  const [formData, setFormData] = useState({
    categoryId: 0,
    name: "",
    description: "",
    sku: "",
    barcode: "",
    price: "",
    costPrice: "",
    imageUrl: "",
    quantity: 0,
    minStockLevel: 10,
  });

  const { data: products, isLoading: productsLoading, refetch: refetchProducts } = trpc.products.list.useQuery(
    selectedCategory && selectedCategory !== "all" ? parseInt(selectedCategory) : undefined
  );
  const { data: categories } = trpc.categories.list.useQuery();
  const createMutation = trpc.products.create.useMutation();
  const updateMutation = trpc.products.update.useMutation();
  const deleteMutation = trpc.products.delete.useMutation();

  const filteredProducts = useMemo(() => {
    return products?.filter((p: any) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.barcode?.includes(searchTerm)
    ) || [];
  }, [products, searchTerm]);

  // Hardware Scanner Support within dialog
  const barcodeBuffer = useRef("");
  const barcodeTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['TEXTAREA', 'INPUT'].includes((e.target as HTMLElement).tagName)) return;
      
      if (e.key === 'Enter') {
        if (barcodeBuffer.current.length > 3) {
          setFormData(prev => ({ ...prev, barcode: barcodeBuffer.current }));
          toast.success(`تم التقاط الباركود: ${barcodeBuffer.current}`);
          barcodeBuffer.current = "";
        }
        return;
      }

      if (e.key.length === 1) {
        barcodeBuffer.current += e.key;
        if (barcodeTimeout.current) clearTimeout(barcodeTimeout.current);
        barcodeTimeout.current = setTimeout(() => { barcodeBuffer.current = ""; }, 100);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.categoryId === 0) {
      toast.error("يرجى اختيار فئة للمنتج");
      return;
    }
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, ...formData });
        toast.success("تم تحديث بيانات المنتج");
      } else {
        await createMutation.mutateAsync(formData);
        toast.success("تم إضافة المنتج للمخزون");
      }
      resetForm();
      setIsOpen(false);
      refetchProducts();
    } catch (error: any) {
      toast.error(error.message || "فشلت العملية، تأكد من البيانات");
    }
  };

  const resetForm = () => {
    setFormData({
      categoryId: 0,
      name: "",
      description: "",
      sku: "",
      barcode: "",
      price: "",
      costPrice: "",
      imageUrl: "",
      quantity: 0,
      minStockLevel: 10,
    });
    setEditingId(null);
  };

  const handleEdit = (product: any) => {
    setFormData({
      categoryId: product.categoryId,
      name: product.name,
      description: product.description || "",
      sku: product.sku,
      barcode: product.barcode || "",
      price: product.price.toString(),
      costPrice: product.costPrice?.toString() || "",
      imageUrl: product.imageUrl || "",
      quantity: product.quantity,
      minStockLevel: product.minStockLevel,
    });
    setEditingId(product.id);
    setIsOpen(true);
  };

  return (
    <PageShell>
      <Dialog open={isOpen} onOpenChange={(v) => { setIsOpen(v); if (!v) resetForm(); }}>
        <PageHeader
          title="كتالوج المنتجات"
          subtitle="إدارة المخزون، الأسعار، وبيانات التتبع"
          icon={Package}
          actions={
            <DialogTrigger asChild>
              <Button className="h-14 px-8 rounded-2xl font-display font-bold text-lg shadow-xl shadow-primary/20 gap-3">
                <Plus className="w-5 h-5" />
                إضافة منتج 
              </Button>
            </DialogTrigger>
          }
        />
        <DialogContent className="max-w-2xl p-0 border-0 glass-panel overflow-hidden rounded-[32px] shadow-2xl">
          <div className="p-8 space-y-6">
            <DialogHeader>
              <DialogTitle className="text-2xl font-display font-bold">{editingId ? "تحديث المنتج" : "منتج جديد"}</DialogTitle>
              <DialogDescription className="font-medium">أدخل تفاصيل المنتج بدقة لضمان دقة التقارير المالية والباركود.</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-6 text-right">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-xs font-display font-medium text-muted-foreground mr-1">اختر التصنيف</label>
                  <Select
                    value={formData.categoryId.toString()}
                    onValueChange={(v) => setFormData({ ...formData, categoryId: parseInt(v) })}
                  >
                    <SelectTrigger className="h-12 bg-background/50 border border-border/40 rounded-xl">
                      <SelectValue placeholder="-- اختر الفئة --" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {categories?.map((cat: any) => (
                        <SelectItem key={cat.id} value={cat.id.toString()}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formData.categoryId === 0 && <p className="text-[10px] text-destructive font-bold flex items-center gap-1"><AlertCircle className="w-3 h-3" /> الفئة مطلوبة</p>}
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-display font-bold text-muted-foreground">اسم المنتج</label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="مثال: آيفون 15 برو"
                      className="h-12 bg-background/50 border-border/40 rounded-xl focus:border-primary"
                      required
                    />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-display font-bold text-muted-foreground">الوصف المختصر</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="اكتب تفاصيل إضافية للمنتج..."
                  className="bg-background/50 border-border/40 rounded-xl min-h-[80px]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-sm font-display font-bold text-muted-foreground flex items-center gap-2">
                    <Zap className="w-3 h-3" /> SKU / رمز التتبع
                  </label>
                  <Input
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    placeholder="IPH-15-PR"
                    className="h-12 bg-background/50 border-border/40 rounded-xl"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-display font-bold text-muted-foreground flex items-center gap-2">
                    <Barcode className="w-3 h-3" /> الباركود الدولي
                  </label>
                  <div className="flex gap-2">
                    <Input
                      value={formData.barcode}
                      onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                      placeholder="648293..."
                      className="h-12 bg-background/50 border-border/40 rounded-xl"
                    />
                    <Button 
                      type="button" 
                      variant="secondary" 
                      className="h-12 w-12 rounded-xl p-0"
                      onClick={() => setIsScannerOpen(true)}
                    >
                      <Camera className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-sm font-display font-bold text-muted-foreground">سعر البيع الافتراضي</label>
                  <div className="relative">
                    <Input
                        type="number"
                        step="0.01"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        placeholder="0.00"
                        className="h-12 bg-background/50 border-border/40 rounded-xl pl-12"
                        required
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold opacity-30">د.ع</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-display font-bold text-muted-foreground">سعر التكلفة (تحليلي)</label>
                  <div className="relative">
                    <Input
                        type="number"
                        step="0.01"
                        value={formData.costPrice}
                        onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                        placeholder="0.00"
                        className="h-12 bg-background/50 border-border/40 rounded-xl pl-12"
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold opacity-30">د.ع</span>
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full h-14 rounded-2xl text-lg font-display font-bold shadow-xl shadow-primary/20" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  editingId ? "تحديث المنتج" : "تأكيد إضافة المنتج"
                )}
              </Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Filters Section */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative group">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="ابحث بالاسم، SKU، أو امسح باركود المنتج مباشرة..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-4 pr-12 h-14 bg-background/40 glass-panel border-border/30 rounded-[20px] focus:border-primary/50"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full md:w-64 h-14 bg-background/40 glass-panel border-border/30 rounded-[20px]">
            <SelectValue placeholder="فلترة حسب الفئة" />
          </SelectTrigger>
          <SelectContent className="rounded-2xl">
            <SelectItem value="all">جميع الفئات</SelectItem>
            {categories?.map((cat: any) => (
              <SelectItem key={cat.id} value={cat.id.toString()}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Products Display */}
      {productsLoading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary opacity-20" />
            <p className="font-display font-bold text-muted-foreground tracking-widest text-xs uppercase">جاري التحميل...</p>
          </div>
      ) : filteredProducts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <AnimatePresence mode="popLayout">
              {filteredProducts.map((product: any) => (
              <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  key={product.id}
              >
                  <Card className="group relative overflow-hidden h-full rounded-[32px] border-border/20 bg-background/40 glass-panel hover:border-primary/40 transition-all duration-300 shadow-sm hover:shadow-2xl hover:shadow-primary/5">
                      <div className="p-6 space-y-4">
                          <div className="flex justify-between items-start">
                              <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                                  <Package className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                              </div>
                              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleEdit(product)}>
                                      <Edit2 className="w-4 h-4 text-primary" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={async () => {
                                      if (confirm("هل أنت متأكد من حذف هذا المنتج؟")) {
                                          await deleteMutation.mutateAsync(product.id);
                                          toast.success("تم الحذف");
                                          refetchProducts();
                                      }
                                  }}>
                                      <Trash2 className="w-4 h-4 text-destructive" />
                                  </Button>
                              </div>
                          </div>

                          <div>
                              <h3 className="font-display font-bold text-lg text-foreground truncate">{product.name}</h3>
                                  <p className="text-xs font-mono text-muted-foreground truncate tracking-tighter uppercase">{product.sku}</p>
                          </div>

                          <div className="flex items-end justify-between pt-2">
                              <div>
                                  <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-50 mb-0.5">سعر الوحدة</p>
                                  <p className="text-xl font-display font-black text-primary">{formatCurrency(product.price)}</p>
                              </div>
                              <div className={`px-4 py-1.5 rounded-full text-xs font-bold border ${
                                  product.quantity <= product.minStockLevel 
                                  ? "bg-destructive/10 text-destructive border-destructive/20" 
                                  : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                              }`}>
                                  {product.quantity} رصيد
                              </div>
                          </div>
                      </div>
                      
                      {/* Status Bar */}
                      <div className={`h-1.5 w-full bg-muted overflow-hidden`}>
                          <div 
                              className={`h-full transition-all duration-1000 ${product.quantity <= product.minStockLevel ? 'bg-destructive' : 'bg-primary'}`} 
                              style={{ width: `${Math.min(100, (product.quantity / (product.minStockLevel * 2)) * 100)}%` }}
                          />
                      </div>
                  </Card>
              </motion.div>
              ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="h-96 flex flex-col items-center justify-center glass-panel rounded-[40px] border-dashed text-muted-foreground opacity-50 space-y-6">
          <Package className="w-20 h-20 stroke-[1]" />
          <p className="font-display text-xl">لا توجد منتجات تطابق معايير البحث</p>
        </div>
      )}
    </PageShell>
  );
}
