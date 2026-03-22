import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function CategoriesPage() {
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
        toast.success("تم تحديث الفئة بنجاح");
      } else {
        await createMutation.mutateAsync(formData);
        toast.success("تم إضافة الفئة بنجاح");
      }
      
      setFormData({ name: "", description: "", imageUrl: "" });
      setEditingId(null);
      setIsOpen(false);
      refetch();
    } catch (error) {
      toast.error("حدث خطأ ما");
    }
  };

  const handleEdit = (category: any) => {
    setFormData({ name: category.name, description: category.description || "", imageUrl: category.imageUrl || "" });
    setEditingId(category.id);
    setIsOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("تم حذف الفئة بنجاح");
      refetch();
    } catch (error) {
      toast.error("حدث خطأ ما");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">إدارة الفئات</h1>
          <p className="text-foreground/60 mt-1">إضافة وتعديل وحذف فئات المنتجات</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setFormData({ name: "", description: "", imageUrl: "" }); setEditingId(null); }} className="gap-2">
              <Plus className="w-4 h-4" />
              فئة جديدة
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "تعديل الفئة" : "إضافة فئة جديدة"}</DialogTitle>
              <DialogDescription>
                {editingId ? "قم بتعديل تفاصيل الفئة" : "أضف فئة جديدة للمنتجات"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">اسم الفئة</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="مثال: إلكترونيات"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">الوصف</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="وصف الفئة"
                />
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

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      ) : categories && categories.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((category: any) => (
            <Card key={category.id} className="border-border/50 hover:shadow-lg transition-shadow">
              {category.imageUrl && (
                <img src={category.imageUrl} alt={category.name} className="w-full h-40 object-cover rounded-t-lg" />
              )}
              <CardHeader>
                <CardTitle className="text-lg">{category.name}</CardTitle>
                {category.description && (
                  <CardDescription>{category.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(category)}
                    className="gap-2 flex-1"
                  >
                    <Edit2 className="w-4 h-4" />
                    تعديل
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(category.id)}
                    className="gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center">
            <p className="text-foreground/60">لا توجد فئات حالياً. قم بإضافة فئة جديدة للبدء.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
