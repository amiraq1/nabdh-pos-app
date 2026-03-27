import { motion } from "framer-motion";
import { Loader2, ShoppingCart } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

interface ProductGridProps {
  productsLoading: boolean;
  filteredProducts: any[];
  addToCart: (product: any) => void;
}

export function ProductGrid({
  productsLoading,
  filteredProducts,
  addToCart,
}: ProductGridProps) {
  return (
    <div className="flex-1 overflow-y-auto pb-4 pr-1">
      {productsLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredProducts.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProducts.map((product: any) => (
            <motion.div
              key={product.id}
              whileHover={{ y: -4, scale: 1.01 }}
              whileTap={{ scale: 0.96 }}
            >
              <Card
                className="h-full cursor-pointer overflow-hidden rounded-2xl border border-border/30 bg-background/40 shadow-sm backdrop-blur-sm transition-all hover:border-primary/50"
                onClick={event => {
                  event.preventDefault();
                  addToCart(product);
                }}
              >
                {product.imageUrl ? (
                  <div className="relative h-32 w-full overflow-hidden bg-muted">
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex h-32 w-full items-center justify-center bg-gradient-to-br from-muted/50 to-muted">
                    <ShoppingCart className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                )}
                <CardContent className="flex h-[104px] flex-col justify-between p-4">
                  <div>
                    <p className="truncate text-sm font-semibold text-foreground font-display">
                      {product.name}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5 border-t border-border/10 pt-1">
                      <span className="truncate font-mono text-[9px] uppercase tracking-tighter text-muted-foreground">
                        #{product.barcode || product.sku}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-lg font-bold tracking-tight text-primary">
                      {formatCurrency(product.price)}
                    </p>
                    <span
                      className={`rounded-md px-2 py-1 text-[10px] font-bold ${
                        product.quantity > 0
                          ? "bg-primary/10 text-primary"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {product.quantity > 0 ? `${product.quantity} متوفر` : "نفد"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="glass-panel flex h-64 items-center justify-center rounded-2xl border-dashed">
          <p className="font-display text-muted-foreground">لا توجد منتجات تطابق بحثك</p>
        </div>
      )}
    </div>
  );
}
