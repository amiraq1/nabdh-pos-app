import { useAuth } from "@/_core/hooks/useAuth";
import { native } from "@/_core/native";
import { motion } from "framer-motion";
import { BarChart3, LayoutDashboard, Menu, Package, ShoppingCart, Layers } from "lucide-react";
import { useLocation } from "wouter";

import { hasPermission, type AppPermission } from "@shared/permissions";

const navItems: Array<{
  icon: typeof LayoutDashboard;
  label: string;
  path: string;
  permission: AppPermission;
}> = [
  { icon: LayoutDashboard, label: "الرئيسية", path: "/", permission: "dashboard.view" },
  { icon: ShoppingCart, label: "نقطة البيع", path: "/pos", permission: "pos.use" },
  { icon: Package, label: "المنتجات", path: "/products", permission: "products.view" },
  { icon: BarChart3, label: "التقارير", path: "/reports", permission: "reports.view.own" },
  { icon: Menu, label: "المزيد", path: "/profile", permission: "profile.view" },
];

export default function BottomNav() {
  const [location, navigate] = useLocation();
  const { user } = useAuth();

  const visibleItems = navItems.filter(item => {
    if (item.path === "/reports") {
      return hasPermission((user as any)?.role, "reports.view.all") || 
             hasPermission((user as any)?.role, "reports.view.own");
    }
    return hasPermission((user as any)?.role, item.permission);
  });

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden" aria-label="التنقل الرئيسي">
      <div className="border-t border-border/30 bg-background/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-lg items-center justify-around px-2">
          {visibleItems.map(item => {
            const isActive = location === item.path;

            return (
              <button
                key={item.path}
                onClick={() => {
                  native.vibrate();
                  navigate(item.path);
                }}
                className="relative flex h-full flex-1 flex-col items-center justify-center gap-0.5"
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
              >
                {isActive && (
                  <motion.div
                    layoutId="bottomnav-indicator"
                    className="absolute -top-px left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <item.icon
                  className={`h-5 w-5 transition-colors ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                />
                <span
                  className={`text-[10px] font-display font-bold transition-colors ${
                    isActive ? "text-primary" : "text-muted-foreground/70"
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
