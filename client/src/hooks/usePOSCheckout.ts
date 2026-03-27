import { trpc } from "@/lib/trpc";
import { enqueueOfflineJob } from "@/lib/offline-queue";
import { toast } from "sonner";
import { type PrintableInvoice } from "@/lib/bluetooth";

export interface POSCartItem {
  productId: number;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
}

interface UsePOSCheckoutOptions {
  cart: POSCartItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  paymentMethod: string;
  customerName: string;
  customerPhone: string;
  lastAutoPrintedInvoice: MutableRefObject<string | null>;
  setCompletedInvoice: (invoice: PrintableInvoice | null) => void;
  clearCart: () => void;
  setCustomerDetails: (name: string, phone: string) => void;
  setDiscount: (discount: number) => void;
}

export function usePOSCheckout({
  cart,
  subtotal,
  taxAmount,
  discountAmount,
  total,
  paymentMethod,
  customerName,
  customerPhone,
  lastAutoPrintedInvoice,
  setCompletedInvoice,
  clearCart,
  setCustomerDetails,
  setDiscount,
}: UsePOSCheckoutOptions) {
  const [isProcessing, setIsProcessing] = useState(false);
  const utils = trpc.useUtils();
  const checkoutMutation = trpc.sales.checkout.useMutation();

  const handleCheckout = async () => {
    if (cart.length === 0) {
      return;
    }

    setIsProcessing(true);

    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
    const checkoutPayload = {
      invoiceNumber,
      totalAmount: subtotal.toString(),
      taxAmount: taxAmount.toString(),
      discountAmount: discountAmount.toString(),
      finalAmount: total.toString(),
      paymentMethod,
      customerName: customerName || "عميل عام",
      customerPhone,
      notes: "",
      items: cart.map((item: POSCartItem) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.price.toString(),
        subtotal: item.subtotal.toString(),
      })),
    };

    const updateUIStateAfterSale = (isOffline = false) => {
      lastAutoPrintedInvoice.current = null;
      setCompletedInvoice({
        invoiceNumber,
        cartItems: [...cart],
        total,
        discountAmount,
        subtotal,
        paymentMethod,
        customerName: customerName || "عميل عام",
        customerPhone,
        createdAt: new Date().toISOString(),
        status: isOffline ? "pending_sync" : "synced"
      } as any);

      clearCart();
      setCustomerDetails("", "");
      setDiscount(0);
    };

    try {
      // Try server-side checkout first
      const sale = await checkoutMutation.mutateAsync(checkoutPayload);
      void utils.products.list.invalidate();

      toast.success("تم إتمام دورة البيع بنجاح", {
        className: "font-display bg-primary text-primary-foreground border-primary",
      });

      updateUIStateAfterSale(sale);
    } catch (error: any) {
      // Check if it's a network error → save offline
      const isNetworkError =
        !navigator.onLine ||
        /fetch failed|NetworkError|ERR_CONNECTION|ERR_NETWORK|API_REQUEST_TIMEOUT|Failed to fetch/i.test(
          error?.message || ""
        );

      if (isNetworkError) {
        try {
          // Log to the robust IndexedDB Queue
          await enqueueOfflineJob({
            id: invoiceNumber, // Idempotency
            type: "checkout",
            payload: checkoutPayload
          });

          toast.success("تم حفظ العملية محلياً — ستتم المزامنة عند عودة الاتصال", {
            className: "font-display bg-amber-500 text-white border-amber-600",
            duration: 4000,
          });

          updateUIStateAfterSale(true);
        } catch (offlineError) {
          toast.error("تعذر حفظ العملية. يرجى المحاولة مرة أخرى.");
          console.error("Offline checkout error:", offlineError);
        }
      } else {
        toast.error("تعذر إتمام العملية، يرجى المحاولة مرة أخرى.");
        console.error("Checkout error:", error);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    isProcessing,
    handleCheckout,
  };
}
