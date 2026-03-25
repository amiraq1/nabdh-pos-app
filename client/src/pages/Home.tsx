import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Package, BarChart3, Receipt, Boxes, ArrowRight, Wallet, TrendingUp, Users, LogIn, Layers } from "lucide-react";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, UserCircle } from "lucide-react";
import { native } from "@/_core/native";
import { motion } from "framer-motion";

export default function Home() {
  const { user, loading, isAuthenticated, refresh } = useAuth();
  const [, navigate] = useLocation();
  const [pin, setPin] = useState("");
  
  const loginMutation = trpc.auth.loginByPin.useMutation({
    onSuccess: () => {
      toast.success("تم تسجيل الدخول بنجاح", { className: "font-display bg-primary text-primary-foreground border-primary" });
      refresh();
    },
    onError: (err) => {
      toast.error(err.message || "رمز الدخول غير صحيح", { className: "font-display text-destructive" });
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  // ============== شاشة تسجيل الدخول (Login Screen - Avant-Garde) ==============
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden flex flex-col items-center justify-center p-4">
        {/* Ambient Lights */}
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-primary/20 rounded-full blur-[100px] pointer-events-none -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none translate-x-1/2 translate-y-1/2"></div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-sm glass-panel p-8 rounded-[32px] relative z-10 shadow-2xl shadow-primary/5"
        >
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-primary/80 to-primary rounded-[24px] flex items-center justify-center mx-auto mb-5 shadow-lg shadow-primary/20">
              <ShoppingCart className="w-10 h-10 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">نظام نـبـض</h1>
            <p className="text-muted-foreground text-sm font-medium mt-1">تسجيل دخول الكاشير</p>
          </div>

          <div className="space-y-8">
            {/* PIN Dots */}
            <div className="flex justify-center gap-4">
              {[...Array(4)].map((_, i) => (
                <div 
                  key={i} 
                  className={`w-4 h-4 rounded-full transition-all duration-300 ${
                    i < pin.length 
                    ? 'bg-primary shadow-[0_0_12px_rgba(var(--primary),0.8)] scale-110' 
                    : 'bg-muted-foreground/20'
                  }`}
                />
              ))}
            </div>
            
            {/* PIN Pad */}
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  className="h-16 rounded-[20px] text-2xl font-display font-bold bg-background/50 hover:bg-primary/10 hover:text-primary border border-border/30 transition-all duration-200 active:scale-95"
                  onClick={() => handlePinClick(num.toString())}
                  disabled={loginMutation.isPending}
                >
                  {num}
                </button>
              ))}
              <button
                className="h-16 rounded-[20px] text-sm font-display font-bold text-destructive bg-background/50 hover:bg-destructive/10 border border-border/30 transition-all duration-200 active:scale-95"
                onClick={clearPin}
                disabled={loginMutation.isPending}
              >
                حذف
              </button>
              <button
                className="h-16 rounded-[20px] text-2xl font-display font-bold bg-background/50 hover:bg-primary/10 hover:text-primary border border-border/30 transition-all duration-200 active:scale-95"
                onClick={() => handlePinClick("0")}
                disabled={loginMutation.isPending}
              >
                0
              </button>
              <div className="flex items-center justify-center h-16">
                {loginMutation.isPending && <Loader2 className="w-6 h-6 animate-spin text-primary" />}
              </div>
            </div>
          </div>

          <div className="pt-8 mt-8 border-t border-border/30">
            <Button 
              variant="ghost"
              className="w-full text-xs font-medium text-muted-foreground hover:text-primary transition-colors gap-2 rounded-xl h-10"
              onClick={() => window.location.href = getLoginUrl()}
            >
               <LogIn className="w-4 h-4" /> الدخول كمدير نظام (Web)
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ============== لوحة التحكم الرئيسية (Home Dashboard - Avant-Garde) ==============
  
  const dashboardItems = [
    { title: "نقطة البيع", desc: "فتح محطة الكاشير فوراً", icon: ShoppingCart, link: "/pos", color: "from-blue-500/20 to-indigo-500/20", iconColor: "text-blue-500" },
    { title: "المنتجات", desc: "إضافة وتعديل الأرصدة", icon: Package, link: "/products", color: "from-emerald-500/20 to-green-500/20", iconColor: "text-emerald-500" },
    { title: "الفئات", desc: "أقسام المتجر", icon: Layers, link: "/categories", color: "from-orange-500/20 to-amber-500/20", iconColor: "text-orange-500" },
    { title: "المخزون", desc: "مراقبة النواقص والجرد", icon: Boxes, link: "/inventory", color: "from-rose-500/20 to-red-500/20", iconColor: "text-rose-500" },
    { title: "التقارير", desc: "الأرباح والمبيعات", icon: BarChart3, link: "/reports", color: "from-purple-500/20 to-fuchsia-500/20", iconColor: "text-purple-500" },
    { title: "المصاريف", desc: "سجل المدفوعات اليومية", icon: Receipt, link: "/expenses", color: "from-cyan-500/20 to-sky-500/20", iconColor: "text-cyan-500" },
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden pb-20">
      {/* Background Ambience */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none translate-x-1/3 -translate-y-1/3"></div>
      
      {/* Header */}
      <header className="relative z-20 border-b border-border/20 bg-background/60 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-primary/80 to-primary rounded-[16px] flex items-center justify-center shadow-lg shadow-primary/20">
              <ShoppingCart className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-display font-black text-foreground tracking-tight">نظام نـبـض</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  {native.isNative ? 'الحالة: متصل' : 'محطة الويب نشطة'}
                </span>
              </div>
            </div>
          </div>

          <Button 
            variant="outline" 
            className="rounded-[16px] h-12 px-5 glass-panel border-border/30 hover:bg-primary/10 hover:border-primary transition-all font-display gap-3 group"
            onClick={() => navigate("/profile")}
          >
            <div className="flex flex-col items-end text-left">
               <span className="text-xs text-muted-foreground font-medium">الكاشير النشط</span>
               <span className="text-sm font-bold leading-none">{user?.name}</span>
            </div>
            <UserCircle className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 relative z-10">
        
        {/* Welcome Hero */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-10"
        >
          <h2 className="text-3xl sm:text-4xl font-display font-black text-foreground mb-2">أهلاً بك، <span className="text-primary">{user?.name?.split(' ')[0]}</span></h2>
          <p className="text-muted-foreground font-medium">لوحة التحكم الرئيسية لإدارة نقاط البيع والمخزون.</p>
        </motion.div>

        {/* Quick Stats/Widgets (UI Mockup for Avant-Garde feel) */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12"
        >
          <div className="glass-panel p-6 rounded-[32px] border border-border/20 relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 w-32 h-32 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-colors"></div>
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="w-12 h-12 rounded-[16px] bg-primary/10 flex items-center justify-center">
                 <TrendingUp className="w-6 h-6 text-primary" />
              </div>
            </div>
            <p className="text-sm font-display font-medium text-muted-foreground mb-1 relative z-10">مبيعات اليوم (تجريبي)</p>
            <h3 className="text-3xl font-display font-black text-foreground relative z-10">٠ د.ع</h3>
          </div>
          
          <div className="glass-panel p-6 rounded-[32px] border border-border/20 relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 w-32 h-32 bg-orange-500/10 rounded-full blur-2xl group-hover:bg-orange-500/20 transition-colors"></div>
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="w-12 h-12 rounded-[16px] bg-orange-500/10 flex items-center justify-center">
                 <Users className="w-6 h-6 text-orange-500" />
              </div>
            </div>
            <p className="text-sm font-display font-medium text-muted-foreground mb-1 relative z-10">الفواتير لليوم</p>
            <h3 className="text-3xl font-display font-black text-foreground relative z-10">٠ فاتورة</h3>
          </div>

          <div className="glass-panel p-6 rounded-[32px] border border-border/20 relative overflow-hidden group md:block hidden">
            <div className="absolute -right-6 -top-6 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl group-hover:bg-cyan-500/20 transition-colors"></div>
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="w-12 h-12 rounded-[16px] bg-cyan-500/10 flex items-center justify-center">
                 <Wallet className="w-6 h-6 text-cyan-500" />
              </div>
            </div>
            <p className="text-sm font-display font-medium text-muted-foreground mb-1 relative z-10">رصيد الصندوق</p>
            <h3 className="text-3xl font-display font-black text-foreground relative z-10">٠ د.ع</h3>
          </div>
        </motion.div>

        {/* Modules Grid */}
        <h3 className="text-xl font-display font-bold mb-6 flex items-center gap-2">
          الأنظمة التشغيلية
          <div className="h-px bg-border/50 flex-1 ml-4"></div>
        </h3>
        
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {dashboardItems.map((item, idx) => (
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 + (idx * 0.05) }}
              whileHover={{ y: -5, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              key={item.title}
              onClick={() => navigate(item.link)}
              className="glass-panel p-6 rounded-[32px] text-right border border-border/20 hover:border-primary/50 transition-all group relative overflow-hidden text-left flex flex-col items-start justify-between min-h-[160px]"
            >
              {/* Icon Watermark */}
              <item.icon className="absolute -bottom-4 -left-4 w-32 h-32 text-muted-foreground/5 opacity-50 group-hover:scale-110 transition-transform duration-500 pointer-events-none" />
              
              <div className={`w-14 h-14 rounded-[20px] bg-gradient-to-br ${item.color} flex flex-shrink-0 items-center justify-center mb-4`}>
                <item.icon className={`w-7 h-7 ${item.iconColor}`} />
              </div>

              <div className="z-10 text-right w-full">
                <h3 className="text-lg sm:text-xl font-display font-bold text-foreground mb-1 group-hover:text-primary transition-colors">{item.title}</h3>
                <p className="text-sm font-medium text-muted-foreground line-clamp-2">{item.desc}</p>
              </div>
              
              <div className="absolute top-6 left-6 opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all duration-300">
                <div className="w-8 h-8 rounded-full bg-background/50 backdrop-blur-md flex items-center justify-center border border-border/50">
                   <ArrowRight className="w-4 h-4 text-foreground rotate-180" />
                </div>
              </div>
            </motion.button>
          ))}
        </div>

      </main>
    </div>
  );
}
