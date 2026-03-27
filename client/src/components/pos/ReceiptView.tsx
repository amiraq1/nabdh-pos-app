import { Barcode, CloudOff, Check } from "lucide-react";
import { type PrintableInvoice } from "@/lib/bluetooth";
import { formatCurrency } from "@/lib/utils";
import { RETURN_POLICIES, STORE_BRANCHES, STORE_NAME } from "@/lib/invoice";

interface ReceiptViewProps {
  invoice: PrintableInvoice;
}

export function ReceiptView({ invoice }: ReceiptViewProps) {
  return (
    <div className="mx-auto max-w-[320px] rounded-2xl bg-white p-6 text-black shadow-inner print:shadow-none print:p-0">
      <div className="mb-6 border-b-2 border-dashed border-gray-200 pb-4 text-center">
        <h3 className="text-2xl font-black tracking-tight font-display">{STORE_NAME}</h3>
        <p className="mt-2 text-[11px] font-semibold text-gray-500">الفروع</p>
        <p className="mt-1 text-[11px] leading-5 text-gray-600">
          {STORE_BRANCHES.join("، ")}
        </p>
      </div>

      <div className="mb-4 flex flex-col items-center justify-between gap-1 border-b pb-4 font-mono text-[10px] text-gray-400 sm:flex-row print:flex-row">
        <div className="flex items-center gap-2">
          <span>{invoice.invoiceNumber}</span>
          <div className="no-print">
            {invoice.status === "pending_sync" ? (
              <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-sans font-bold text-amber-600">
                <CloudOff className="h-2.5 w-2.5" />
                معلقة
              </span>
            ) : invoice.status === "synced" ? (
              <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-sans font-bold text-emerald-600">
                <Check className="h-2.5 w-2.5" />
                مزامنة
              </span>
            ) : null}
          </div>
        </div>
        <span>
          {new Date(invoice.createdAt ?? Date.now()).toLocaleString("ar-SA", {
            dateStyle: "short",
            timeStyle: "short",
          })}
        </span>
      </div>

      <div className="mb-4 space-y-1 rounded-xl bg-gray-50 px-3 py-2 text-[11px] text-gray-500">
        <div className="flex justify-between gap-3">
          <span>العميل</span>
          <span>{invoice.customerName || "عميل عام"}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span>الدفع</span>
          <span>
            {invoice.paymentMethod === "cash"
              ? "نقداً"
              : invoice.paymentMethod === "card"
                ? "بطاقة ائتمان"
                : "تحويل بنكي"}
          </span>
        </div>
      </div>

      <div className="mb-6 space-y-3">
        {invoice.cartItems?.map((item, index) => (
          <div key={`${item.productId || item.name}-${index}`} className="flex items-start justify-between text-xs">
            <div className="flex flex-1 flex-col pr-4">
              <span className="font-bold">{item.name}</span>
              <span className="mt-0.5 text-[10px] text-gray-400">
                {item.quantity} × {formatCurrency(item.price)}
              </span>
            </div>
            <span className="pt-0.5 font-bold">{formatCurrency(item.subtotal)}</span>
          </div>
        ))}
      </div>

      <div className="space-y-2 border-t-2 border-gray-900 pt-3">
        <div className="flex justify-between text-xs text-gray-500">
          <span>المجموع</span>
          <span>{formatCurrency(invoice.subtotal ?? invoice.total)}</span>
        </div>
        {invoice.discountAmount && invoice.discountAmount > 0 && (
          <div className="flex justify-between text-xs text-gray-500">
            <span>الخصم</span>
            <span>-{formatCurrency(invoice.discountAmount)}</span>
          </div>
        )}
        <div className="mt-3 flex justify-between text-xl font-black">
          <span>الصافي</span>
          <span>{formatCurrency(invoice.total)}</span>
        </div>
      </div>

      <div className="mt-6 border-t border-dashed border-gray-300 pt-4 text-center">
        <p className="mb-2 text-[11px] font-bold text-gray-700">سياسة الإرجاع</p>
        <div className="space-y-1 text-[10px] leading-5 text-gray-600">
          {RETURN_POLICIES.map(policy => (
            <p key={policy}>{policy}</p>
          ))}
        </div>
      </div>

      <div className="mt-8 flex justify-center opacity-50 grayscale">
        <Barcode className="h-10 w-32" />
      </div>
    </div>
  );
}
