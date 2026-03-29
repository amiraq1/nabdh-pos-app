import { motion, AnimatePresence } from "framer-motion";
import { Minus, Plus, ShoppingCart, ArrowRight, Database } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface CartSidebarProps {
  cart: any[];
  subtotal: number;
  discountAmount: number;
  total: number;
  updateQuantity: (productId: number, quantity: number) => void;
  onCheckout: () => void;
  variant?: "inline" | "sidebar";
}

export function CartSidebar({
  cart,
  subtotal,
  discountAmount,
  total,
  updateQuantity,
  onCheckout,
  variant = "sidebar",
}: CartSidebarProps) {
  const isInline = variant === "inline";

  return (
    <div className={isInline ? "w-full h-full flex flex-col" : "hidden h-full flex-col lg:col-span-4 lg:flex"}>
      <div className={`glass-panel relative flex flex-1 flex-col overflow-hidden rounded-[32px] border border-border/50 shadow-2xl transition-all duration-500 bg-background/60 backdrop-blur-2xl ${isInline ? "" : ""}`}>
        
        {/* Header */}
        <div className="border-b border-border/30 px-6 py-4 flex items-center justify-between bg-gradient-to-r from-background/50 to-transparent">
          <div className="flex items-center gap-3">
             <div className="bg-primary/10 p-2 rounded-lg">
                <ShoppingCart className="w-5 h-5 text-primary" />
             </div>
             <h2 className="text-base font-bold font-display text-foreground">Order Items</h2>
          </div>
          <span className="rounded-full bg-primary/10 border border-primary/20 px-3 py-0.5 text-xs font-black text-primary">
            {cart.length}
          </span>
        </div>

        {/* Dynamic Items List */}
        <div className="flex-1 space-y-3 overflow-y-auto no-scrollbar p-4">
          <AnimatePresence mode="popLayout">
            {cart.length > 0 ? (
              cart.map(item => (
                <motion.div
                  key={item.productId}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="group relative rounded-[20px] border border-border/40 bg-background/40 p-3 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
                >
                  <div className="flex items-center gap-3">
                    {/* Item Icon/Image Placeholder */}
                    <div className="h-12 w-12 rounded-lg bg-muted/50 flex items-center justify-center shrink-0 border border-border/20">
                       <Database className="w-5 h-5 text-muted-foreground/30" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-bold text-foreground font-display">
                        {item.name}
                      </p>
                      <p className="text-xs font-medium text-primary/80 font-display">
                        ₪ {item.price}
                      </p>
                    </div>

                    {/* Highly Accessible Controls (as per reference image) */}
                    <div className="flex items-center gap-2 bg-muted/30 rounded-lg p-1 border border-border/20">
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-background border border-border/30 text-destructive transition-all active:scale-90 hover:bg-destructive hover:text-white"
                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      
                      <span className="w-5 text-center text-sm font-black font-display">{item.quantity}</span>
                      
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-all active:scale-90 hover:opacity-90 shadow-md shadow-primary/20"
                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="flex h-full flex-col items-center justify-center space-y-6 text-muted-foreground/30 py-16">
                <div className="relative">
                   <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
                   <ShoppingCart className="h-20 w-20 relative opacity-20" />
                </div>
                <div className="text-center space-y-2">
                   <p className="font-display text-base font-bold text-muted-foreground/50">السلة فارغة</p>
                   <p className="text-xs">ابدأ بمسح الأكواد لإضافة المنتجات</p>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Summary & Action */}
        <div className="p-4 bg-gradient-to-b from-background/0 to-background/80 backdrop-blur-md border-t border-border/30">
          <div className="flex items-center justify-between mb-4">
             <span className="text-muted-foreground font-display font-medium text-sm">Total price</span>
             <span className="text-xl font-black text-primary font-display tracking-tight">
               ₪ {total.toFixed(2)}
             </span>
          </div>
        </div>
      </div>
    </div>
  );
}
