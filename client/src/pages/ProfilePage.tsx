import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, User, Shield, Moon, Sun, Monitor, Bell, History } from "lucide-react";
import { useLocation } from "wouter";
import { motion, Variants } from "framer-motion";
import { useTheme } from "@/contexts/ThemeContext";
import { useState } from "react";
import { toast } from "sonner";
import { native } from "@/_core/native";

export default function ProfilePage() {
  const [, navigate] = useLocation();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [touchStartPos, setTouchStartPos] = useState<{ x: number, y: number } | null>(null);

  // إيماءة التمرير للعودة
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartPos({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartPos) return;
    const deltaX = touchStartPos.x - e.changedTouches[0].clientX;
    const deltaY = Math.abs(touchStartPos.y - e.changedTouches[0].clientY);
    if (Math.abs(deltaX) > 100 && deltaY < 50) {
      if (touchStartPos.x > window.innerWidth - 50 || touchStartPos.x < 50) {
        native.vibrate();
        navigate("/");
      }
    }
    setTouchStartPos(null);
  };

  // محاكاة حفظ الدبوس
  const handleUpdatePin = () => {
    toast.success("تم تحديث رمز الدخول بنجاح");
    native.vibrate();
  };

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <div 
      className="min-h-screen bg-background pb-20 lg:pb-8"
      onTouchStart={handleTouchStart} 
      onTouchEnd={handleTouchEnd}
    >
      {/* Avant-Garde Hero Header */}
      <div className="relative overflow-hidden bg-accent/5 pt-12 pb-8 border-b border-border/50">
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-64 h-64 bg-accent/10 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-64 h-64 bg-primary/10 rounded-full blur-[80px] pointer-events-none" />
        
        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-full mb-6 w-10 h-10 hover:bg-background/50 backdrop-blur-md border border-border/20"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", duration: 0.6 }}
            className="flex flex-col sm:flex-row items-center sm:items-start gap-6"
          >
            {/* Avatar Profile */}
            <div className="relative group">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-br from-accent to-primary flex items-center justify-center shadow-2xl shadow-accent/20 rotate-3 transition-transform group-hover:rotate-0 duration-300">
                <span className="text-4xl sm:text-5xl font-extrabold text-white">
                  {user?.name?.charAt(0).toUpperCase() || "م"}
                </span>
              </div>
              <div className="absolute -bottom-2 -right-2 bg-green-500 w-6 h-6 rounded-full border-4 border-background" />
            </div>

            {/* User Details */}
            <div className="text-center sm:text-right flex-1 pt-2">
              <h1 className="text-3xl sm:text-4xl font-black text-foreground mb-1 tracking-tight">
                {user?.name || "مستخدم غير معروف"}
              </h1>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 text-accent font-semibold text-sm">
                <Shield className="w-4 h-4" />
                {(user as any)?.role === "admin" ? "مدير النظام" : "كاشير"}
              </span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Settings Sections - Gestalt Law of Proximity Implementation */}
      <div className="container mx-auto px-4 sm:px-6 -mt-4 relative z-20">
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {/* Quick Stats (Satisfaction & Gamification) */}
          <motion.div variants={itemVariants} className="md:col-span-2 lg:col-span-3">
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "مبيعات اليوم", value: "24", icon: History, color: "text-blue-500", bg: "bg-blue-500/10" },
                  { label: "إجمالي الإيرادات", value: "125k", icon: History, color: "text-green-500", bg: "bg-green-500/10" },
                  { label: "ساعات العمل", value: "6.5h", icon: History, color: "text-purple-500", bg: "bg-purple-500/10" },
                  { label: "المعاملات", value: "32", icon: History, color: "text-orange-500", bg: "bg-orange-500/10" }
                ].map((stat, i) => (
                  <div key={i} className="bg-card border border-border/40 p-4 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                    <div className={`${stat.bg} ${stat.color} w-8 h-8 rounded-lg flex items-center justify-center mb-3`}>
                      <stat.icon className="w-4 h-4" />
                    </div>
                    <p className="text-2xl font-black mb-0.5">{stat.value}</p>
                    <p className="text-xs font-semibold text-foreground/50">{stat.label}</p>
                  </div>
                ))}
             </div>
          </motion.div>

          {/* Theme Preferences */}
          <motion.div variants={itemVariants}>
            <Card className="h-full border-border/40 shadow-sm hover:border-accent/30 transition-colors">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Monitor className="w-5 h-5 text-accent" /> المظهر والتجربة
                </CardTitle>
                <CardDescription>خصص الواجهة لتريح بصرك (قانون هيك لتقليل الجهد)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 p-1 bg-muted/50 rounded-xl">
                  <Button 
                    variant={theme === "light" ? "default" : "ghost"}
                    className="rounded-lg h-12"
                    onClick={() => setTheme("light")}
                  >
                    <Sun className="w-4 h-4 ml-2" /> فاتح
                  </Button>
                  <Button 
                    variant={theme === "dark" ? "default" : "ghost"}
                    className="rounded-lg h-12"
                    onClick={() => setTheme("dark")}
                  >
                    <Moon className="w-4 h-4 ml-2" /> داكن
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Security & Access */}
          <motion.div variants={itemVariants}>
            <Card className="h-full border-border/40 shadow-sm hover:border-accent/30 transition-colors">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Shield className="w-5 h-5 text-accent" /> حماية الحساب
                </CardTitle>
                <CardDescription>تحديث رمز الوصول السريع (PIN)</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleUpdatePin(); }}>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-foreground/70 uppercase">الرمز القديم</Label>
                    <Input type="password" placeholder="••••" className="text-center tracking-[1em] font-mono h-12 rounded-xl" maxLength={4} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-foreground/70 uppercase">الرمز الجديد</Label>
                    <Input type="password" placeholder="••••" className="text-center tracking-[1em] font-mono h-12 rounded-xl" maxLength={4} />
                  </div>
                  <Button type="submit" className="w-full h-12 rounded-xl font-bold bg-foreground text-background hover:bg-foreground/90">
                    تحديث الرمز
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>

          {/* Account Settings */}
          <motion.div variants={itemVariants}>
            <Card className="h-full border-border/40 shadow-sm hover:border-accent/30 transition-colors">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <User className="w-5 h-5 text-accent" /> إدارة الجلسة
                </CardTitle>
                <CardDescription>الإشعارات والخروج الآمن</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start h-14 rounded-xl px-4 border-border/50">
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center ml-3">
                    <Bell className="w-4 h-4 text-accent" />
                  </div>
                  <div className="text-right flex-1">
                    <p className="font-bold text-sm">إشعارات المخزون</p>
                    <p className="text-[10px] text-foreground/50">تنبيهات انخفاض مستوى المنتجات</p>
                  </div>
                  <div className="w-8 h-4 bg-accent rounded-full relative after:content-[''] after:absolute after:w-3 after:h-3 after:bg-white after:rounded-full after:left-1 after:top-0.5" />
                </Button>
                
                <div className="pt-4 mt-2 border-t border-border/50">
                  <Button 
                    variant="destructive" 
                    className="w-full h-12 rounded-xl font-bold bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-colors"
                    onClick={() => logout()}
                  >
                    تسجيل الخروج
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
