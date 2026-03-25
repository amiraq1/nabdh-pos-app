import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  productId: number;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
}

interface CartState {
  cart: CartItem[];
  discount: number;
  discountType: "percent" | "amount";
  customerName: string;
  customerPhone: string;
  paymentMethod: string;

  // Actions
  addItem: (product: any, maxQuantity: number) => { success: boolean, message: string };
  updateQuantity: (productId: number, newQuantity: number, maxQuantity: number) => boolean;
  removeItem: (productId: number) => void;
  setDiscount: (discount: number) => void;
  setDiscountType: (type: "percent" | "amount") => void;
  setCustomerDetails: (name: string, phone: string) => void;
  setPaymentMethod: (method: string) => void;
  clearCart: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      cart: [],
      discount: 0,
      discountType: "percent",
      customerName: "",
      customerPhone: "",
      paymentMethod: "cash",

      addItem: (product, maxQuantity) => {
        const { cart } = get();
        if (maxQuantity <= 0) return { success: false, message: "نفدت الكمية من المخزون" };

        const existingItem = cart.find((item) => item.productId === product.id);
        
        if (existingItem) {
          if (existingItem.quantity >= maxQuantity) {
             return { success: false, message: "بلغت الحد الأقصى المتوفر في المخزون" };
          }
          set({
            cart: cart.map((item) =>
              item.productId === product.id
                ? {
                    ...item,
                    quantity: item.quantity + 1,
                    subtotal: (item.quantity + 1) * item.price,
                  }
                : item
            ),
          });
          return { success: true, message: `تمت إضافة ${product.name}` };
        }

        set({
          cart: [
            ...cart,
            {
              productId: product.id,
              name: product.name,
              price: parseFloat(product.price),
              quantity: 1,
              subtotal: parseFloat(product.price),
            },
          ],
        });
        return { success: true, message: `تمت إضافة ${product.name}` };
      },

      updateQuantity: (productId, newQuantity, maxQuantity) => {
        if (newQuantity <= 0) {
          get().removeItem(productId);
          return true;
        }
        if (newQuantity > maxQuantity) return false;

        set((state) => ({
          cart: state.cart.map((item) =>
            item.productId === productId
              ? { ...item, quantity: newQuantity, subtotal: newQuantity * item.price }
              : item
          ),
        }));
        return true;
      },

      removeItem: (productId) =>
        set((state) => ({
          cart: state.cart.filter((item) => item.productId !== productId),
        })),

      setDiscount: (discount) => set({ discount }),
      setDiscountType: (discountType) => set({ discountType }),
      setCustomerDetails: (customerName, customerPhone) => set({ customerName, customerPhone }),
      setPaymentMethod: (paymentMethod) => set({ paymentMethod }),

      clearCart: () =>
        set({
          cart: [],
          discount: 0,
          discountType: "percent",
          customerName: "",
          customerPhone: "",
          paymentMethod: "cash",
        }),
    }),
    {
      name: "pos-cart-storage", // localStorage key
    }
  )
);
