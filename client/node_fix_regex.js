import fs from 'fs';
import path from 'path';

const posPath = path.resolve('client/src/pages/POSPage.tsx');
let content = fs.readFileSync(posPath, 'utf8');

// Replace removeFromCart
content = content.replace(/const removeFromCart = useCallback[^]+\], \[\]\);/g, `const removeFromCart = useCallback((productId: number) => {
    removeStoreItem(productId);
  }, [removeStoreItem]);`);

// Replace updateQuantity
content = content.replace(/const updateQuantity = useCallback[^]+removeFromCart\]\);/g, `const updateQuantity = useCallback((productId: number, quantity: number) => {
    const product = products?.find((p: any) => p.id === productId);
    if (!product) return;
    const success = updateStoreQuantity(productId, quantity, product.quantity);
    if (!success) toast.error("تجاوز الحد المتوفر للمخزون", { duration: 1000 });
  }, [products, updateStoreQuantity]);`);

// Replace customer resets
content = content.replace(/setCustomerName\([^)]*\);/g, '');
content = content.replace(/setCustomerPhone\([^)]*\);/g, 'setCustomerDetails("", "");');

// And just to make sure, any leftover `setCart` if somehow not matched:
content = content.replace(/setCart\(\[\]\);/g, 'clearCart();');

fs.writeFileSync(posPath, content);
console.log("Regex replacements applied");
