import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PrinterState {
  autoPrintEnabled: boolean;
  preferredPrinterId: string;
  preferredPrinterName: string;
  paperWidth: 58 | 80;
  printCopies: number;
  cutAfterPrint: boolean;
  setAutoPrintEnabled: (enabled: boolean) => void;
  setPaperWidth: (width: 58 | 80) => void;
  setPrintCopies: (copies: number) => void;
  setCutAfterPrint: (enabled: boolean) => void;
  rememberPrinter: (printer: { id?: string; name?: string }) => void;
  clearPrinter: () => void;
}

export const usePrinterStore = create<PrinterState>()(
  persist(
    set => ({
      autoPrintEnabled: false,
      preferredPrinterId: "",
      preferredPrinterName: "",
      paperWidth: 58,
      printCopies: 1,
      cutAfterPrint: false,
      setAutoPrintEnabled: autoPrintEnabled => set({ autoPrintEnabled }),
      setPaperWidth: paperWidth => set({ paperWidth }),
      setPrintCopies: printCopies =>
        set({
          printCopies: Math.min(3, Math.max(1, Math.round(printCopies || 1))),
        }),
      setCutAfterPrint: cutAfterPrint => set({ cutAfterPrint }),
      rememberPrinter: ({ id = "", name = "" }) =>
        set({
          preferredPrinterId: id,
          preferredPrinterName: name,
        }),
      clearPrinter: () =>
        set({
          preferredPrinterId: "",
          preferredPrinterName: "",
        }),
    }),
    {
      name: "pos-printer-settings",
    }
  )
);
