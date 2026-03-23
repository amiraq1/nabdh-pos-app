import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Loader2, Download, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function ReportsPage() {
  const [, navigate] = useLocation();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  
  const { data: dailyTotal, isLoading: dailyLoading } = trpc.analytics.dailyTotal.useQuery(new Date(selectedDate));
  const { data: topProducts, isLoading: topProductsLoading } = trpc.analytics.topProducts.useQuery(10);
  const { data: sales, isLoading: salesLoading } = trpc.sales.list.useQuery();
  const { data: expenses } = trpc.expenses.list.useQuery();

  // Prepare chart data
  const topProductsData = topProducts?.map((item: any) => ({
    name: item.name,
    quantity: item.quantity,
  })) || [];

  const monthlySalesData = [
    { month: "يناير", sales: 15000, target: 20000 },
    { month: "فبراير", sales: 18000, target: 20000 },
    { month: "مارس", sales: 22000, target: 20000 },
    { month: "أبريل", sales: 19000, target: 20000 },
    { month: "مايو", sales: 25000, target: 20000 },
    { month: "يونيو", sales: 28000, target: 20000 },
  ];

  const paymentMethodData = useMemo(() => {
    if (!sales) return [];
    const counts: Record<string, number> = { cash: 0, card: 0, transfer: 0 };
    sales.forEach((s: any) => counts[s.paymentMethod || 'cash']++);
    const total = sales.length || 1;
    return [
      { name: "نقد", value: Math.round((counts.cash / total) * 100) },
      { name: "بطاقة", value: Math.round((counts.card / total) * 100) },
      { name: "تحويل بنكي", value: Math.round((counts.transfer / total) * 100) },
    ].filter(v => v.value > 0);
  }, [sales]);

  const totalRevenue = sales?.reduce((sum: number, sale: any) => sum + parseFloat(sale.finalAmount), 0) || 0;
  const totalExpenses = expenses?.reduce((sum: number, exp: any) => sum + parseFloat(exp.amount), 0) || 0;
  const netProfit = totalRevenue - totalExpenses;
  const totalTransactions = sales?.length || 0;
  const averageTransaction = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

  const exportToCSV = () => {
    if (!sales || sales.length === 0) {
      toast.error("لا توجد مبيعات لتصديرها");
      return;
    }
    
    const headers = ["Invoice", "Customer", "Amount", "Method", "Date"];
    const rows = sales.map((s: any) => [
      s.invoiceNumber,
      s.customerName || "General",
      s.finalAmount,
      s.paymentMethod,
      new Date(s.createdAt).toLocaleDateString("en-US")
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n"
      + rows.map((r: any) => r.join(",")).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `sales_report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    toast.success("تم تصدير ملف المحاسبة بنجاح");
  };

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
            <h1 className="text-3xl font-bold text-foreground">التقارير والإحصائيات</h1>
            <p className="text-foreground/60 mt-1">عرض تحليل المبيعات والأداء</p>
          </div>
        </div>
        <Button variant="outline" className="gap-2 text-accent border-accent/20 hover:bg-accent/5 transition-colors" onClick={() => toast.success("جاري المزامنة السحابية مع نظام المحاسبة...")}>
          <Loader2 className="w-4 h-4" />
          مزامنة سحابية
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-foreground/60">إجمالي المبيعات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{formatCurrency(totalRevenue)}</div>
            <p className="text-xs text-foreground/60 mt-1">جميع الفواتير</p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-foreground/60">إجمالي المصاريف</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">{formatCurrency(totalExpenses)}</div>
            <p className="text-xs text-foreground/60 mt-1">تكاليف التشغيل</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-accent/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-foreground/60">صافي الربح</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
              {formatCurrency(netProfit)}
            </div>
            <p className="text-xs text-foreground/60 mt-1">المبلغ المتبقي</p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Sales */}
      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>مبيعات اليوم</CardTitle>
              <CardDescription>اختر التاريخ لعرض المبيعات</CardDescription>
            </div>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-48"
            />
          </div>
        </CardHeader>
        <CardContent>
          {dailyLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-accent" />
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-foreground/60 mb-2">إجمالي المبيعات</p>
                <p className="text-4xl font-bold text-accent">{formatCurrency(dailyTotal?.total || 0)}</p>
              </div>
              <div>
                <p className="text-sm text-foreground/60 mb-2">عدد المعاملات</p>
                <p className="text-4xl font-bold text-accent">{dailyTotal?.count}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Monthly Sales Chart */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>المبيعات الشهرية</CardTitle>
            <CardDescription>مقارنة المبيعات مع الهدف</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlySalesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="sales" stroke="#3b82f6" name="المبيعات" />
                <Line type="monotone" dataKey="target" stroke="#10b981" name="الهدف" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Payment Methods Chart */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>طرق الدفع</CardTitle>
            <CardDescription>توزيع طرق الدفع</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={paymentMethodData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {paymentMethodData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Products Chart */}
        <Card className="border-border/50 md:col-span-2">
          <CardHeader>
            <CardTitle>أكثر المنتجات مبيعاً</CardTitle>
            <CardDescription>أفضل 10 منتجات</CardDescription>
          </CardHeader>
          <CardContent>
            {topProductsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-accent" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topProductsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="quantity" fill="#3b82f6" name="الكمية المباعة" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Sales */}
      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>آخر المبيعات</CardTitle>
              <CardDescription>أحدث 10 معاملات</CardDescription>
            </div>
            <Button variant="outline" className="gap-2" onClick={exportToCSV}>
              <Download className="w-4 h-4" />
              تصدير
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {salesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-accent" />
            </div>
          ) : sales && sales.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-right py-3 px-4 font-semibold text-foreground">رقم الفاتورة</th>
                    <th className="text-right py-3 px-4 font-semibold text-foreground">العميل</th>
                    <th className="text-right py-3 px-4 font-semibold text-foreground">المبلغ</th>
                    <th className="text-right py-3 px-4 font-semibold text-foreground">طريقة الدفع</th>
                    <th className="text-right py-3 px-4 font-semibold text-foreground">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.slice(0, 10).map((sale: any) => (
                    <tr key={sale.id} className="border-b border-border/50 hover:bg-muted/50">
                      <td className="py-3 px-4">{sale.invoiceNumber}</td>
                      <td className="py-3 px-4">{sale.customerName || "عميل عام"}</td>
                      <td className="py-3 px-4 font-semibold">{formatCurrency(sale.finalAmount)}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 bg-accent/20 text-accent rounded text-sm">
                          {sale.paymentMethod === "cash" ? "نقد" : sale.paymentMethod === "card" ? "بطاقة" : "تحويل"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-foreground/60">
                        {new Date(sale.createdAt).toLocaleDateString("ar-SA")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-foreground/60 text-center py-8">لا توجد مبيعات</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
