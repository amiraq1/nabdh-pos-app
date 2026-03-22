import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

export default function ProductsPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
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

  const { data: products, isLoading: productsLoading, refetch: refetchProducts } = trpc.products.list.useQuery(selectedCategory ? parseInt(selectedCategory) : undefined);
  const { data: categories, isLoading: categoriesLoading } = trpc.categories.list.useQuery();
  const createMutation = trpc.products.create.useMutation();
  const updateMutation = trpc.products.update.useMutation();
  const deleteMutation = trpc.products.delete.useMutation();

  const filteredProducts = products?.filter((p: any) =>
    p.name.includes(searchTerm) || p.sku.includes(searchTerm) || p.barcode?.includes(searchTerm)
  ) || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, ...formData });
        toast.success("تم تحديث المنتج بنجاح");
      } else {
        await createMutation.mutateAsync(formData);
        toast.success("تم إضافة المنتج بنجاح");
      }
      
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
      setIsOpen(false);
      refetchProducts();
    } catch (error) {
      toast.error("حدث خطأ ما");
    }
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

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("تم حذف المنتج بنجاح");
      refetchProducts();
    } catch (error) {
      toast.error("حدث خطأ ما");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">إدارة المنتجات</h1>
          <p className="text-foreground/60 mt-1">إضافة وتعديل وحذف المنتجات</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setFormData({ categoryId: 0, name: "", description: "", sku: "", barcode: "", price: "", costPrice: "", imageUrl: "", quantity: 0, minStockLevel: 10 }); setEditingId(null); }} className="gap-2">
              <Plus className="w-4 h-4" />
              منتج جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "تعديل المنتج" : "إضافة منتج جديد"}</DialogTitle>
              <DialogDescription>
                {editingId ? "قم بتعديل تفاصيل المنتج" : "أضف منتج جديد إلى المتجر"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">الفئة</label>
                <Select value={formData.categoryId.toString()} onValueChange={(value) => setFormData({ ...formData, categoryId: parseInt(value) })}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الفئة" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((cat: any) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">اسم المنتج</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="مثال: جهاز كمبيوتر"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">الوصف</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="وصف المنتج"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground">SKU</label>
                  <Input
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    placeholder="مثال: SKU001"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">الباركود</label>
                  <Input
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    placeholder="مثال: 123456789"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground">السعر (ر.س)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">سعر التكلفة (ر.س)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.costPrice}
                    onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground">الكمية</label>
                  <Input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">الحد الأدنى للمخزون</label>
                  <Input
                    type="number"
                    value={formData.minStockLevel}
                    onChange={(e) => setFormData({ ...formData, minStockLevel: parseInt(e.target.value) })}
                    placeholder="10"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">رابط الصورة</label>
                <Input
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  placeholder="https://example.com/image.jpg"
                />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    جاري الحفظ...
                  </>
                ) : (
                  editingId ? "تحديث" : "إضافة"
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
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

      {productsLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      ) : filteredProducts.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-right py-3 px-4 font-semibold text-foreground">المنتج</th>
                <th className="text-right py-3 px-4 font-semibold text-foreground">SKU</th>
                <th className="text-right py-3 px-4 font-semibold text-foreground">السعر</th>
                <th className="text-right py-3 px-4 font-semibold text-foreground">الكمية</th>
                <th className="text-right py-3 px-4 font-semibold text-foreground">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product: any) => (
                <tr key={product.id} className="border-b border-border/50 hover:bg-muted/50">
                  <td className="py-3 px-4">{product.name}</td>
                  <td className="py-3 px-4 text-foreground/60">{product.sku}</td>
                  <td className="py-3 px-4">{parseFloat(product.price).toFixed(2)} ر.س</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded text-sm ${product.quantity < product.minStockLevel ? "bg-destructive/20 text-destructive" : "bg-accent/20 text-accent"}`}>
                      {product.quantity}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(product)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(product.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center">
            <p className="text-foreground/60">لا توجد منتجات حالياً. قم بإضافة منتج جديد للبدء.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
