import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Printer,
  CheckCircle2,
} from "lucide-react";
import { ReceiptView } from "./ReceiptView";
import { formatCurrency } from "@/lib/utils";
import { type PrintableInvoice } from "@/lib/bluetooth";

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  completedInvoice: PrintableInvoice | null;
  isProcessing: boolean;
  isPrintingReceipt: boolean;
  subtotal: number;
  total: number;
  discount: number;
  discountType: "percent" | "amount";
  paymentMethod: string;
  customerName: string;
  customerPhone: string;
  setCustomerDetails: (name: string, phone: string) => void;
  setDiscount: (val: number) => void;
  setDiscountType: (type: "percent" | "amount") => void;
  setPaymentMethod: (method: string) => void;
  handleCheckout: () => void;
  handleBluetoothPrint: () => void;
  handleStartNewSale: () => void;
  setShowPrinterSheet: (show: boolean) => void;
}

export function CheckoutDialog({
  open,
  onOpenChange,
  completedInvoice,
  isProcessing,
  isPrintingReceipt,
  total,
  discount,
  discountType,
  paymentMethod,
  customerName,
  customerPhone,
  setCustomerDetails,
  setDiscount,
  setDiscountType,
  setPaymentMethod,
  handleCheckout,
  handleBluetoothPrint,
  handleStartNewSale,
  setShowPrinterSheet,
}: CheckoutDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="glass-panel max-w-md overflow-hidden rounded-[32px] border-0 p-0 sm:max-w-lg"
      >
        {completedInvoice ? (
          <div className="space-y-8 p-8">
            <div className="no-print space-y-3 text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
              </div>
              <h2 className="text-3xl font-bold text-foreground font-display">عملية ناجحة</h2>
              <p className="font-mono text-muted-foreground">{completedInvoice.invoiceNumber}</p>
            </div>

            <ReceiptView invoice={completedInvoice} />

            <div className="no-print flex flex-col gap-3">
              <Button
                className="h-14 w-full gap-2 rounded-2xl text-lg font-display"
                onClick={handleBluetoothPrint}
                disabled={isPrintingReceipt}
              >
                {isPrintingReceipt ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Printer className="h-5 w-5" />
                )}
                طباعة الإيصال
              </Button>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="h-12 rounded-xl"
                  onClick={() => setShowPrinterSheet(true)}
                >
                  إعدادات الطابعة
                </Button>
                <Button
                  variant="outline"
                  className="h-12 rounded-xl"
                  onClick={() => window.print()}
                >
                  PDF / سلكية
                </Button>
              </div>
              <Button
                variant="secondary"
                className="h-12 rounded-xl"
                onClick={handleStartNewSale}
              >
                عملية جديدة
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-8">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-2xl font-bold font-display text-right">ملخص الدفع</DialogTitle>
              <DialogDescription className="text-right">استكمال بيانات المبيعات الحالية</DialogDescription>
            </DialogHeader>
            <div className="space-y-5">
              <div className="space-y-4">
                <Input
                  value={customerName}
                  onChange={event => setCustomerDetails(event.target.value, customerPhone)}
                  placeholder="اسم العميل (اختياري)"
                  className="h-12 rounded-xl border-border/50 bg-background/50 text-right"
                />

                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Input
                      type="number"
                      min="0"
                      max={discountType === "percent" ? "100" : undefined}
                      inputMode="decimal"
                      value={discount === 0 ? "" : discount}
                      onChange={event => {
                        const val = parseFloat(event.target.value) || 0;
                        if (discountType === "percent") {
                          setDiscount(Math.min(100, Math.max(0, val)));
                        } else {
                          setDiscount(Math.max(0, val));
                        }
                      }}
                      placeholder={`الخصم (${discountType === "percent" ? "%" : "د.ع"})`}
                      className="h-12 rounded-xl border-border/50 bg-background/50 text-right"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setDiscountType(discountType === "percent" ? "amount" : "percent")
                    }
                    className="h-12 w-12 rounded-xl text-lg font-bold font-display"
                  >
                    {discountType === "percent" ? "%" : "$"}
                  </Button>
                </div>

                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="h-12 rounded-xl border-border/50 bg-background/50 flex-row-reverse">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="cash" className="text-right">نقداً</SelectItem>
                    <SelectItem value="card" className="text-right">بطاقة ائتمان</SelectItem>
                    <SelectItem value="transfer" className="text-right">تحويل بنكي</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/10 p-5">
                <span className="font-medium text-foreground font-display">الإجمالي المستحق</span>
                <span className="text-2xl font-black text-primary font-display">{formatCurrency(total)}</span>
              </div>

              <Button
                className="h-14 w-full rounded-xl text-lg font-bold shadow-lg shadow-primary/25 font-display"
                onClick={handleCheckout}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  "تأكيد واستلام المبلغ"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
