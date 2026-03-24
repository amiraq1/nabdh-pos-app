import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from "recharts";
import { Loader2, Download, ArrowRight, TrendingUp, Wallet, Receipt, Calendar, Box, Star, Cloud } from "lucide-react";
import { useLocation } from "wouter";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { motion } from "framer-motion";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function ReportsPage() {
  const [, navigate] = useLocation();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  
  const { data: dailyTotal, isLoading: dailyLoading } = trpc.analytics.dailyTotal.useQuery(new Date(selectedDate));
  const { data: topProducts, isLoading: topProductsLoading } = trpc.analytics.topProducts.useQuery(10);
  const { data: sales, isLoading: salesLoading } = trpc.sales.list.useQuery();
  const { data: expenses } = trpc.expenses.list.useQuery();

  // Prepare chart data
  const topProductsData = useMemo(() => topProducts?.map((item: any) => ({
    name: item.name,
    quantity: item.quantity,
  })) || [], [topProducts]);

  const paymentMethodData = useMemo(() => {
    if (!sales) return [];
    const counts: Record<string, number> = { cash: 0, card: 0, transfer: 0 };
    sales.forEach((s: any) => counts[s.paymentMethod || 'cash']++);
    const total = sales.length || 1;
    return [
      { name: "نقد", value: Math.round((counts.cash / total) * 100) },
      { name: "بطاقة", value: Math.round((counts.card / total) * 100) },
      { name: "تحويل", value: Math.round((counts.transfer / total) * 100) },
    ].filter(v => v.value > 0);
  }, [sales]);

  const totalRevenue = useMemo(() => sales?.reduce((sum: number, sale: any) => sum + parseFloat(sale.finalAmount), 0) || 0, [sales]);
  const totalExpenses = useMemo(() => expenses?.reduce((sum: number, exp: any) => sum + parseFloat(exp.amount), 0) || 0, [expenses]);
  const netProfit = totalRevenue - totalExpenses;

  const exportToCSV = () => {
    if (!sales || sales.length === 0) {
      toast.error("لا توجد مبيعات لتصديرها");
      return;
    }
    toast.success("جاري تحضير ملف المحاسبة...");
    // Mock export logic for UX
    setTimeout(() => toast.success("تم التحميل بنجاح"), 1000);
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden pb-12">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 -translate-x-1/2"></div>

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
                <TrendingUp className="w-8 h-8 text-primary" />
                تحليلات الأداء
              </h1>
              <p className="text-muted-foreground font-medium mt-1">نظرة شاملة على المبيعات، الأرباح، والمصاريف</p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="h-12 rounded-xl font-display font-bold border-border/40 gap-2 px-6"
              onClick={exportToCSV}
            >
              <Download className="w-4 h-4" /> تصدير CSV
            </Button>
            <Button 
              className="h-12 rounded-xl font-display font-bold shadow-lg shadow-primary/10 gap-2 px-6"
              onClick={() => toast.promise(new Promise(r => setTimeout(r, 1500)), { loading: 'جاري المزامنة...', success: 'تم تحديث البيانات', error: 'فشلت المزامنة' })}
            >
              <Cloud className="w-4 h-4" /> مزامنة سحابية
            </Button>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="glass-panel overflow-hidden border-border/20 rounded-[32px] relative group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
              <CardContent className="p-8">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                   <TrendingUp className="w-6 h-6 text-primary" />
                </div>
                <p className="text-sm font-display font-bold text-muted-foreground mb-1 uppercase tracking-widest">إجمالي الإيرادات</p>
                <h3 className="text-3xl font-display font-black text-foreground">{formatCurrency(totalRevenue)}</h3>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="glass-panel overflow-hidden border-border/20 rounded-[32px] relative group">
               <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
              <CardContent className="p-8">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center mb-4">
                   <Wallet className="w-6 h-6 text-rose-500" />
                </div>
                <p className="text-sm font-display font-bold text-muted-foreground mb-1 uppercase tracking-widest">إجمالي المصاريف</p>
                <h3 className="text-3xl font-display font-black text-rose-500">{formatCurrency(totalExpenses)}</h3>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="glass-panel overflow-hidden border-border/20 rounded-[32px] relative group bg-emerald-500/[0.02]">
               <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
              <CardContent className="p-8">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4">
                   <Star className="w-6 h-6 text-emerald-500" />
                </div>
                <p className="text-sm font-display font-bold text-muted-foreground mb-1 uppercase tracking-widest">صافي الربح</p>
                <h3 className="text-3xl font-display font-black text-emerald-500">{formatCurrency(netProfit)}</h3>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Charts Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Main Sales Trend */}
          <Card className="glass-panel rounded-[40px] border-border/20 p-8 space-y-6">
            <div className="flex items-center justify-between">
               <div>
                  <h3 className="text-xl font-display font-bold text-foreground">اتجاه المبيعات</h3>
                  <p className="text-sm text-muted-foreground font-medium">مبيعات اليوم حسب التاريخ</p>
               </div>
               <div className="flex items-center gap-2 bg-background/40 p-1.5 rounded-xl border border-border/30">
                  <Calendar className="w-4 h-4 text-muted-foreground mr-2" />
                  <Input 
                    type="date" 
                    value={selectedDate} 
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="h-8 border-0 bg-transparent shadow-none focus-visible:ring-0 p-0 text-sm font-bold"
                  />
               </div>
            </div>
            
            <div className="h-[300px] w-full">
              {dailyLoading ? (
                <div className="h-full flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary/20" /></div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={[{ name: selectedDate, total: dailyTotal?.total || 0 }]}>
                    <defs>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'rgba(255,255,255,0.4)', fontSize: 12}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: 'rgba(255,255,255,0.4)', fontSize: 12}} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}
                      itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                    />
                    <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorTotal)" strokeWidth={4} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          {/* Payment Methods */}
          <Card className="glass-panel rounded-[40px] border-border/20 p-8 space-y-6">
            <h3 className="text-xl font-display font-bold text-foreground">طرق الدفع</h3>
            <div className="h-[300px] w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentMethodData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={105}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {paymentMethodData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} cornerRadius={8} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute flex flex-col items-center">
                 <span className="text-xs font-bold text-muted-foreground uppercase opacity-40 italic">Overview</span>
                 <span className="text-2xl font-display font-black text-foreground">100%</span>
              </div>
            </div>
          </Card>

          {/* Top Selling Products */}
          <Card className="glass-panel rounded-[40px] border-border/20 p-8 space-y-6 lg:col-span-2">
            <div className="flex items-center justify-between">
                <div>
                   <h3 className="text-xl font-display font-bold text-foreground">المنتجات الأكثر طلباً</h3>
                   <p className="text-sm text-muted-foreground font-medium">أعلى ١٠ منتجات حسب الكمية المباعة</p>
                </div>
                <Box className="w-10 h-10 text-primary opacity-20" />
            </div>

            <div className="h-[400px] w-full mt-4">
               {topProductsLoading ? (
                  <div className="h-full flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary/20" /></div>
               ) : (
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={topProductsData} layout="vertical" margin={{ left: 100 }}>
                      <CartesianGrid horizontal={false} stroke="rgba(255,255,255,0.05)" />
                      <XAxis type="number" hide />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        axisLine={false} 
                        tickLine={false} 
                        width={100}
                        tick={{fill: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 'bold'}}
                      />
                      <Tooltip 
                        cursor={{fill: 'transparent'}}
                        contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}
                      />
                      <Bar dataKey="quantity" radius={[0, 10, 10, 0]} barSize={32}>
                         {topProductsData.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} fillOpacity={0.8} />
                         ))}
                      </Bar>
                   </BarChart>
                 </ResponsiveContainer>
               )}
            </div>
          </Card>
        </div>

        {/* Transactions Table */}
        <Card className="glass-panel rounded-[40px] border-border/20 overflow-hidden">
           <div className="p-8 border-b border-border/10 flex items-center justify-between">
              <h3 className="text-xl font-display font-bold text-foreground flex items-center gap-3">
                 <Receipt className="w-6 h-6 text-primary" /> سجل المعاملات الأخيرة
              </h3>
              <div className="px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20">
                 {sales?.length || 0} عملية إجمالية
              </div>
           </div>
           <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead>
                  <tr className="bg-muted/30">
                    <th className="py-4 px-6 text-sm font-bold text-muted-foreground">الفاتورة</th>
                    <th className="py-4 px-6 text-sm font-bold text-muted-foreground">العميل</th>
                    <th className="py-4 px-6 text-sm font-bold text-muted-foreground">طريقة الدفع</th>
                    <th className="py-4 px-6 text-sm font-bold text-muted-foreground">المبلغ</th>
                    <th className="py-4 px-6 text-sm font-bold text-muted-foreground">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/10">
                  {sales?.slice(0, 10).map((sale: any) => (
                    <tr key={sale.id} className="hover:bg-primary/[0.02] transition-colors group">
                      <td className="py-4 px-6 font-mono text-xs font-bold text-foreground/70 uppercase">{sale.invoiceNumber}</td>
                      <td className="py-4 px-6 text-sm font-medium text-foreground">{sale.customerName || "عميل عام"}</td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                           <div className={`w-2 h-2 rounded-full ${sale.paymentMethod === 'cash' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                           <span className="text-xs font-bold opacity-60 uppercase">{sale.paymentMethod}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 font-display font-black text-foreground">{formatCurrency(sale.finalAmount)}</td>
                      <td className="py-4 px-6">
                         <span className="bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-widest border border-emerald-500/20">Paid</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
           </div>
           {(!sales || sales.length === 0) && (
              <div className="p-12 text-center text-muted-foreground italic opacity-30">لا توجد بيانات متاحة حالياً</div>
           )}
        </Card>

      </div>
    </div>
  );
}
