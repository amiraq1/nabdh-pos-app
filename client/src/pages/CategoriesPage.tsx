import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, Loader2, Tag, ArrowRight, Layers, LayoutGrid, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";

export default function CategoriesPage() {
  const [, navigate] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "", imageUrl: "" });

  const { data: categories, isLoading, refetch } = trpc.categories.list.useQuery();
  const createMutation = trpc.categories.create.useMutation();
  const updateMutation = trpc.categories.update.useMutation();
  const deleteMutation = trpc.categories.delete.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, ...formData });
        toast.success("تم تحديث بيانات الفئة");
      } else {
        await createMutation.mutateAsync(formData);
        toast.success("تم إضافة الفئة الجديدة بنجاح");
      }
      
      resetForm();
      setIsOpen(false);
      refetch();
    } catch (error) {
      toast.error("حدث خطأ أثناء حفظ البيانات");
    }
  };

  const resetForm = () => {
    setFormData({ name: "", description: "", imageUrl: "" });
    setEditingId(null);
  };

  const handleEdit = (category: any) => {
    setFormData({ name: category.name, description: category.description || "", imageUrl: category.imageUrl || "" });
    setEditingId(category.id);
    setIsOpen(true);
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden pb-12">
      {/* Background Ambience */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/2"></div>

      <div className="container py-6 space-y-8 relative z-10">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 glass-panel p-6 rounded-[32px] border-white/5 shadow-2xl shadow-primary/5">
          <div className="flex items-center gap-5">
            <Button 
                variant="outline" 
                size="icon" 
                className="rounded-2xl w-12 h-12 shadow-sm border-border/40 hover:bg-muted"
                onClick={() => navigate("/")}
            >
                <ArrowRight className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-display font-black tracking-tight text-foreground flex items-center gap-3">
                <Layers className="w-8 h-8 text-primary" />
                تصنيفات المتجر
              </h1>
              <p className="text-muted-foreground font-medium mt-1">تنظيم المنتجات في مجموعات منطقية</p>
            </div>
          </div>

          <Dialog open={isOpen} onOpenChange={(v) => { setIsOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="h-14 px-8 rounded-2xl font-display font-bold text-lg shadow-xl shadow-primary/20 gap-3">
                <Plus className="w-5 h-5" />
                إضافة فئة
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl p-0 border-0 glass-panel overflow-hidden rounded-[32px] shadow-2xl">
              <div className="p-8 space-y-6">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-display font-bold">{editingId ? "تعديل التصنيف" : "تصنيف جديد"}</DialogTitle>
                  <DialogDescription className="font-medium">سيتم ربط المنتجات بهذا التصنيف لتسهيل الوصول إليها في نقطة البيع.</DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-display font-bold text-muted-foreground flex items-center gap-2">
                      <Tag className="w-3 h-3" /> اسم الفئة
                    </label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="مثال: المشروبات الباردة"
                      className="h-12 bg-background/50 border-border/40 rounded-xl focus:border-primary"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-display font-bold text-muted-foreground">شرح تفصيلي (اختياري)</label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="..."
                      className="bg-background/50 border-border/40 rounded-xl min-h-[100px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-display font-bold text-muted-foreground flex items-center gap-2">
                      <ImageIcon className="w-3 h-3" /> رابط صورة الغلاف
                    </label>
                    <Input
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                      placeholder="https://..."
                      className="h-12 bg-background/50 border-border/40 rounded-xl"
                    />
                  </div>

                  <Button type="submit" className="w-full h-14 rounded-2xl text-lg font-display font-bold shadow-xl shadow-primary/20" disabled={createMutation.isPending || updateMutation.isPending}>
                    {createMutation.isPending || updateMutation.isPending ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      editingId ? "تحديث البيانات" : "إنشاء الفئة الآن"
                    )}
                  </Button>
                </form>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Categories Grid */}
        {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-4">
              <Loader2 className="w-12 h-12 animate-spin text-primary opacity-20" />
            </div>
        ) : categories && categories.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
                {categories.map((category: any) => (
                <motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={category.id}
                >
                    <Card className="group relative overflow-hidden h-full rounded-[32px] border-border/20 bg-background/40 glass-panel hover:border-primary/40 transition-all duration-300 shadow-sm hover:shadow-2xl hover:shadow-primary/5">
                        {category.imageUrl && (
                          <div className="h-40 overflow-hidden relative">
                             <img src={category.imageUrl} alt={category.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                             <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent"></div>
                          </div>
                        )}
                        <div className="p-6 space-y-4">
                            <div className="flex justify-between items-start">
                                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                                    <Tag className="w-6 h-6 text-primary" />
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleEdit(category)}>
                                        <Edit2 className="w-4 h-4 text-primary" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={async () => {
                                        if (confirm("هل أنت متأكد من حذف هذه الفئة؟")) {
                                            await deleteMutation.mutateAsync(category.id);
                                            toast.success("تم الحذف");
                                            refetch();
                                        }
                                    }}>
                                        <Trash2 className="w-4 h-4 text-destructive" />
                                    </Button>
                                </div>
                            </div>

                            <div>
                                <h3 className="font-display font-bold text-xl text-foreground">{category.name}</h3>
                                {category.description && (
                                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{category.description}</p>
                                )}
                            </div>
                        </div>
                    </Card>
                </motion.div>
                ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="h-96 flex flex-col items-center justify-center glass-panel rounded-[40px] border-dashed text-muted-foreground opacity-50 space-y-6">
            <LayoutGrid className="w-20 h-20 stroke-[1]" />
            <p className="font-display text-xl">لم يتم تحديد أي فئات بعد</p>
          </div>
        )}
      </div>
    </div>
  );
}
