// @ts-nocheck
import { RETURN_POLICIES, STORE_BRANCHES, STORE_NAME } from "@/lib/invoice";
import { formatCurrency } from "@/lib/utils";

class BluetoothPrinterError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "BluetoothPrinterError";
    this.code = code;
  }
}

const isDomException = (error: unknown): error is DOMException =>
  typeof DOMException !== "undefined" && error instanceof DOMException;

const normalizeBluetoothError = (error: unknown) => {
  if (isDomException(error)) {
    if (error.name === "NotFoundError") {
      return new BluetoothPrinterError("تم إلغاء اختيار الطابعة", "cancelled");
    }

    if (error.name === "NotSupportedError") {
      return new BluetoothPrinterError("هذا المتصفح لا يدعم طباعة البلوتوث", "unsupported");
    }

    if (error.name === "SecurityError") {
      return new BluetoothPrinterError("يتطلب البلوتوث تشغيل التطبيق عبر localhost أو HTTPS", "security");
    }
  }

  if (error instanceof Error) {
    return new BluetoothPrinterError(error.message, "connection_failed");
  }

  return new BluetoothPrinterError("تعذر الاتصال بطابعة البلوتوث", "connection_failed");
};

const drawCenteredWrappedText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  startY: number,
  maxWidth: number,
  lineHeight: number
) => {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(nextLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = nextLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  ctx.textAlign = "center";
  lines.forEach((line, index) => {
    ctx.fillText(line, centerX, startY + (index * lineHeight));
  });

  return startY + (lines.length * lineHeight);
};

export class BluetoothPrinter {
  device: BluetoothDevice | null = null;
  server: BluetoothRemoteGATTServer | null = null;
  characteristic: BluetoothRemoteGATTCharacteristic | null = null;

  resetConnection() {
    if (this.server?.connected) {
      this.server.disconnect();
    }

    this.device = null;
    this.server = null;
    this.characteristic = null;
  }

  async connect() {
    if (!navigator.bluetooth) {
      throw new BluetoothPrinterError("هذا المتصفح لا يدعم البلوتوث", "unsupported");
    }

    try {
      if (this.server?.connected && this.characteristic) {
        return true;
      }

      this.device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          "000018f0-0000-1000-8000-00805f9b34fb", // Standard BLE Printer
          "e7810a71-73ae-499d-8c15-faa9aef0c3f2", 
          "49535343-fe7d-4ae5-8fa9-9fafd205e455",
          "0000180a-0000-1000-8000-00805f9b34fb"
        ]
      });

      this.server = await this.device.gatt?.connect() || null;
      if (!this.server) throw new Error("Could not connect to GATT Server");

      const services = await this.server.getPrimaryServices();
      for (const service of services) {
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            this.characteristic = char;
            return true;
          }
        }
      }
      throw new Error("No writable characteristic found available on device.");
    } catch (e) {
      const normalizedError = normalizeBluetoothError(e);
      this.resetConnection();

      if (normalizedError.code !== "cancelled") {
        console.error("Bluetooth printer connection failed:", e);
      }

      throw normalizedError;
    }
  }

  async printRasterReceipt(invoice: any) {
    if (!this.characteristic) {
      await this.connect(); // Try connecting if not
    }

    /* Headless Canvas Rasterizer for Arabic RTL Support */
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    
    // Standard 58mm thermal printer width (384 dots)
    canvas.width = 384; 
    canvas.height = 520 + (invoice.cartItems.length * 60);
    
    // Fill white background
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = "black";
    ctx.textAlign = "center";
    
    // Brand Header
    ctx.font = "bold 32px Cairo, Arial, sans-serif";
    ctx.fillText(STORE_NAME, 192, 48);

    ctx.font = "18px Cairo, Arial, sans-serif";
    let y = drawCenteredWrappedText(ctx, `الفروع: ${STORE_BRANCHES.join("، ")}`, 192, 80, 320, 24) + 8;

    ctx.fillRect(20, y, 344, 2);
    y += 34;

    ctx.font = "20px Cairo, Arial, sans-serif";
    ctx.fillText(`فاتورة: ${invoice.invoiceNumber}`, 192, y);
    y += 28;

    ctx.font = "16px Cairo, Arial, sans-serif";
    ctx.fillText(new Date().toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" }), 192, y);
    y += 24;

    ctx.fillRect(20, y, 344, 2);
    y += 40;
    
    // Products Grid
    for (const item of invoice.cartItems) {
      ctx.font = "bold 22px Cairo, Arial, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(item.name, 360, y); // Name
      
      ctx.textAlign = "left";
      ctx.fillText(item.subtotal + " د.ع", 20, y); // Price
      
      ctx.font = "18px Arial";
      ctx.textAlign = "right";
      ctx.fillText("x " + item.quantity, 360, y + 25);
      
      y += 60;
    }
    
    // Divider
    ctx.fillRect(20, y, 344, 2);
    y += 40;
    
    // Totals
    ctx.font = "bold 26px Cairo, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`الإجمالي: ${formatCurrency(invoice.total)}`, 192, y);
    y += 40;

    ctx.font = "bold 18px Cairo, Arial, sans-serif";
    ctx.fillText("سياسة الإرجاع", 192, y);
    y += 28;

    ctx.font = "16px Cairo, Arial, sans-serif";
    for (const policy of RETURN_POLICIES) {
      y = drawCenteredWrappedText(ctx, policy, 192, y, 320, 22) + 4;
    }
    y += 10;

    // Courtesy text
    ctx.font = "18px Cairo, Arial, sans-serif";
    ctx.fillText("شكراً لزيارتكم", 192, y + 26);

    /* 2. Image Processing to 1-Bit Monochrome for ESC/POS */
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imgData.data;
    const widthBytes = Math.ceil(canvas.width / 8);
    const imageBuffer = new Uint8Array(widthBytes * canvas.height);
    
    for (let row = 0; row < canvas.height; row++) {
      for (let col = 0; col < canvas.width; col++) {
        const idx = (row * canvas.width + col) * 4;
        const r = pixels[idx], g = pixels[idx+1], b = pixels[idx+2];
        const brightness = (0.299 * r + 0.587 * g + 0.114 * b);
        
        // Threshold dithering
        if (brightness < 128) {
          const byteIdx = (row * widthBytes) + Math.floor(col / 8);
          const bitIdx = 7 - (col % 8);
          imageBuffer[byteIdx] |= (1 << bitIdx);
        }
      }
    }

    /* 3. Compilation into Hardware ESC/POS Byte Array */
    const init = new Uint8Array([0x1B, 0x40]); 
    const rasterCmd = new Uint8Array([
      0x1D, 0x76, 0x30, 0x00,
      widthBytes & 0xff, (widthBytes >> 8) & 0xff,
      canvas.height & 0xff, (canvas.height >> 8) & 0xff
    ]);
    const feedAndCut = new Uint8Array([0x0A, 0x0A, 0x0A, 0x0A, 0x1D, 0x56, 0x41, 0x00]);

    // Send logic via MTU-safe chunking
    const sendPayload = async (data: Uint8Array) => {
      const CHUNK_SIZE = 120; // Extremely safe MTU size for cheap Chinese BLE modules
      for (let i = 0; i < data.length; i += CHUNK_SIZE) {
        await this.characteristic?.writeValue(data.slice(i, i + CHUNK_SIZE));
        await new Promise(res => setTimeout(res, 10)); // Prevent buffer overflow
      }
    };

    await sendPayload(init);
    await sendPayload(rasterCmd);
    await sendPayload(imageBuffer);
    await sendPayload(feedAndCut);
  }
}

export const thermalPrinter = new BluetoothPrinter();
