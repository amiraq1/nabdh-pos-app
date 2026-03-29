import { Loader2, ShoppingCart, Layers } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { motion } from "framer-motion";

interface ProductGridProps {
  productsLoading: boolean;
  filteredProducts: any[];
  categories: any[];
  selectedCategoryId: number | null;
  onSelectCategory: (id: number | null) => void;
  addToCart: (product: any) => void;
}

export function ProductGrid({
  productsLoading,
  filteredProducts,
  categories,
  selectedCategoryId,
  onSelectCategory,
  addToCart,
}: ProductGridProps) {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Category Tabs Section */}
      {categories.length > 0 && (
        <div className="mb-4">
          <ScrollArea className="w-full whitespace-nowrap" dir="rtl">
            <div className="flex w-max space-x-2 space-x-reverse p-1">
              <button
                onClick={() => onSelectCategory(null)}
                className={`relative px-6 py-2.5 rounded-2xl text-sm font-semibold transition-all duration-300 ${
                  selectedCategoryId === null
                    ? "text-primary-foreground shadow-lg"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {selectedCategoryId === null && (
                  <motion.div
                    layoutId="activeCategory"
                    className="absolute inset-0 rounded-2xl bg-primary"
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  />
                )}
                <span className="relative flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  الكل
                </span>
              </button>

              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => onSelectCategory(category.id)}
                  className={`relative px-6 py-2.5 rounded-2xl text-sm font-semibold transition-all duration-300 ${
                    selectedCategoryId === category.id
                      ? "text-primary-foreground shadow-lg"
                      : "bg-background border border-border/40 text-muted-foreground hover:bg-muted hover:text-foreground hover:border-primary/50"
                  }`}
                >
                  {selectedCategoryId === category.id && (
                    <motion.div
                      layoutId="activeCategory"
                      className="absolute inset-0 rounded-2xl bg-primary"
                      transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    />
                  )}
                  <span className="relative">{category.name}</span>
                </button>
              ))}
            </div>
            <ScrollBar orientation="horizontal" className="invisible" />
          </ScrollArea>
        </div>
      )}

      {/* Products Grid */}
      <div className="flex-1 overflow-y-auto pb-4 pr-1 scroll-smooth">
        {productsLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4 pb-20">
            {filteredProducts.slice(0, 200).map((product: any) => (
              <div
                key={product.id}
                className="transition-transform duration-200 hover:-translate-y-1 hover:scale-[1.01] active:scale-95"
              >
                <Card
                  className="h-full cursor-pointer overflow-hidden rounded-[24px] border border-border/30 bg-card/80 backdrop-blur-md shadow-sm transition-all hover:border-primary/50 hover:shadow-primary/5"
                  onClick={(event) => {
                    event.preventDefault();
                    addToCart(product);
                  }}
                >
                  {product.imageUrl ? (
                    <div className="relative h-32 w-full overflow-hidden bg-muted">
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="h-full w-full object-cover transition-transform duration-500 hover:scale-110"
                      />
                    </div>
                  ) : (
                    <div className="flex h-32 w-full items-center justify-center bg-gradient-to-br from-primary/5 via-muted to-primary/10">
                      <ShoppingCart className="h-8 w-8 text-primary/30" />
                    </div>
                  )}
                  <CardContent className="flex flex-col justify-between p-4 min-h-[110px]">
                    <div>
                      <p className="truncate text-[15px] font-bold text-foreground font-display">
                        {product.name}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5 opacity-60">
                        <span className="truncate font-mono text-[10px] uppercase tracking-tighter">
                          #{product.barcode || product.sku}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-xl font-black tracking-tight text-primary font-display">
                        {formatCurrency(product.price)}
                      </p>
                      <span
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-bold backdrop-blur-sm ${
                          product.quantity > 0
                            ? "bg-primary/10 text-primary border border-primary/20"
                            : "bg-destructive/10 text-destructive border border-destructive/20"
                        }`}
                      >
                        {product.quantity > 0 ? `${product.quantity} متوفر` : "نفد"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-panel flex h-64 flex-col items-center justify-center rounded-[32px] border-dashed gap-2 group hover:border-primary/50 transition-colors">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center group-hover:scale-110 transition-transform">
              <Layers className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="font-display font-medium text-muted-foreground">لا توجد منتجات متطابقة</p>
          </div>
        )}
      </div>
    </div>
  );
}
