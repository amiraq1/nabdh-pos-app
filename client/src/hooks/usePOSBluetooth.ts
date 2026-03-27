import { useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  BluetoothPrinterError,
  thermalPrinter,
  type PrintableInvoice,
  type PrinterDevice,
  type PrinterStatus,
} from "@/lib/bluetooth";
import { usePrinterStore } from "@/stores/printerStore";

function getPrinterErrorDetails(error: unknown) {
  if (error instanceof BluetoothPrinterError) {
    return {
      code: error.code,
      message: error.message,
    };
  }

  if (error && typeof error === "object") {
    const maybeError = error as { code?: string; message?: string };
    return {
      code: maybeError.code,
      message: maybeError.message || "حدث خطأ غير متوقع",
    };
  }

  return {
    code: undefined,
    message: "حدث خطأ غير متوقع",
  };
}

const DEFAULT_PRINTER_STATUS: PrinterStatus = {
  supported: false,
  connected: false,
  enabled: false,
  printerId: "",
  printerName: "",
  mode: "unsupported",
  permission: "unknown",
};

export function usePOSBluetooth({
  completedInvoice,
}: {
  completedInvoice: PrintableInvoice | null;
}) {
  const {
    autoPrintEnabled,
    preferredPrinterId,
    preferredPrinterName,
    paperWidth,
    printCopies,
    cutAfterPrint,
    setAutoPrintEnabled,
    setPaperWidth,
    setPrintCopies,
    setCutAfterPrint,
    rememberPrinter,
    clearPrinter,
  } = usePrinterStore();

  const [printerStatus, setPrinterStatus] = useState<PrinterStatus>(DEFAULT_PRINTER_STATUS);
  const [knownPrinters, setKnownPrinters] = useState<PrinterDevice[]>([]);
  const [isRefreshingPrinters, setIsRefreshingPrinters] = useState(false);
  const [isConnectingPrinter, setIsConnectingPrinter] = useState(false);
  const [isPrintingReceipt, setIsPrintingReceipt] = useState(false);
  
  // Note 2: Guard against parallel operations
  const pendingJobRef = useRef<string | null>(null);

  const syncPrinterSnapshot = useCallback(
    async (requestPermissions = false) => {
      const [status, printers] = await Promise.all([
        thermalPrinter.getStatus(),
        thermalPrinter.listAvailablePrinters({ requestPermissions }),
      ]);

      setPrinterStatus(status);
      setKnownPrinters(printers);

      if (status.printerId || status.printerName) {
        rememberPrinter({
          id: status.printerId,
          name: status.printerName,
        });
      }
    },
    [rememberPrinter]
  );

  const refreshPrinterCenter = useCallback(
    async (requestPermissions = false) => {
      setIsRefreshingPrinters(true);

      try {
        await syncPrinterSnapshot(requestPermissions);
      } catch (error) {
        console.error("Printer refresh error:", error);
        toast.error("تعذر تحديث حالة الطابعة الآن");
      } finally {
        setIsRefreshingPrinters(false);
      }
    },
    [syncPrinterSnapshot]
  );

  const handleConnectPrinter = useCallback(
    async (printer?: PrinterDevice) => {
      setIsConnectingPrinter(true);
      toast.loading("جارِ تجهيز اتصال الطابعة", { id: "bt-connect" });

      try {
        let targetPrinter = printer;

        if (!targetPrinter && preferredPrinterId) {
          targetPrinter = {
            id: preferredPrinterId,
            name: preferredPrinterName || "الطابعة المحفوظة",
          };
        }

        if (!targetPrinter && printerStatus.mode === "native") {
          const devices = await thermalPrinter.listAvailablePrinters({ requestPermissions: true });
          setKnownPrinters(devices);

          if (devices.length === 1) {
            targetPrinter = devices[0];
          } else if (devices.length > 1) {
            throw new BluetoothPrinterError("اختر الطابعة المطلوبة من القائمة بالأسفل", "selection_required");
          } else {
            throw new BluetoothPrinterError(
              "اقترن بالطابعة من إعدادات البلوتوث أولاً ثم حدّث القائمة",
              "printer_not_found"
            );
          }
        }

        const result = await thermalPrinter.connect({
          printerId: targetPrinter?.id,
          printerName: targetPrinter?.name,
          preferPaired: Boolean(targetPrinter || preferredPrinterId || preferredPrinterName),
          requestDevice: printerStatus.mode !== "native",
        });

        rememberPrinter({
          id: result.printerId,
          name: result.printerName,
        });

        await syncPrinterSnapshot(true);
        toast.success(`تم الاتصال بـ ${result.printerName || "الطابعة"}`, {
          id: "bt-connect",
        });
      } catch (error: unknown) {
        const connectionError = getPrinterErrorDetails(error);

        if (connectionError.code === "cancelled") {
          toast.info(connectionError.message, { id: "bt-connect" });
        } else {
          toast.error(connectionError.message, {
            id: "bt-connect",
          });
        }
      } finally {
        setIsConnectingPrinter(false);
        pendingJobRef.current = null;
      }
    },
    [
      preferredPrinterId,
      preferredPrinterName,
      printerStatus.mode,
      rememberPrinter,
      syncPrinterSnapshot,
    ]
  );

  const handleDisconnectPrinter = useCallback(async () => {
    try {
      await thermalPrinter.disconnect();
      await syncPrinterSnapshot(false);
      toast.success("تم قطع الاتصال بالطابعة");
    } catch (error) {
      console.error("Printer disconnect error:", error);
      toast.error("تعذر قطع الاتصال بالطابعة");
    }
  }, [syncPrinterSnapshot]);

  const handleForgetPrinter = useCallback(async () => {
    clearPrinter();

    try {
      await thermalPrinter.disconnect();
      await syncPrinterSnapshot(false);
    } catch (error) {
      console.error("Forget printer error:", error);
    }

    toast.success("تم مسح الطابعة المحفوظة");
  }, [clearPrinter, syncPrinterSnapshot]);

  const handleBluetoothPrint = useCallback(
    async (options: { silent?: boolean; invoice?: PrintableInvoice | null } = {}) => {
      const invoiceToPrint = options.invoice ?? completedInvoice;

      if (!invoiceToPrint) {
        return;
      }

      const toastId = options.silent ? `bt-auto-${invoiceToPrint.invoiceNumber}` : "bt-print";

      if (!options.silent) {
        toast.loading("جارِ الإرسال إلى الطابعة", { id: toastId });
      }

      setIsPrintingReceipt(true);

      try {
        const result = await thermalPrinter.printRasterReceipt(invoiceToPrint, {
          silent: options.silent,
          printerId: preferredPrinterId || undefined,
          printerName: preferredPrinterName || undefined,
          paperWidth,
          copies: printCopies,
          cutAfterPrint,
        });

        rememberPrinter({
          id: result.printerId,
          name: result.printerName,
        });

        await syncPrinterSnapshot(false);
        
        // Note 3: Respect silent mode for successes
        if (!options.silent) {
          toast.success("تم إرسال الإيصال للطابعة", { id: toastId });
        } else {
          toast.dismiss(toastId);
        }
      } catch (error: unknown) {
        const printError = getPrinterErrorDetails(error);

        if (printError.code === "cancelled") {
          if (!options.silent) {
            toast.info(printError.message, { id: toastId });
          }
          return;
        }

        toast.error(printError.message, { id: toastId });
      } finally {
        setIsPrintingReceipt(false);
        pendingJobRef.current = null;
      }
    },
    [
      cutAfterPrint,
      completedInvoice,
      paperWidth,
      preferredPrinterId,
      preferredPrinterName,
      printCopies,
      rememberPrinter,
      syncPrinterSnapshot,
    ]
  );

  const handleTestPrint = useCallback(async () => {
    toast.loading("جارِ إرسال صفحة الاختبار", { id: "bt-test" });
    setIsPrintingReceipt(true);

    try {
      const result = await thermalPrinter.printTestReceipt({
        printerId: preferredPrinterId || undefined,
        printerName: preferredPrinterName || undefined,
        paperWidth,
        copies: printCopies,
        cutAfterPrint,
      });

      rememberPrinter({
        id: result.printerId,
        name: result.printerName,
      });

      await syncPrinterSnapshot(false);
      toast.success("تمت طباعة صفحة الاختبار", { id: "bt-test" });
    } catch (error: unknown) {
      const printError = error as { message?: string };
      toast.error(printError.message || "تعذر تنفيذ الطباعة التجريبية", {
        id: "bt-test",
      });
    } finally {
      setIsPrintingReceipt(false);
    }
  }, [
    cutAfterPrint,
    paperWidth,
    preferredPrinterId,
    preferredPrinterName,
    printCopies,
    rememberPrinter,
    syncPrinterSnapshot,
  ]);

  return {
    printerState: {
      printerStatus,
      knownPrinters,
      isRefreshingPrinters,
      isConnectingPrinter,
      isPrintingReceipt,
      autoPrintEnabled,
      preferredPrinterId,
      preferredPrinterName,
      paperWidth,
      printCopies,
      cutAfterPrint,
    },
    printerSetters: {
      setAutoPrintEnabled,
      setPaperWidth,
      setPrintCopies,
      setCutAfterPrint,
    },
    printerActions: {
      syncPrinterSnapshot,
      refreshPrinterCenter,
      handleConnectPrinter,
      handleDisconnectPrinter,
      handleForgetPrinter,
      handleBluetoothPrint,
      handleTestPrint,
    },
  };
}
