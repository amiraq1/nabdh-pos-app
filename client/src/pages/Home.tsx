import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart, Package, BarChart3, Settings, LogOut, Receipt } from "lucide-react";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { native } from "@/_core/native";

export default function Home() {
  const { user, loading, isAuthenticated, refresh, logout } = useAuth();
  const [, navigate] = useLocation();
  const [pin, setPin] = useState("");
  
  const loginMutation = trpc.auth.loginByPin.useMutation({
    onSuccess: () => {
      toast.success("تم تسجيل الدخول بنجاح");
      refresh();
    },
    onError: (err) => {
      toast.error(err.message || "رمز الدخول غير صحيح");
      setPin("");
    }
  });

  const handlePinClick = (digit: string) => {
    native.vibrate();
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      if (newPin.length === 4) {
        loginMutation.mutate(newPin);
      }
    }
  };

  const clearPin = () => {
    native.vibrate();
    setPin("");
  };

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
      <div className="min-h-screen bg-gradient-to-br from-background via-card to-muted flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <Card className="border-border/50 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-500">
            <div className="bg-accent p-8 text-center text-accent-foreground">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                <ShoppingCart className="w-10 h-10" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">نظام نـبـض</h1>
              <p className="text-accent-foreground/70 mt-1">تسجيل دخول الكاشير</p>
            </div>
            <CardContent className="p-8 space-y-8">
              <div className="space-y-4">
                <div className="flex justify-center gap-3">
                  {[...Array(4)].map((_, i) => (
                    <div 
                      key={i} 
                      className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                        i < pin.length ? 'bg-accent border-accent scale-125' : 'bg-transparent border-muted-foreground/30'
                      }`}
                    />
                  ))}
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <Button
                      key={num}
                      variant="outline"
                      className="h-16 text-2xl font-bold hover:bg-accent/10 hover:text-accent border-border/50"
                      onClick={() => handlePinClick(num.toString())}
                      disabled={loginMutation.isPending}
                    >
                      {num}
                    </Button>
                  ))}
                  <Button
                    variant="ghost"
                    className="h-16 text-destructive"
                    onClick={clearPin}
                    disabled={loginMutation.isPending}
                  >
                    حذف
                  </Button>
                  <Button
                    variant="outline"
                    className="h-16 text-2xl font-bold hover:bg-accent/10 border-border/50"
                    onClick={() => handlePinClick("0")}
                    disabled={loginMutation.isPending}
                  >
                    0
                  </Button>
                  <div className="flex items-center justify-center">
                    {loginMutation.isPending && <Loader2 className="w-6 h-6 animate-spin text-accent" />}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border/50">
                <Button 
                  variant="link"
                  className="w-full text-xs text-foreground/40 hover:text-accent transition-colors"
                  onClick={() => window.location.href = getLoginUrl()}
                >
                  الدخول عبر حساب المدير الرئيسي
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
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
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-accent/5 border border-accent/10">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] font-bold text-accent uppercase tracking-wider">
                {native.isNative ? 'التطبيق الأصلي' : 'عبر الويب'}
              </span>
            </div>
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

          <Card 
            className="border-border/50 hover:shadow-lg transition-all cursor-pointer hover:border-accent/50"
            onClick={() => navigate("/expenses")}
          >
            <CardHeader>
              <Receipt className="w-8 h-8 text-accent mb-2" />
              <CardTitle className="text-lg">المصاريف</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground/70">
                إدارة مصاريف المتجر
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
