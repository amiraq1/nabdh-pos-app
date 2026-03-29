import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import {
  BarcodeFormat,
  BarcodeScanner as NativeBarcodeScanner,
  GoogleBarcodeScannerModuleInstallState,
} from "@capacitor-mlkit/barcode-scanning";
import { BrowserMultiFormatReader, Exception } from "@zxing/library";
import { Button } from "@/components/ui/button";
import { X, Camera, Volume2, VolumeX } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAudioAlert } from "@/hooks/useAudioAlert";

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose?: () => void;
  onBarcodeDetected: (barcode: string) => void | Promise<void>;
  soundEnabled?: boolean;
  variant?: "dialog" | "inline";
  className?: string;
}

const waitForNextFrame = () =>
  new Promise<void>(resolve => {
    requestAnimationFrame(() => resolve());
  });

const WEB_CAMERA_ATTEMPTS: MediaStreamConstraints[] = [
  {
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  },
  {
    video: {
      facingMode: { ideal: "environment" },
    },
  },
  {
    video: true,
  },
];

const NATIVE_SCAN_FORMATS = [
  BarcodeFormat.Code128,
  BarcodeFormat.Code39,
  BarcodeFormat.Code93,
  BarcodeFormat.Codabar,
  BarcodeFormat.Ean8,
  BarcodeFormat.Ean13,
  BarcodeFormat.Itf,
  BarcodeFormat.UpcA,
  BarcodeFormat.UpcE,
  BarcodeFormat.QrCode,
  BarcodeFormat.DataMatrix,
  BarcodeFormat.Pdf417,
  BarcodeFormat.Aztec,
];

const NATIVE_PLATFORM = Capacitor.getPlatform();
const USES_NATIVE_SCANNER =
  Capacitor.isNativePlatform() &&
  (NATIVE_PLATFORM === "android" || NATIVE_PLATFORM === "ios");

const isGrantedPermission = (state?: string) =>
  state === "granted" || state === "limited";

const decodeNativeBarcodeValue = (barcode: {
  rawValue?: string;
  displayValue?: string;
  bytes?: number[];
}) => {
  const preferredValue = barcode.rawValue?.trim() || barcode.displayValue?.trim();

  if (preferredValue) {
    return preferredValue;
  }

  if (barcode.bytes?.length) {
    try {
      return new TextDecoder("utf-8").decode(new Uint8Array(barcode.bytes)).trim();
    } catch (error) {
      console.warn("Failed to decode barcode bytes:", error);
    }
  }

  return "";
};

const getScanErrorMessage = (error: unknown) => {
  if (error instanceof DOMException) {
    switch (error.name) {
      case "NotAllowedError":
        return "تم رفض إذن استخدام الكاميرا";
      case "NotFoundError":
        return "لم يتم العثور على كاميرا متاحة";
      case "NotReadableError":
        return "الكاميرا مستخدمة من تطبيق آخر أو غير متاحة حاليًا";
      case "OverconstrainedError":
        return "تعذر تشغيل الكاميرا بالإعدادات الحالية";
      default:
        break;
    }
  }

  if (error instanceof Error) {
    const message = error.message.trim();

    if (!message) {
      return "فشل تشغيل الماسح";
    }

    if (/cancel/i.test(message)) {
      return "";
    }

    return message;
  }

  return "فشل تشغيل الماسح";
};

