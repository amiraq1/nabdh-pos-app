import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, Exception } from "@zxing/library";
import { Button } from "@/components/ui/button";
import { X, Camera, Volume2, VolumeX } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAudioAlert } from "@/hooks/useAudioAlert";
import { native } from "@/_core/native";

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onBarcodeDetected: (barcode: string) => void | Promise<void>;
  soundEnabled?: boolean;
}

const waitForNextFrame = () =>
  new Promise<void>(resolve => {
    requestAnimationFrame(() => resolve());
  });

const waitForScannerSurface = async (isNativeRuntime: boolean) => {
  await waitForNextFrame();

  if (isNativeRuntime) {
    await new Promise(resolve => {
      setTimeout(resolve, 160);
    });
  }

  await waitForNextFrame();
};

const CAMERA_STARTUP_ATTEMPTS: MediaStreamConstraints[] = [
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

const getCameraErrorMessage = (error: unknown) => {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "تم رفض إذن استخدام الكاميرا";
    }

    if (error.name === "NotFoundError") {
      return "لم يتم العثور على كاميرا متاحة";
    }

    if (error.name === "NotReadableError") {
      return "الكاميرا مستخدمة من تطبيق آخر أو غير متاحة حالياً";
    }

    if (error.name === "OverconstrainedError") {
      return "تعذر تشغيل الكاميرا بالإعدادات الحالية";
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "فشل الوصول إلى الكاميرا";
};

export default function BarcodeScanner({
  isOpen,
  onClose,
  onBarcodeDetected,
  soundEnabled = true,
}: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState("");
  const [isSoundEnabled, setIsSoundEnabled] = useState(soundEnabled);
  const scanningRef = useRef(false);
  const startingRef = useRef(false);
  const scanSessionRef = useRef(0);
  const codeReaderRef = useRef(new BrowserMultiFormatReader());
  const onCloseRef = useRef(onClose);
  const onBarcodeDetectedRef = useRef(onBarcodeDetected);
  const isSoundEnabledRef = useRef(soundEnabled);
  const { playScanBeep, playSuccessBeep, playErrorBeep } = useAudioAlert();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    onBarcodeDetectedRef.current = onBarcodeDetected;
  }, [onBarcodeDetected]);

  useEffect(() => {
    isSoundEnabledRef.current = isSoundEnabled;
  }, [isSoundEnabled]);

  const resetVideoSurface = useCallback(() => {
    if (!videoRef.current) {
      return;
    }

    videoRef.current.pause();
    videoRef.current.srcObject = null;
  }, []);

  const stopScanning = useCallback(() => {
    scanSessionRef.current += 1;
    scanningRef.current = false;
    startingRef.current = false;
    codeReaderRef.current.reset();
    resetVideoSurface();
    setIsScanning(false);
  }, [resetVideoSurface]);

  const startScanning = useCallback(async () => {
    if (startingRef.current || scanningRef.current) {
      return;
    }

    const videoElement = videoRef.current;
    if (!videoElement) {
      return;
    }

    const sessionId = scanSessionRef.current + 1;
    scanSessionRef.current = sessionId;

    const handleDecode = (result: any, err: unknown) => {
      if (sessionId !== scanSessionRef.current || !scanningRef.current) {
        return;
      }

      if (result) {
        const barcode = result.getText();

        if (barcode) {
          scanningRef.current = false;

          if (isSoundEnabledRef.current) {
            playSuccessBeep();
          }

          if (navigator.vibrate) {
            navigator.vibrate(200);
          }

          onBarcodeDetectedRef.current(barcode);
          toast.success(`تم قراءة الكود: ${barcode}`);
          stopScanning();
          onCloseRef.current();
          return;
        }
      }

      if (err && !(err instanceof Exception)) {
        console.error("Barcode scan error:", err);
      }
    };

    try {
      setError("");

      if (isSoundEnabledRef.current) {
        playScanBeep();
      }

      startingRef.current = true;
      scanningRef.current = true;
      setIsScanning(true);

      await waitForScannerSurface(native.isNative);

      if (sessionId !== scanSessionRef.current || !videoRef.current) {
        return;
      }

      let lastError: unknown = new Error("Failed to initialize camera");

      for (const constraints of CAMERA_STARTUP_ATTEMPTS) {
        if (sessionId !== scanSessionRef.current || !videoRef.current) {
          return;
        }

        try {
          await codeReaderRef.current.decodeFromConstraints(
            constraints,
            videoElement,
            handleDecode
          );
          return;
        } catch (attemptError) {
          lastError = attemptError;
          codeReaderRef.current.reset();
          resetVideoSurface();
          console.warn("Camera startup attempt failed:", attemptError);
        }
      }

      throw lastError;
    } catch (err) {
      if (sessionId !== scanSessionRef.current) {
        return;
      }

      const message = getCameraErrorMessage(err);
      setError(message);
      stopScanning();

      if (isSoundEnabledRef.current) {
        playErrorBeep();
      }

      toast.error(message);
    } finally {
      if (sessionId === scanSessionRef.current) {
        startingRef.current = false;
      }
    }
  }, [playErrorBeep, playScanBeep, playSuccessBeep, resetVideoSurface, stopScanning]);

  useEffect(() => {
    if (!isOpen) {
      stopScanning();
      return;
    }

    void startScanning();

    return () => {
      stopScanning();
    };
  }, [isOpen, startScanning, stopScanning]);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={open => {
        if (!open) {
          stopScanning();
          onCloseRef.current();
        }
      }}
    >
      <DialogContent aria-describedby={undefined} className="max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              مسح الباركود
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

        <div className="space-y-4">
          {error ? (
            <div className="bg-destructive/20 border border-destructive/50 rounded-lg p-4 text-center">
              <p className="text-destructive text-sm">{error}</p>
              <Button
                onClick={() => void startScanning()}
                className="mt-3 w-full"
                variant="outline"
              >
                حاول مجدداً
              </Button>
            </div>
          ) : (
            <>
              <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                />

                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-64 h-64 border-2 border-accent rounded-lg animate-pulse" />
                </div>

                <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-accent" />
                <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-accent" />
                <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-accent" />
                <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-accent" />
              </div>

              <div className="text-center text-sm text-foreground/60">
                <p>وجه الكاميرا نحو الباركود</p>
                <p className="text-xs mt-1">سيتم الكشف عن الباركود تلقائياً</p>
                {isScanning && (
                  <p className="text-xs mt-2 text-accent">الكاميرا تعمل الآن</p>
                )}
                {isSoundEnabled && (
                  <p className="text-xs mt-2 text-accent">التنبيهات الصوتية مفعلة</p>
                )}
              </div>

              <Button
                onClick={() => {
                  stopScanning();
                  onCloseRef.current();
                }}
                variant="outline"
                className="w-full gap-2"
              >
                <X className="w-4 h-4" />
                إغلاق
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
