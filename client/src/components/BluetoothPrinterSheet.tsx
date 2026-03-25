import {
  Bluetooth,
  CheckCircle2,
  Loader2,
  Minus,
  Plus,
  Printer,
  ReceiptText,
  RefreshCw,
  Trash2,
  Unplug,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { formatCurrency } from "@/lib/utils";
import type {
  PrintableInvoice,
  PrinterDevice,
  PrinterPaperWidth,
  PrinterStatus,
} from "@/lib/bluetooth";

interface BluetoothPrinterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: PrinterStatus;
  printers: PrinterDevice[];
  preferredPrinterId: string;
  preferredPrinterName: string;
  autoPrintEnabled: boolean;
  paperWidth: PrinterPaperWidth;
  printCopies: number;
  cutAfterPrint: boolean;
  previewInvoice: PrintableInvoice | null;
  previewTitle: string;
  previewDescription: string;
  isRefreshing: boolean;
  isConnecting: boolean;
  isPrinting: boolean;
  hasInvoice: boolean;
  onRefresh: () => void;
  onConnect: (printer?: PrinterDevice) => void;
  onDisconnect: () => void;
  onPrintTest: () => void;
  onPrintCurrent: () => void;
  onAutoPrintChange: (enabled: boolean) => void;
  onPaperWidthChange: (width: PrinterPaperWidth) => void;
  onPrintCopiesChange: (copies: number) => void;
  onCutAfterPrintChange: (enabled: boolean) => void;
  onForgetPrinter: () => void;
}

const statusConfig: Record<PrinterStatus["mode"], { label: string; description: string }> = {
  native: {
    label: "اتصال أصلي",
    description: "Android يطبع عبر البلوتوث الكلاسيكي مباشرة دون الاعتماد على المتصفح.",
  },
  web: {
    label: "Web Bluetooth",
    description: "المتصفح أو PWA يستخدم القنوات التي يوفّرها Web Bluetooth.",
  },
  unsupported: {
    label: "غير مدعوم",
    description: "هذا الجهاز لا يوفّر مسار طباعة بلوتوث متاحًا.",
  },
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "نقداً",
  card: "بطاقة ائتمان",
  transfer: "تحويل بنكي",
};

function getStatusBadge(status: PrinterStatus) {
  if (!status.supported) {
    return {
      label: "غير مدعوم",
      className: "border-destructive/20 bg-destructive/10 text-destructive",
    };
  }

  if (status.permission !== "granted") {
    return {
      label: "بحاجة إلى إذن",
      className: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    };
  }

  if (!status.enabled) {
    return {
      label: "البلوتوث مغلق",
      className: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    };
  }

  if (status.connected) {
    return {
      label: "متصل",
      className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    };
  }

  return {
    label: "غير متصل",
    className: "border-border/60 bg-muted/50 text-muted-foreground",
  };
}