export default function BarcodeScanner({
  isOpen,
  onClose,
  onBarcodeDetected,
  soundEnabled = true,
  variant = "dialog",
  className,
}: BarcodeScannerProps) {
  const isInline = variant === "inline";
  const effectiveUsesNativeScanner = isInline ? false : USES_NATIVE_SCANNER;
  const videoRef = useRef<HTMLVideoElement>(null);
  const webReaderRef = useRef(new BrowserMultiFormatReader());
  const onCloseRef = useRef(onClose);
  const onBarcodeDetectedRef = useRef(onBarcodeDetected);
  const nativeScanInFlightRef = useRef(false);
  const nativeSessionRef = useRef(0);

  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState(
    effectiveUsesNativeScanner ? "تجهيز الماسح الأصلي..." : ""
  );
  const [isSoundEnabled, setIsSoundEnabled] = useState(soundEnabled);

  const { playScanBeep, playSuccessBeep, playErrorBeep } = useAudioAlert();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    onBarcodeDetectedRef.current = onBarcodeDetected;
  }, [onBarcodeDetected]);

  useEffect(() => {
    setIsSoundEnabled(soundEnabled);
  }, [soundEnabled]);

  const stopWebScanning = useCallback(() => {
    webReaderRef.current.reset();

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    setIsScanning(false);
  }, []);

  const closeScanner = useCallback(() => {
    stopWebScanning();
    onCloseRef.current?.();
  }, [stopWebScanning]);

  const ensureAndroidGoogleScanner = useCallback(async () => {
    if (NATIVE_PLATFORM !== "android") {
      return;
    }

    const { available } =
      await NativeBarcodeScanner.isGoogleBarcodeScannerModuleAvailable();

    if (available) {
      return;
    }

    setStatusMessage("جارٍ تنزيل ماسح Google لأول مرة...");

    await new Promise<void>(async (resolve, reject) => {
      let settled = false;
      let progressListener: PluginListenerHandle | null = null;

      const settle = (callback: () => void) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeoutId);
        void progressListener?.remove();
        callback();
      };

      const timeoutId = window.setTimeout(() => {
        settle(() => {
          reject(new Error("استغرق تجهيز ماسح Google وقتًا أطول من المتوقع"));
        });
      }, 60_000);

      progressListener = await NativeBarcodeScanner.addListener(
        "googleBarcodeScannerModuleInstallProgress",
        event => {
          switch (event.state) {
            case GoogleBarcodeScannerModuleInstallState.DOWNLOADING:
            case GoogleBarcodeScannerModuleInstallState.INSTALLING:
              setStatusMessage(
                typeof event.progress === "number"
                  ? `جارٍ تجهيز ماسح Google (${event.progress}%)`
                  : "جارٍ تجهيز ماسح Google..."
              );
              break;
            case GoogleBarcodeScannerModuleInstallState.COMPLETED:
              settle(resolve);
              break;
            case GoogleBarcodeScannerModuleInstallState.CANCELED:
              settle(() => {
                reject(new Error("تم إلغاء تنزيل ماسح Google"));
              });
              break;
            case GoogleBarcodeScannerModuleInstallState.FAILED:
              settle(() => {
                reject(new Error("فشل تنزيل ماسح Google"));
              });
              break;
            default:
              break;
          }
        }
      );

      try {
        await NativeBarcodeScanner.installGoogleBarcodeScannerModule();
      } catch (installError) {
        settle(() => {
          reject(installError);
        });
      }
    });
  }, []);

  const runNativeScan = useCallback(async () => {
    if (!effectiveUsesNativeScanner || nativeScanInFlightRef.current) {
      return;
    }

    nativeScanInFlightRef.current = true;
    const sessionId = nativeSessionRef.current + 1;
    nativeSessionRef.current = sessionId;

    try {
      setError("");
      setIsScanning(true);
      setStatusMessage("تجهيز الماسح الأصلي...");

      const { supported } = await NativeBarcodeScanner.isSupported();
      if (!supported) {
        throw new Error("هذا الجهاز لا يدعم مسح الباركود بالكاميرا");
      }

      if (NATIVE_PLATFORM === "android") {
        await ensureAndroidGoogleScanner();
      } else {
        const permissionStatus = await NativeBarcodeScanner.requestPermissions();
        if (!isGrantedPermission(permissionStatus.camera)) {
          throw new Error("تم رفض إذن استخدام الكاميرا");
        }
      }

      if (sessionId !== nativeSessionRef.current || !isOpen) {
        return;
      }

      setStatusMessage("فتح الماسح الأصلي...");

      const { barcodes } = await NativeBarcodeScanner.scan({
        formats: NATIVE_SCAN_FORMATS,
        autoZoom: true,
      });

      if (sessionId !== nativeSessionRef.current || !isOpen) {
        return;
      }

      const scannedValue = barcodes.map(decodeNativeBarcodeValue).find(Boolean);

      if (!scannedValue) {
        onCloseRef.current?.();
        return;
      }

      if (isSoundEnabled) {
        playSuccessBeep();
      }

      navigator.vibrate?.(200);

      await onBarcodeDetectedRef.current(scannedValue);
      toast.success(`تمت قراءة الكود: ${scannedValue}`);
      onCloseRef.current?.();
    } catch (scanError) {
      if (sessionId !== nativeSessionRef.current) {
        return;
      }

      const message = getScanErrorMessage(scanError);

      if (!message) {
        onCloseRef.current?.();
        return;
      }

      setError(message);
      setStatusMessage("");

      if (isSoundEnabled) {
        playErrorBeep();
      }

      toast.error(message, {
        className: "font-display text-destructive border-destructive",
      });
    } finally {
      if (sessionId === nativeSessionRef.current) {
        setIsScanning(false);
      }

      nativeScanInFlightRef.current = false;
    }
  }, [
    ensureAndroidGoogleScanner,
    isOpen,
    isSoundEnabled,
    playErrorBeep,
    playSuccessBeep,
  ]);

  const startWebScan = useCallback(async () => {
    const videoElement = videoRef.current;
    if (!videoElement) {
      return;
    }

    const sessionId = nativeSessionRef.current + 1;
    nativeSessionRef.current = sessionId;

    const handleDecode = async (result: any, scanError: unknown) => {
      if (sessionId !== nativeSessionRef.current) {
        return;
      }

      if (result) {
        const barcode = result.getText();
        if (!barcode) {
          return;
        }

        if (isSoundEnabled) {
          playSuccessBeep();
        }

        navigator.vibrate?.(200);

        stopWebScanning();
        await onBarcodeDetectedRef.current(barcode);
        toast.success(`تمت قراءة الكود: ${barcode}`);
        if (!isInline) {
          onCloseRef.current?.();
        } else {
          // If inline, automatically restart scan after a brief pause
          setTimeout(() => {
            if (isOpen) void startWebScan();
          }, 1500);
        }
        return;
      }

      if (scanError && !(scanError instanceof Exception)) {
        console.error("Barcode scan error:", scanError);
      }
    };

    try {
      if (Capacitor.isNativePlatform()) {
        const permissionStatus = await NativeBarcodeScanner.requestPermissions();
        if (!isGrantedPermission(permissionStatus.camera)) {
          throw new DOMException("تم رفض إذن استخدام الكاميرا", "NotAllowedError");
        }
      }

      setError("");
      setStatusMessage("");
      setIsScanning(true);

      if (isSoundEnabled) {
        playScanBeep();
      }

      await waitForNextFrame();

      let lastError: unknown = new Error("Failed to initialize camera");

      for (const constraints of WEB_CAMERA_ATTEMPTS) {
        if (sessionId !== nativeSessionRef.current) {
          return;
        }

        try {
          await webReaderRef.current.decodeFromConstraints(
            constraints,
            videoElement,
            handleDecode
          );
          return;
        } catch (attemptError) {
          lastError = attemptError;
          webReaderRef.current.reset();

          if (videoRef.current) {
            videoRef.current.srcObject = null;
          }
        }
      }

      throw lastError;
    } catch (scanError) {
      if (sessionId !== nativeSessionRef.current) {
        return;
      }

      const message = getScanErrorMessage(scanError);
      setError(message);
      setIsScanning(false);

      if (isSoundEnabled) {
        playErrorBeep();
      }

      toast.error(message, {
        className: "font-display text-destructive border-destructive",
      });
    }
  }, [isSoundEnabled, playErrorBeep, playScanBeep, playSuccessBeep, stopWebScanning]);

  useEffect(() => {
    if (!isOpen) {
      nativeSessionRef.current += 1;
      nativeScanInFlightRef.current = false;
      setError("");
      setStatusMessage(USES_NATIVE_SCANNER ? "تجهيز الماسح الأصلي..." : "");
      stopWebScanning();
      return;
    }

    if (USES_NATIVE_SCANNER) {
      void runNativeScan();
      return;
    }

    void startWebScan();

    return () => {
      stopWebScanning();
    };
  }, [isOpen, runNativeScan, startWebScan, stopWebScanning]);

  const title = useMemo(
    () => (USES_NATIVE_SCANNER ? "الماسح الأصلي" : "مسح الباركود"),
    []
  );

  const scannerContent = (
    <div className={isInline ? "" : "space-y-4"}>
      {error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/20 p-4 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button
            onClick={() =>
              effectiveUsesNativeScanner ? void runNativeScan() : void startWebScan()
            }
            className="mt-3 w-full"
            variant="outline"
          >
            حاول مجددًا
          </Button>
        </div>
      ) : effectiveUsesNativeScanner ? (
        <div className="space-y-4">
          <div className="rounded-[28px] border border-border/50 bg-gradient-to-br from-background via-muted/40 to-background p-6 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Camera className="h-8 w-8" />
            </div>
            <p className="font-display text-base font-semibold text-foreground">
              {isScanning ? "جاري فتح الماسح الأصلي" : "الماسح جاهز"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {statusMessage || "سيتم فتح واجهة المسح الأصلية على الجهاز"}
            </p>
          </div>

          {!isInline && (
            <Button
              onClick={closeScanner}
              variant="outline"
              className="w-full gap-2"
            >
              <X className="w-4 h-4" />
              إغلاق
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2 relative">
          <div className="relative aspect-video overflow-hidden rounded-2xl bg-black border border-border/30">
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              autoPlay
              muted
              playsInline
            />

            {/* Glowing Scanner Reticle */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="h-[60%] w-[60%] max-w-[200px] animate-pulse rounded-2xl border-2 border-primary/60 shadow-[0_0_20px_rgba(var(--primary),0.3)] shadow-[inset_0_0_20px_rgba(var(--primary),0.3)]" />
            </div>
            
            <div className="absolute left-4 top-4 h-6 w-6 border-l-2 border-t-2 border-primary/80 rounded-tl-lg" />
            <div className="absolute right-4 top-4 h-6 w-6 border-r-2 border-t-2 border-primary/80 rounded-tr-lg" />
            <div className="absolute bottom-4 left-4 h-6 w-6 border-b-2 border-l-2 border-primary/80 rounded-bl-lg" />
            <div className="absolute bottom-4 right-4 h-6 w-6 border-b-2 border-r-2 border-primary/80 rounded-br-lg" />
          </div>

          <div className="flex items-center justify-between text-xs text-foreground/60 w-full px-2">
             <span className="flex items-center gap-1.5">
               {isScanning ? (
                 <><span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span></span> الكاميرا نشطة</>
               ) : (
                 "وجه الكاميرا للباركود..."
               )}
             </span>
             {isSoundEnabled ? (
                <Volume2 className="h-3.5 w-3.5 text-primary/70 cursor-pointer" onClick={() => setIsSoundEnabled(false)} />
             ) : (
                <VolumeX className="h-3.5 w-3.5 text-muted-foreground cursor-pointer" onClick={() => setIsSoundEnabled(true)} />
             )}
          </div>

          {!isInline && (
            <Button
              onClick={closeScanner}
              variant="outline"
              className="w-full gap-2 mt-4"
            >
              <X className="w-4 h-4" />
              إغلاق
            </Button>
          )}
        </div>
      )}
    </div>
  );

  if (isInline) {
    return (
      <div className={className}>
        {scannerContent}
      </div>
    );
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={open => {
        if (!open) {
          closeScanner();
        }
      }}
    >
      <DialogContent aria-describedby={undefined} className="max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              {title}
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSoundEnabled(current => !current)}
              className="gap-2"
            >
              {isSoundEnabled ? (
                <>
                  <Volume2 className="w-4 h-4" />
                  <span className="text-xs">صوت مفعل</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4" />
                  <span className="text-xs">صوت معطل</span>
                </>
              )}
            </Button>
          </div>
        </DialogHeader>

        {scannerContent}
      </DialogContent>
    </Dialog>
  );
}
