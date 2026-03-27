import { motion, AnimatePresence } from "framer-motion";
import { Minus, Plus, ShoppingCart, ArrowRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface CartSidebarProps {
  cart: any[];
  subtotal: number;
  discountAmount: number;
  total: number;
  updateQuantity: (productId: number, quantity: number) => void;
  onCheckout: () => void;
}

export function CartSidebar({
  cart,
  subtotal,
  discountAmount,
  total,
  updateQuantity,
  onCheckout,
}: CartSidebarProps) {
  return (
    <div className="hidden h-full flex-col lg:col-span-4 lg:flex">
      <div className="glass-panel relative flex flex-1 flex-col overflow-hidden rounded-3xl border-white/5 shadow-2xl dark:border-white/5">
        <div className="border-b border-border/30 bg-background/50 p-6 pb-4">
          <h2 className="flex items-center justify-between text-xl font-bold font-display">
            <span>سلة المشتريات</span>
            <span className="rounded-full bg-primary px-3 py-1 text-sm text-primary-foreground">
              {cart.length}
            </span>
          </h2>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          <AnimatePresence mode="popLayout">
            {cart.length > 0 ? (
              cart.map(item => (
                <motion.div
                  key={item.productId}
                  layout
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  className="group rounded-2xl border border-border/40 bg-background/80 p-3 transition-colors hover:border-primary/40"
                >
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <p className="line-clamp-1 text-sm font-medium text-foreground font-display">
                        {item.name}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatCurrency(item.price)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end justify-between text-left">
                      <p className="font-bold text-accent">{formatCurrency(item.subtotal)}</p>
                      <div className="mt-2 flex items-center gap-1 rounded-lg bg-muted/50 p-1">
                        <button
                          type="button"
                          className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                          onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-8 text-center text-xs font-bold">{item.quantity}</span>
                        <button
                          type="button"
                          className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                          onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="flex h-full flex-col items-center justify-center space-y-4 text-muted-foreground/50 opacity-50">
                <ShoppingCart className="h-16 w-16" />
                <p className="font-display">قم بمسح باركود لبدء البيع</p>
              </div>
            )}
          </AnimatePresence>
        </div>

        <div className="space-y-4 border-t border-border/30 bg-background/90 p-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>المجموع الفرعي</span>
              <span className="font-medium text-foreground">{formatCurrency(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm text-destructive">
                <span>الخصم</span>
                <span className="font-medium">-{formatCurrency(discountAmount)}</span>
              </div>
            )}
            <div className="mt-2 flex justify-between border-t border-border/40 pt-2 text-2xl font-bold text-primary font-display">
              <span>الإجمالي</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>

          <Button
            className="group h-14 w-full rounded-2xl text-lg font-bold tracking-wide shadow-lg shadow-primary/20 font-display"
            onClick={onCheckout}
            disabled={cart.length === 0}
          >
            تحديث الدفع
            <ArrowRight className="mr-2 h-5 w-5 transition-transform group-hover:-translate-x-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