export default function BluetoothPrinterSheet({
  open,
  onOpenChange,
  status,
  printers,
  preferredPrinterId,
  preferredPrinterName,
  autoPrintEnabled,
  paperWidth,
  printCopies,
  cutAfterPrint,
  previewInvoice,
  previewTitle,
  previewDescription,
  isRefreshing,
  isConnecting,
  isPrinting,
  hasInvoice,
  onRefresh,
  onConnect,
  onDisconnect,
  onPrintTest,
  onPrintCurrent,
  onAutoPrintChange,
  onPaperWidthChange,
  onPrintCopiesChange,
  onCutAfterPrintChange,
  onForgetPrinter,
}: BluetoothPrinterSheetProps) {
  const badge = getStatusBadge(status);
  const modeInfo = statusConfig[status.mode];
  const primaryActionLabel = status.connected
    ? "تبديل الطابعة"
    : preferredPrinterId || preferredPrinterName
      ? "إعادة الاتصال"
      : "اختيار طابعة";
  const previewWidthClass = paperWidth === 80 ? "max-w-[360px]" : "max-w-[270px]";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[88vh] rounded-t-[32px] border-border/40 bg-background/95 px-0 backdrop-blur-xl"
      >
        <SheetHeader className="space-y-3 border-b border-border/40 px-6 pb-5 pt-6 text-right">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <SheetTitle className="font-display text-2xl font-bold">
                مركز طباعة البلوتوث
              </SheetTitle>
              <SheetDescription className="max-w-sm text-sm leading-6">
                تحكم بالطابعة والإيصال من نفس المكان: الاتصال، الإعدادات، الطباعة التجريبية،
                والطباعة التلقائية بعد البيع.
              </SheetDescription>
            </div>
            <Badge variant="outline" className={badge.className}>
              {badge.label}
            </Badge>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(88vh-112px)] px-6 pb-8">
          <div className="space-y-5 py-6">
            <section className="rounded-[28px] border border-border/40 bg-card/80 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Bluetooth className="h-4 w-4" />
                    <span>{modeInfo.label}</span>
                  </div>
                  <p className="font-display text-lg font-semibold text-foreground">
                    {status.printerName || preferredPrinterName || "لم يتم اختيار طابعة بعد"}
                  </p>
                  <p className="text-sm leading-6 text-muted-foreground">{modeInfo.description}</p>
                </div>
                {status.connected ? (
                  <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-600">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                ) : (
                  <div className="rounded-2xl bg-muted/70 p-3 text-muted-foreground">
                    <Printer className="h-5 w-5" />
                  </div>
                )}
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 rounded-2xl"
                  onClick={onRefresh}
                  disabled={isRefreshing || isConnecting || isPrinting}
                >
                  {isRefreshing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  تحديث
                </Button>
                <Button
                  type="button"
                  className="h-12 rounded-2xl"
                  onClick={() => onConnect()}
                  disabled={!status.supported || isConnecting || isPrinting}
                >
                  {isConnecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Bluetooth className="h-4 w-4" />
                  )}
                  {primaryActionLabel}
                </Button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 rounded-2xl"
                  onClick={onPrintTest}
                  disabled={!status.supported || isConnecting || isPrinting}
                >
                  {isPrinting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ReceiptText className="h-4 w-4" />
                  )}
                  طباعة تجريبية
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 rounded-2xl"
                  onClick={onDisconnect}
                  disabled={!status.connected || isConnecting || isPrinting}
                >
                  <Unplug className="h-4 w-4" />
                  قطع الاتصال
                </Button>
              </div>

              {hasInvoice && (
                <Button
                  type="button"
                  className="mt-3 h-12 w-full rounded-2xl"
                  onClick={onPrintCurrent}
                  disabled={!status.supported || isConnecting || isPrinting}
                >
                  {isPrinting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Printer className="h-4 w-4" />
                  )}
                  طباعة الفاتورة الحالية
                </Button>
              )}
            </section>

            <section className="rounded-[28px] border border-border/40 bg-card/80 p-5 shadow-sm">
              <div className="space-y-1">
                <p className="font-display text-lg font-semibold text-foreground">معاينة الإيصال</p>
                <p className="text-sm leading-6 text-muted-foreground">
                  {previewDescription}
                </p>
              </div>

              {previewInvoice ? (
                <div className="mt-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="rounded-full px-3 py-1">
                      {previewTitle}
                    </Badge>
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{paperWidth}mm</span>
                      <span>•</span>
                      <span>{printCopies} نسخة</span>
                      <span>•</span>
                      <span>{cutAfterPrint ? "مع قص" : "بدون قص"}</span>
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-border/40 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(247,247,247,0.92))] p-4 shadow-inner">
                    <div className={`mx-auto rounded-[20px] border border-black/10 bg-white px-4 py-5 text-black shadow-sm ${previewWidthClass}`}>
                      <div className="border-b border-dashed border-black/15 pb-3 text-center">
                        <p className="font-display text-lg font-black tracking-tight">جوهرة العرب</p>
                        <p className="mt-1 text-[10px] text-black/55">{previewInvoice.invoiceNumber}</p>
                      </div>

                      <div className="mt-3 space-y-1 text-[11px] leading-5 text-black/70">
                        <div className="flex items-center justify-between gap-3">
                          <span>العميل</span>
                          <span>{previewInvoice.customerName || "عميل عام"}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>الدفع</span>
                          <span>
                            {PAYMENT_METHOD_LABELS[previewInvoice.paymentMethod || ""] ||
                              previewInvoice.paymentMethod ||
                              "نقداً"}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 space-y-2 border-y border-dashed border-black/10 py-3">
                        {previewInvoice.cartItems.slice(0, 4).map((item, index) => (
                          <div
                            key={`${item.name}-${index}`}
                            className="flex items-start justify-between gap-3 text-[11px]"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold">{item.name}</p>
                              <p className="text-[10px] text-black/55">
                                {item.quantity} × {formatCurrency(item.price)}
                              </p>
                            </div>
                            <span className="shrink-0 font-semibold">
                              {formatCurrency(item.subtotal)}
                            </span>
                          </div>
                        ))}

                        {previewInvoice.cartItems.length > 4 && (
                          <p className="text-center text-[10px] text-black/45">
                            +{previewInvoice.cartItems.length - 4} أصناف إضافية
                          </p>
                        )}
                      </div>

                      <div className="mt-3 space-y-1 text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="text-black/60">المجموع</span>
                          <span>{formatCurrency(previewInvoice.subtotal ?? previewInvoice.total)}</span>
                        </div>
                        {(previewInvoice.discountAmount || 0) > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-black/60">الخصم</span>
                            <span>-{formatCurrency(previewInvoice.discountAmount || 0)}</span>
                          </div>
                        )}
                        <div className="mt-2 flex items-center justify-between border-t border-black/10 pt-2 text-base font-black">
                          <span>الصافي</span>
                          <span>{formatCurrency(previewInvoice.total)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-border/50 bg-muted/30 p-5 text-sm leading-6 text-muted-foreground">
                  أضف عناصر إلى السلة أو أكمل عملية بيع واحدة على الأقل لتظهر المعاينة هنا.
                </div>
              )}
            </section>

            <section className="rounded-[28px] border border-border/40 bg-card/80 p-5 shadow-sm">
              <div className="space-y-1">
                <p className="font-display text-lg font-semibold text-foreground">إعدادات الإيصال</p>
                <p className="text-sm leading-6 text-muted-foreground">
                  هذه الإعدادات محفوظة وتُستخدم في الطباعة اليدوية والتلقائية معًا.
                </p>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">عرض الورق</p>
                  <Select
                    value={paperWidth.toString()}
                    onValueChange={value => onPaperWidthChange((value === "80" ? 80 : 58) as PrinterPaperWidth)}
                  >
                    <SelectTrigger className="h-12 rounded-2xl border-border/50 bg-background/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      <SelectItem value="58">58mm</SelectItem>
                      <SelectItem value="80">80mm</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">عدد النسخ</p>
                  <div className="flex h-12 items-center justify-between rounded-2xl border border-border/50 bg-background/50 px-3">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 rounded-xl"
                      onClick={() => onPrintCopiesChange(printCopies - 1)}
                      disabled={printCopies <= 1}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="font-display text-lg font-semibold text-foreground">{printCopies}</span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 rounded-xl"
                      onClick={() => onPrintCopiesChange(printCopies + 1)}
                      disabled={printCopies >= 3}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <Separator className="my-5" />

              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">قص الإيصال بعد الطباعة</p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    عطّله إذا كانت الطابعة المحمولة لا تدعم القاطع التلقائي أو كانت تتجاهله.
                  </p>
                </div>
                <Switch checked={cutAfterPrint} onCheckedChange={onCutAfterPrintChange} />
              </div>
            </section>

            <section className="rounded-[28px] border border-border/40 bg-card/80 p-5 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="font-display text-lg font-semibold text-foreground">الطباعة التلقائية</p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    إذا كانت الطابعة محفوظة فسيتم إرسال الإيصال مباشرة بعد إنهاء البيع.
                  </p>
                </div>
                <Switch checked={autoPrintEnabled} onCheckedChange={onAutoPrintChange} />
              </div>

              <Separator className="my-5" />

              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">الطابعة المحفوظة</p>
                  <p className="text-sm text-muted-foreground">
                    {preferredPrinterName || "لا توجد طابعة محفوظة"}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-10 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={onForgetPrinter}
                  disabled={!preferredPrinterId && !preferredPrinterName}
                >
                  <Trash2 className="h-4 w-4" />
                  مسح الحفظ
                </Button>
              </div>
            </section>

            <section className="rounded-[28px] border border-border/40 bg-card/80 p-5 shadow-sm">
              <div className="space-y-1">
                <p className="font-display text-lg font-semibold text-foreground">الأجهزة المتاحة</p>
                <p className="text-sm leading-6 text-muted-foreground">
                  على Android تظهر الأجهزة المقترنة مسبقًا. إذا لم تظهر الطابعة، اقترن بها من
                  إعدادات البلوتوث أولًا ثم عد إلى هنا واضغط تحديث.
                </p>
              </div>

              <div className="mt-4 space-y-3">
                {printers.length > 0 ? (
                  printers.map(printer => {
                    const isConnected = status.connected && status.printerId === printer.id;
                    const isPreferred =
                      preferredPrinterId === printer.id || preferredPrinterName === printer.name;

                    return (
                      <button
                        key={printer.id}
                        type="button"
                        className="w-full rounded-2xl border border-border/40 bg-background/70 p-4 text-right transition-colors hover:border-primary/40 hover:bg-primary/5"
                        onClick={() => onConnect(printer)}
                        disabled={isConnecting || isPrinting}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <p className="font-medium text-foreground">{printer.name}</p>
                            <p className="font-mono text-xs text-muted-foreground">{printer.id}</p>
                          </div>
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {isConnected && <Badge className="bg-emerald-600 text-white">متصل</Badge>}
                            {isPreferred && (
                              <Badge
                                variant="outline"
                                className="border-primary/30 bg-primary/10 text-primary"
                              >
                                محفوظ
                              </Badge>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/50 bg-muted/30 p-5 text-sm leading-6 text-muted-foreground">
                    لا توجد طابعات معروفة بعد. جرّب زر اختيار طابعة أولًا، أو اقترن بالطابعة من
                    إعدادات البلوتوث ثم عد إلى هنا.
                  </div>
                )}
              </div>
            </section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
