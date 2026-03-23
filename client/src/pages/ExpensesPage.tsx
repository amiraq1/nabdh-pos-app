import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Plus, Trash2, Receipt, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";

export default function ExpensesPage() {
  const [, navigate] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    category: "other",
    description: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
  });

  const { data: expenses, isLoading, refetch } = trpc.expenses.list.useQuery();
  const createMutation = trpc.expenses.create.useMutation();
  const deleteMutation = trpc.expenses.delete.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createMutation.mutateAsync({
        ...formData,
        date: new Date(formData.date),
      });
      toast.success("تم تسجيل المصروف بنجاح");
      setIsOpen(false);
      setFormData({ category: "other", description: "", amount: "", date: new Date().toISOString().split("T")[0] });
      refetch();
    } catch (error) {
      toast.error("حدث خطأ أثناء الحفظ");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذا المصروف؟")) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("تم الحذف بنجاح");
      refetch();
    } catch (error) {
      toast.error("حدث خطأ أثناء الحذف");
    }
  };

  const totalExpenses = expenses?.reduce((sum: number, exp: any) => sum + parseFloat(exp.amount), 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="icon" 
            className="rounded-full flex-shrink-0"
            onClick={() => navigate("/")}
          >
            <ArrowRight className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">مصاريف التشغيل</h1>
            <p className="text-foreground/60 mt-1">إدارة المصاريف اليومية والشهرية</p>
          </div>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-lg shadow-accent/20">
              <Plus className="w-4 h-4" /> تسجيل مصروف
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>إضافة مصروف جديد</DialogTitle>
              <DialogDescription>أدخل تفاصيل المصروف بدقة</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium">الفئة</label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rent">إيجار</SelectItem>
                    <SelectItem value="salary">رواتب</SelectItem>
                    <SelectItem value="utilities">كهرباء وماء</SelectItem>
                    <SelectItem value="inventory">مشتريات مخزون</SelectItem>
                    <SelectItem value="other">أخرى</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">الوصف</label>
                <Input
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="مثال: فاتورة كهرباء شهر آذار"
                />
              </div>
              <div>
                <label className="text-sm font-medium">المبلغ</label>
                <Input
                  required
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="مثال: 50000"
                />
              </div>
              <div>
                <label className="text-sm font-medium">التاريخ</label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "حفظ المصروف"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="bg-accent/5 border-accent/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground/60">إجمالي المصاريف</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-accent">{formatCurrency(totalExpenses)}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>قائمة المصاريف</CardTitle>
          <CardDescription>عرض وتدقيق كافة المصاريف المسجلة</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-accent" />
            </div>
          ) : expenses && expenses.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50 text-right">
                    <th className="py-3 px-4 font-semibold">التاريخ</th>
                    <th className="py-3 px-4 font-semibold">الفئة</th>
                    <th className="py-3 px-4 font-semibold">الوصف</th>
                    <th className="py-3 px-4 font-semibold">المبلغ</th>
                    <th className="py-3 px-4 font-semibold">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((exp: any) => (
                    <tr key={exp.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-4">{new Date(exp.date).toLocaleDateString("ar-SA")}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 rounded-full bg-muted text-xs">
                          {exp.category === "rent" ? "إيجار" : exp.category === "salary" ? "رواتب" : exp.category === "utilities" ? "كهرباء" : "أخرى"}
                        </span>
                      </td>
                      <td className="py-3 px-4">{exp.description}</td>
                      <td className="py-3 px-4 font-bold text-destructive">-{formatCurrency(exp.amount)}</td>
                      <td className="py-3 px-4">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(exp.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Receipt className="w-12 h-12 text-foreground/20 mx-auto mb-4" />
              <p className="text-foreground/60">لا توجد مصاريف مسجلة حتى الآن.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
