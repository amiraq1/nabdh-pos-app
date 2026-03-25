import fs from 'fs';
import path from 'path';

const posPath = path.resolve('client/src/pages/POSPage.tsx');
let content = fs.readFileSync(posPath, 'utf8');

// 1. imports
content = content.replace(
  'import { native } from "@/_core/native";',
  'import { native } from "@/_core/native";\nimport { useCartStore } from "@/stores/cartStore";'
);

// 2. State substitutions
const oldStateBlock = `  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [taxRate] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);`;

const newStateBlock = `  const { cart, discount, discountType, paymentMethod, customerName, customerPhone, addItem, updateQuantity: updateStoreQuantity, removeItem: removeStoreItem, setDiscount, setDiscountType, setCustomerDetails, setPaymentMethod, clearCart } = useCartStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [taxRate] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);`;

content = content.replace(oldStateBlock, newStateBlock);

// 3. addToCart
const oldAddToCart = `  const addToCart = useCallback((product: any) => {
    native.vibrate();
    if (product.quantity <= 0) {
      toast.error("نفدت الكمية", { className: "font-display text-destructive border-destructive" });
      return;
    }

    setCart((currentCart) => {
      const existingItem = currentCart.find(item => item.productId === product.id);
      if (existingItem) {
        if (existingItem.quantity >= product.quantity) {
          toast.error("بلغت الحد الأقصى للمخزون");
          return currentCart;
        }
        toast.success(\`تمت إضافة \${product.name}\`, { duration: 1000 });
        return currentCart.map(item =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.price }
            : item
        );
      } else {
        toast.success(\`تمت إضافة \${product.name}\`, { duration: 1000 });
        return [...currentCart, {
          productId: product.id,
          name: product.name,
          price: parseFloat(product.price),
          quantity: 1,
          subtotal: parseFloat(product.price),
        }];
      }
    });
  }, []);`;

const newAddToCart = `  const addToCart = useCallback((product: any) => {
    native.vibrate();
    const result = addItem(product, product.quantity);
    if (!result.success) {
      toast.error(result.message, { className: "font-display text-destructive border-destructive" });
    } else {
      toast.success(result.message, { duration: 1000 });
    }
  }, [addItem]);`;

if (content.indexOf(oldAddToCart) !== -1) {
  content = content.replace(oldAddToCart, newAddToCart);
} else {
    // try to fallback by regex
    content = content.replace(/  const addToCart = useCallback\(\(product.*?\}, \[\]\);/ms, newAddToCart);
}

// 4. removeFromCart & updateQuantity
const oldRemove = `  const removeFromCart = useCallback((productId: number) => {
    setCart((current) => current.filter(item => item.productId !== productId));
  }, []);

  const updateQuantity = useCallback((productId: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((current) => current.map(item =>
      item.productId === productId
        ? { ...item, quantity, subtotal: quantity * item.price }
        : item
    ));
  }, [removeFromCart]);`;

const newRemove = `  const removeFromCart = useCallback((productId: number) => {
    removeStoreItem(productId);
  }, [removeStoreItem]);

  const updateQuantity = useCallback((productId: number, quantity: number) => {
    const product = products?.find((p: any) => p.id === productId);
    if (!product) return;
    const success = updateStoreQuantity(productId, quantity, product.quantity);
    if (!success) toast.error("تجاوز الحد المتوفر للمخزون", { duration: 1000 });
  }, [products, updateStoreQuantity]);`;

content = content.replace(oldRemove, newRemove);

// 5. checkout clearcart
content = content.replace('setCart([]);', 'clearCart();');

// 6. fix handleSwipeDelete
content = content.replace('const handleSwipeDelete = useCallback((info: PanInfo, productId: number) => {', 'const handleSwipeDelete = useCallback((info: PanInfo, productId: number) => {');

// 7. Re-write the setCustomerName & setCustomerPhone UI lines
// In the input
content = content.replace(
  'onChange={(e) => setCustomerName(e.target.value)}',
  'onChange={(e) => setCustomerDetails(e.target.value, customerPhone)}'
);
content = content.replace(
  'onChange={(e) => setCustomerPhone(e.target.value)}',
  'onChange={(e) => setCustomerDetails(customerName, e.target.value)}'
);

fs.writeFileSync(posPath, content);
console.log("Refactoring complete");
