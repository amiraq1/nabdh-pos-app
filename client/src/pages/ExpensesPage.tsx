import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Plus, Trash2, Receipt, ArrowRight, Wallet, Calendar, FileText, Tag, TrendingDown } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

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
      toast.success("تم تسجيل المصروف بنجاح", { className: "font-display" });
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

  const totalExpenses = useMemo(() => expenses?.reduce((sum: number, exp: any) => sum + parseFloat(exp.amount), 0) || 0, [expenses]);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden pb-12">
      {/* Background Ambience */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-rose-500/5 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/2"></div>

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
                <Wallet className="w-8 h-8 text-rose-500" />
                المصاريف التشغيلية
              </h1>
              <p className="text-muted-foreground font-medium mt-1">إدارة وتقييد كافة النفقات اليومية والشهرية</p>
            </div>
          </div>

          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="h-14 px-8 rounded-2xl font-display font-bold text-lg shadow-xl shadow-rose-500/20 gap-3 bg-rose-500 hover:bg-rose-600 text-white border-0">
                <Plus className="w-5 h-5" />
                تسجيل مصروف
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl p-0 border-0 glass-panel overflow-hidden rounded-[32px] shadow-2xl">
              <div className="p-8 space-y-6">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-display font-bold">إضافة مصروف</DialogTitle>
                  <DialogDescription className="font-medium">أدخل تفاصيل النفقة بدقة لضمان توازن التقارير الربحية.</DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6 text-right">
                  <div className="space-y-2">
                    <label className="text-sm font-display font-bold text-muted-foreground block">تصنيف المصروف</label>
                    <Select 
                      value={formData.category} 
                      onValueChange={(v) => setFormData({ ...formData, category: v })}
                    >
                      <SelectTrigger className="h-12 bg-background/50 border-border/40 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="rent">إيجار المحل</SelectItem>
                        <SelectItem value="salary">رواتب الموظفين</SelectItem>
                        <SelectItem value="utilities">كهرباء وماء وإنترنت</SelectItem>
                        <SelectItem value="inventory">مشتريات وبضاعة</SelectItem>
                        <SelectItem value="marketing">تسويق وإعلان</SelectItem>
                        <SelectItem value="other">مصاريف أخرى</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-display font-bold text-muted-foreground block">الوصف / التفاصيل</label>
                    <Input
                      required
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="مثال: فاتورة كهرباء شهر آذار ٢٠٢٤"
                      className="h-12 bg-background/50 border-border/40 rounded-xl focus:border-rose-500/50"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-2">
                        <label className="text-sm font-display font-bold text-muted-foreground block">المبلغ المدفوع</label>
                        <div className="relative">
                            <Input
                                required
                                type="number"
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                placeholder="0.00"
                                className="h-12 bg-background/50 border-border/40 rounded-xl text-center font-bold text-lg"
                            />
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black opacity-30 uppercase">IQD</span>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-display font-bold text-muted-foreground block">تاريخ السداد</label>
                        <Input
                            type="date"
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            className="h-12 bg-background/50 border-border/40 rounded-xl"
                        />
                    </div>
                  </div>

                  <Button type="submit" className="w-full h-14 rounded-2xl text-lg font-display font-bold shadow-xl shadow-rose-500/20 bg-rose-500 hover:bg-rose-600 text-white border-0" disabled={createMutation.isPending}>
                    {createMutation.isPending ? <Loader2 className="w-6 h-6 animate-spin" /> : "تأكيد وتقييد المصروف"}
                  </Button>
                </form>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="glass-panel border-rose-500/20 bg-rose-500/5 rounded-[40px] overflow-hidden p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                    <div className="w-20 h-20 rounded-[30px] bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
                        <TrendingDown className="w-10 h-10 text-rose-500" />
                    </div>
                    <div>
                        <p className="text-sm font-display font-bold text-rose-500/60 uppercase tracking-widest mb-1">إجمالي المصاريف الحالية</p>
                        <h2 className="text-5xl font-display font-black text-rose-500">{formatCurrency(totalExpenses)}</h2>
                    </div>
                </div>
                <div className="h-20 w-px bg-rose-500/10 hidden md:block"></div>
                <div className="text-center md:text-right">
                    <p className="text-xs font-bold text-muted-foreground opacity-50 mb-2 italic">Accounting Oversight</p>
                    <div className="flex items-center gap-2 bg-background/40 px-4 py-2 rounded-2xl border border-border/10">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span className="text-xs font-bold text-foreground/70">النظام المحاسبي متصل</span>
                    </div>
                </div>
            </Card>
        </motion.div>

        {/* Expenses Table/List */}
        <Card className="glass-panel rounded-[40px] border-border/20 overflow-hidden">
           <div className="p-8 border-b border-border/10 flex items-center justify-between">
              <h3 className="text-xl font-display font-bold text-foreground flex items-center gap-3">
                 <Receipt className="w-6 h-6 text-rose-500" /> سجل النفقات المدفوعة
              </h3>
           </div>
           
           {isLoading ? (
                <div className="p-20 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-rose-500 opacity-20" /></div>
           ) : expenses && expenses.length > 0 ? (
                <div className="overflow-x-auto">
                    <table className="w-full text-right">
                        <thead>
                            <tr className="bg-muted/30">
                                <th className="py-5 px-8 text-sm font-bold text-muted-foreground">التاريخ</th>
                                <th className="py-5 px-8 text-sm font-bold text-muted-foreground">التصنيف</th>
                                <th className="py-5 px-8 text-sm font-bold text-muted-foreground">الوصف</th>
                                <th className="py-5 px-8 text-sm font-bold text-muted-foreground">المبلغ</th>
                                <th className="py-5 px-8 text-sm font-bold text-muted-foreground"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/10">
                            <AnimatePresence>
                                {expenses.map((exp: any) => (
                                    <motion.tr 
                                        layout 
                                        initial={{ opacity: 0 }} 
                                        animate={{ opacity: 1 }} 
                                        exit={{ opacity: 0 }} 
                                        key={exp.id} 
                                        className="hover:bg-rose-500/[0.02] transition-colors group"
                                    >
                                        <td className="py-5 px-8 text-sm font-bold text-foreground/60">{new Date(exp.date).toLocaleDateString("ar-SA")}</td>
                                        <td className="py-5 px-8">
                                            <span className="px-3 py-1 rounded-full bg-muted/50 border border-border/10 text-[10px] font-black uppercase text-foreground/70">
                                                {exp.category}
                                            </span>
                                        </td>
                                        <td className="py-5 px-8 text-sm font-medium text-foreground">{exp.description}</td>
                                        <td className="py-5 px-8 font-display font-black text-rose-500">-{formatCurrency(exp.amount)}</td>
                                        <td className="py-5 px-8">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-10 w-10 text-rose-500/20 group-hover:text-rose-500 transition-colors"
                                                onClick={() => handleDelete(exp.id)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </td>
                                    </motion.tr>
                                ))}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="py-24 text-center">
                    <FileText className="w-20 h-20 text-muted-foreground opacity-10 mx-auto mb-4" />
                    <p className="text-muted-foreground font-display font-bold italic">لا توجد مصاريف مقيدة في الفترة الحالية</p>
                </div>
            )}
        </Card>
      </div>
    </div>
  );
}
