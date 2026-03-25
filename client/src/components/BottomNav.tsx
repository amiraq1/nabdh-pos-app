import { useLocation } from "wouter";
import { ShoppingCart, LayoutDashboard, Package, BarChart3, Menu } from "lucide-react";
import { motion } from "framer-motion";
import { native } from "@/_core/native";

const navItems = [
  { icon: LayoutDashboard, label: "الرئيسية", path: "/" },
  { icon: ShoppingCart, label: "نقطة البيع", path: "/pos" },
  { icon: Package, label: "المنتجات", path: "/products" },
  { icon: BarChart3, label: "التقارير", path: "/reports" },
  { icon: Menu, label: "المزيد", path: "/profile" },
];

/**
 * Fixed bottom navigation bar for mobile screens.
 * Hidden on desktop (lg+). Appears automatically on all pages.
 */
export default function BottomNav() {
  const [location, navigate] = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden" aria-label="التنقل الرئيسي">
      {/* Backdrop blur container */}
      <div className="bg-background/80 backdrop-blur-xl border-t border-border/30 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
          {navItems.map((item) => {
            const isActive = location === item.path;
            return (
              <button
                key={item.path}
                onClick={() => {
                  native.vibrate();
                  navigate(item.path);
                }}
                className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full relative"
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
              >
                {isActive && (
                  <motion.div
                    layoutId="bottomnav-indicator"
                    className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <item.icon
                  className={`w-5 h-5 transition-colors ${
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
