import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, Exception } from "@zxing/library";
import { Button } from "@/components/ui/button";
import { X, Camera, Volume2, VolumeX } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAudioAlert } from "@/hooks/useAudioAlert";

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onBarcodeDetected: (barcode: string) => void;
  soundEnabled?: boolean;
}

export default function BarcodeScanner({ isOpen, onClose, onBarcodeDetected, soundEnabled = true }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string>("");
  const [isSoundEnabled, setIsSoundEnabled] = useState(soundEnabled);
  const scanningRef = useRef(false);
  const codeReaderRef = useRef(new BrowserMultiFormatReader());
  const { playScanBeep, playSuccessBeep, playErrorBeep } = useAudioAlert();

  useEffect(() => {
    if (!isOpen) {
      stopScanning();
      return;
    }

    startScanning();
  }, [isOpen]);

  const startScanning = async () => {
    try {
      setError("");
      if (isSoundEnabled) playScanBeep();
      
      setIsScanning(true);
      scanningRef.current = true;

      // 1. Initiate camera using rock-solid native API
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });

      if (videoRef.current) {
        // Force attachment of the media stream to the video element
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((e) => {
          if (e.name !== "AbortError") console.error("Video playback error:", e);
        });
      }

      // 2. Instruct ZXing to decode from our manually created stream
      codeReaderRef.current.decodeFromStream(stream, videoRef.current as HTMLVideoElement, (result, err) => {
        if (result && scanningRef.current) {
          const barcode = result.getText();
          if (barcode) {
            scanningRef.current = false;
            if (isSoundEnabled) playSuccessBeep();
            if (navigator.vibrate) navigator.vibrate(200);
            
            onBarcodeDetected(barcode);
            toast.success(`تم قراءة الكود: ${barcode}`);
            stopScanning();
            onClose();
          }
        }
      });
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "فشل الوصول إلى الكاميرا";
      setError(errorMessage);
      if (isSoundEnabled) playErrorBeep();
      toast.error("تأكد من السماح بالوصول إلى الكاميرا");
    }
  };

  const stopScanning = () => {
    scanningRef.current = false;
    codeReaderRef.current.reset();
    
    // Explicitly shut down all media stream tracks
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    
    setIsScanning(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
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
              onClick={() => setIsSoundEnabled(!isSoundEnabled)}
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
                onClick={startScanning}
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
                  autoPlay
                  muted
                  playsInline
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Scanning overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-64 h-64 border-2 border-accent rounded-lg animate-pulse" />
                </div>

                {/* Corner markers */}
                <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-accent" />
                <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-accent" />
                <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-accent" />
                <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-accent" />
              </div>

              <div className="text-center text-sm text-foreground/60">
                <p>وجّه الكاميرا نحو الباركود</p>
                <p className="text-xs mt-1">سيتم الكشف عن الباركود تلقائياً</p>
                {isSoundEnabled && (
                  <p className="text-xs mt-2 text-accent">🔊 التنبيهات الصوتية مفعلة</p>
                )}
              </div>

              <Button
                onClick={() => {
                  stopScanning();
                  onClose();
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
