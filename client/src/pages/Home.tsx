import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart, Package, BarChart3, Settings, LogOut } from "lucide-react";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";

export default function Home() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [, navigate] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-foreground/60">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-card to-muted">
        {/* Header */}
        <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-accent-foreground" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Nabdh POS</h1>
            </div>
            <Button onClick={() => window.location.href = getLoginUrl()}>
              دخول
            </Button>
          </div>
        </header>

        {/* Hero Section */}
        <section className="container mx-auto px-4 py-20">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-5xl font-bold text-foreground mb-6">
              نظام إدارة المتجر الذكي
            </h2>
            <p className="text-xl text-foreground/70 mb-8">
              حل احترافي متكامل لإدارة المبيعات والمخزون والفواتير بسهولة وكفاءة
            </p>
            <Button 
              size="lg"
              onClick={() => window.location.href = getLoginUrl()}
              className="gap-2"
            >
              ابدأ الآن
            </Button>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            <Card className="border-border/50 hover:shadow-lg transition-shadow">
              <CardHeader>
                <ShoppingCart className="w-8 h-8 text-accent mb-2" />
                <CardTitle>نقطة البيع الذكية</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground/70">
                  واجهة بيع سريعة وسهلة الاستخدام مع حساب فوري للإجمالي والضرائب
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/50 hover:shadow-lg transition-shadow">
              <CardHeader>
                <Package className="w-8 h-8 text-accent mb-2" />
                <CardTitle>إدارة المخزون</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground/70">
                  تتبع فوري للكميات مع تنبيهات نفاد المخزون وسجل حركة المنتجات
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/50 hover:shadow-lg transition-shadow">
              <CardHeader>
                <BarChart3 className="w-8 h-8 text-accent mb-2" />
                <CardTitle>التقارير والإحصائيات</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground/70">
                  لوحة تحليل شاملة مع رسوم بيانية وتقارير مبيعات يومية وشهرية
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-50 bg-card/95">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-accent-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Nabdh POS</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-foreground/70">{user?.name}</span>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => logout()}
              className="gap-2"
            >
              <LogOut className="w-4 h-4" />
              خروج
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-2">مرحباً بك</h2>
          <p className="text-foreground/60">اختر ما تريد إنجازه من القائمة أعلاه</p>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card 
            className="border-border/50 hover:shadow-lg transition-all cursor-pointer hover:border-accent/50"
            onClick={() => navigate("/pos")}
          >
            <CardHeader>
              <ShoppingCart className="w-8 h-8 text-accent mb-2" />
              <CardTitle className="text-lg">نقطة البيع</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground/70">
                ابدأ عملية بيع جديدة
              </p>
            </CardContent>
          </Card>

          <Card 
            className="border-border/50 hover:shadow-lg transition-all cursor-pointer hover:border-accent/50"
            onClick={() => navigate("/categories")}
          >
            <CardHeader>
              <Package className="w-8 h-8 text-accent mb-2" />
              <CardTitle className="text-lg">الفئات</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground/70">
                إدارة فئات المنتجات
              </p>
            </CardContent>
          </Card>

          <Card 
            className="border-border/50 hover:shadow-lg transition-all cursor-pointer hover:border-accent/50"
            onClick={() => navigate("/products")}
          >
            <CardHeader>
              <Package className="w-8 h-8 text-accent mb-2" />
              <CardTitle className="text-lg">المنتجات</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground/70">
                إدارة المنتجات والأسعار
              </p>
            </CardContent>
          </Card>

          <Card 
            className="border-border/50 hover:shadow-lg transition-all cursor-pointer hover:border-accent/50"
            onClick={() => navigate("/inventory")}
          >
            <CardHeader>
              <Package className="w-8 h-8 text-accent mb-2" />
              <CardTitle className="text-lg">المخزون</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground/70">
                تتبع المخزون والتنبيهات
              </p>
            </CardContent>
          </Card>

          <Card 
            className="border-border/50 hover:shadow-lg transition-all cursor-pointer hover:border-accent/50"
            onClick={() => navigate("/reports")}
          >
            <CardHeader>
              <BarChart3 className="w-8 h-8 text-accent mb-2" />
              <CardTitle className="text-lg">التقارير</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground/70">
                عرض التقارير والإحصائيات
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
