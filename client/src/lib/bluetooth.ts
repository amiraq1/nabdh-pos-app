import { Capacitor, registerPlugin, type PermissionState, type Plugin } from "@capacitor/core";

import { RETURN_POLICIES, STORE_BRANCHES, STORE_NAME } from "@/lib/invoice";
import { formatCurrency } from "@/lib/utils";

export interface PrintableCartItem {
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
  productId?: number;
}

export interface PrintableInvoice {
  invoiceNumber: string;
  cartItems: PrintableCartItem[];
  total: number;
  subtotal?: number;
  discountAmount?: number;
  customerName?: string;
  customerPhone?: string;
  paymentMethod?: string;
  createdAt?: string | number | Date;
  status?: "synced" | "pending_sync" | "failed_sync";
}

export interface PrinterDevice {
  id: string;
  name: string;
}

export interface PrinterStatus {
  supported: boolean;
  connected: boolean;
  enabled: boolean;
  printerId: string;
  printerName: string;
  mode: "native" | "web" | "unsupported";
  permission: PermissionState | "unknown";
}

export interface PrinterJobResult {
  printerId: string;
  printerName: string;
}

export type PrinterPaperWidth = 58 | 80;

interface PrintOptions {
  silent?: boolean;
  printerId?: string;
  printerName?: string;
  copies?: number;
  paperWidth?: PrinterPaperWidth;
  cutAfterPrint?: boolean;
}

interface NativePrinterPermissions {
  bluetooth: PermissionState;
}

interface NativePrinterStatus {
  available: boolean;
  enabled: boolean;
  connected: boolean;
  address?: string;
  name?: string;
}

interface NativePrinterDevice {
  address: string;
  name?: string;
}

interface NativePrinterPlugin extends Plugin {
  checkPermissions(): Promise<NativePrinterPermissions>;
  requestPermissions(): Promise<NativePrinterPermissions>;
  getStatus(): Promise<NativePrinterStatus>;
  listPairedDevices(): Promise<{ devices: NativePrinterDevice[] }>;
  connect(options?: { address?: string; name?: string }): Promise<NativePrinterStatus>;
  disconnect(): Promise<void>;
  print(options: {
    payloadBase64: string;
    address?: string;
    name?: string;
  }): Promise<NativePrinterStatus>;
}

interface WebBluetoothCharacteristic {
  properties: {
    write: boolean;
    writeWithoutResponse: boolean;
  };
  writeValue(data: BufferSource): Promise<void>;
  writeValueWithoutResponse?(data: BufferSource): Promise<void>;
}

interface WebBluetoothService {
  getCharacteristics(): Promise<WebBluetoothCharacteristic[]>;
}

interface WebBluetoothRemoteGattServer {
  connected: boolean;
  connect(): Promise<WebBluetoothRemoteGattServer>;
  disconnect(): void;
  getPrimaryServices(): Promise<WebBluetoothService[]>;
}

interface WebBluetoothDevice extends EventTarget {
  id: string;
  name?: string;
  gatt?: WebBluetoothRemoteGattServer;
}

interface WebBluetoothNavigator extends Navigator {
  bluetooth?: {
    requestDevice(options: {
      acceptAllDevices: boolean;
      optionalServices: string[];
    }): Promise<WebBluetoothDevice>;
    getDevices?: () => Promise<WebBluetoothDevice[]>;
  };
}

class BluetoothPrinterError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "BluetoothPrinterError";
    this.code = code;
  }
}

const NativeBluetoothPrinter = registerPlugin<NativePrinterPlugin>("BluetoothPrinter");

const WEB_BLUETOOTH_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
  "0000180a-0000-1000-8000-00805f9b34fb",
];

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "نقداً",
  card: "بطاقة ائتمان",
  transfer: "تحويل بنكي",
};

const sleep = (time: number) => new Promise(resolve => window.setTimeout(resolve, time));

const isDomException = (error: unknown): error is DOMException =>
  typeof DOMException !== "undefined" && error instanceof DOMException;

const normalizeBluetoothError = (error: unknown) => {
  if (error instanceof BluetoothPrinterError) {
    return error;
  }

  if (isDomException(error)) {
    if (error.name === "NotFoundError") {
      return new BluetoothPrinterError("تم إلغاء اختيار الطابعة", "cancelled");
    }

    if (error.name === "NotAllowedError") {
      return new BluetoothPrinterError("يجب منح إذن البلوتوث للطباعة", "permission_denied");
    }

    if (error.name === "NotSupportedError") {
      return new BluetoothPrinterError("هذا الجهاز لا يدعم طباعة البلوتوث", "unsupported");
    }

    if (error.name === "SecurityError") {
      return new BluetoothPrinterError("يتطلب البلوتوث تشغيل التطبيق عبر HTTPS أو داخل التطبيق الأصلي", "security");
    }
  }

  if (error instanceof Error) {
    return new BluetoothPrinterError(error.message, "connection_failed");
  }

  return new BluetoothPrinterError("تعذر تنفيذ الطباعة عبر البلوتوث", "connection_failed");
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
      continue;
    }

    currentLine = nextLine;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  ctx.textAlign = "center";
  lines.forEach((line, index) => {
    ctx.fillText(line, centerX, startY + index * lineHeight);
  });

  return startY + lines.length * lineHeight;
};

const createPrinterResult = (printerId = "", printerName = ""): PrinterJobResult => ({
  printerId,
  printerName,
});

const clampCopyCount = (copies?: number) => Math.min(3, Math.max(1, Math.round(copies || 1)));

const getBluetoothNavigator = () =>
  typeof navigator === "undefined" ? undefined : (navigator as WebBluetoothNavigator).bluetooth;

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = "";

  for (let index = 0; index < bytes.length; index += 0x8000) {
    const slice = bytes.subarray(index, index + 0x8000);

    for (let sliceIndex = 0; sliceIndex < slice.length; sliceIndex += 1) {
      binary += String.fromCharCode(slice[sliceIndex]);
    }
  }

  return btoa(binary);
};

const createReceiptPayload = (
  invoice: PrintableInvoice,
  options: Pick<PrintOptions, "paperWidth" | "cutAfterPrint"> = {}
) => {
  const paperWidth = options.paperWidth === 80 ? 80 : 58;
  const canvasWidth = paperWidth === 80 ? 576 : 384;
  const horizontalPadding = paperWidth === 80 ? 28 : 20;
  const dividerWidth = canvasWidth - horizontalPadding * 2;
  const contentWidth = dividerWidth - (paperWidth === 80 ? 32 : 24);
  const rightEdge = canvasWidth - horizontalPadding;
  const leftEdge = horizontalPadding;
  const titleFontSize = paperWidth === 80 ? 38 : 30;
  const sectionFontSize = paperWidth === 80 ? 22 : 18;
  const bodyFontSize = paperWidth === 80 ? 18 : 15;
  const metaLineHeight = paperWidth === 80 ? 28 : 24;
  const itemGap = paperWidth === 80 ? 42 : 36;
  const estimatedHeight =
    (paperWidth === 80 ? 760 : 620) +
    invoice.cartItems.length * (paperWidth === 80 ? 82 : 68) +
    RETURN_POLICIES.length * (paperWidth === 80 ? 34 : 30) +
    (invoice.customerName ? metaLineHeight + 6 : 0) +
    (invoice.customerPhone ? metaLineHeight + 6 : 0) +
    (invoice.discountAmount ? metaLineHeight + 4 : 0) +
    (invoice.paymentMethod ? metaLineHeight + 6 : 0);

  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = estimatedHeight;

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new BluetoothPrinterError("تعذر تجهيز الإيصال للطباعة", "render_failed");
  }

  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "black";
  ctx.textBaseline = "top";
  ctx.direction = "rtl";

  const centerX = canvas.width / 2;
  const invoiceDate = new Date(invoice.createdAt ?? Date.now());
  let y = paperWidth === 80 ? 28 : 22;

  ctx.font = `bold ${titleFontSize}px Cairo, Tajawal, Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(STORE_NAME, centerX, y);
  y += paperWidth === 80 ? 50 : 42;

  ctx.font = `${paperWidth === 80 ? 20 : 17}px Cairo, Tajawal, Arial, sans-serif`;
  y =
    drawCenteredWrappedText(
      ctx,
      `الفروع: ${STORE_BRANCHES.join("، ")}`,
      centerX,
      y,
      contentWidth,
      paperWidth === 80 ? 28 : 24
    ) + 10;

  ctx.fillRect(horizontalPadding, y, dividerWidth, 2);
  y += 18;

  ctx.font = `bold ${sectionFontSize}px Cairo, Tajawal, Arial, sans-serif`;
  ctx.fillText(`فاتورة ${invoice.invoiceNumber}`, centerX, y);
  y += paperWidth === 80 ? 32 : 28;

  ctx.font = `${bodyFontSize}px Cairo, Tajawal, Arial, sans-serif`;
  ctx.fillText(
    invoiceDate.toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" }),
    centerX,
    y
  );
  y += metaLineHeight;

  if (invoice.customerName) {
    ctx.textAlign = "right";
    ctx.fillText(`العميل: ${invoice.customerName}`, rightEdge, y);
    y += metaLineHeight;
  }

  if (invoice.customerPhone) {
    ctx.textAlign = "right";
    ctx.fillText(`الهاتف: ${invoice.customerPhone}`, rightEdge, y);
    y += metaLineHeight;
  }

  if (invoice.paymentMethod) {
    ctx.textAlign = "right";
    ctx.fillText(
      `الدفع: ${PAYMENT_METHOD_LABELS[invoice.paymentMethod] ?? invoice.paymentMethod}`,
      rightEdge,
      y
    );
    y += metaLineHeight;
  }

  ctx.fillRect(horizontalPadding, y, dividerWidth, 2);
  y += 24;

  for (const item of invoice.cartItems) {
    ctx.font = `bold ${paperWidth === 80 ? 24 : 20}px Cairo, Tajawal, Arial, sans-serif`;
    ctx.textAlign = "right";
    ctx.fillText(item.name, rightEdge, y);

    ctx.textAlign = "left";
    ctx.fillText(formatCurrency(item.subtotal), leftEdge, y);
    y += paperWidth === 80 ? 32 : 28;

    ctx.font = `${paperWidth === 80 ? 19 : 16}px Cairo, Tajawal, Arial, sans-serif`;
    ctx.textAlign = "right";
    ctx.fillText(`${item.quantity} × ${formatCurrency(item.price)}`, rightEdge, y);
    y += itemGap;
  }

  ctx.fillRect(horizontalPadding, y, dividerWidth, 2);
  y += 20;

  ctx.font = `${paperWidth === 80 ? 20 : 16}px Cairo, Tajawal, Arial, sans-serif`;
  ctx.textAlign = "right";
  ctx.fillText("المجموع", rightEdge, y);
  ctx.textAlign = "left";
  ctx.fillText(formatCurrency(invoice.subtotal ?? invoice.total), leftEdge, y);
  y += metaLineHeight;

  if (invoice.discountAmount && invoice.discountAmount > 0) {
    ctx.textAlign = "right";
    ctx.fillText("الخصم", rightEdge, y);
    ctx.textAlign = "left";
    ctx.fillText(`-${formatCurrency(invoice.discountAmount)}`, leftEdge, y);
    y += metaLineHeight;
  }

  ctx.fillRect(horizontalPadding, y, dividerWidth, 2);
  y += 18;

  ctx.font = `bold ${paperWidth === 80 ? 34 : 28}px Cairo, Tajawal, Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(`الصافي ${formatCurrency(invoice.total)}`, centerX, y);
  y += paperWidth === 80 ? 52 : 46;

  ctx.font = `bold ${sectionFontSize}px Cairo, Tajawal, Arial, sans-serif`;
  ctx.fillText("سياسة الإرجاع", centerX, y);
  y += 28;

  ctx.font = `${bodyFontSize}px Cairo, Tajawal, Arial, sans-serif`;
  for (const policy of RETURN_POLICIES) {
    y = drawCenteredWrappedText(
      ctx,
      policy,
      centerX,
      y,
      contentWidth,
      paperWidth === 80 ? 25 : 22
    ) + 4;
  }

  y += 12;
  ctx.font = `${paperWidth === 80 ? 18 : 16}px Cairo, Tajawal, Arial, sans-serif`;
  ctx.fillText("شكراً لزيارتكم", centerX, y);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;
  const widthBytes = Math.ceil(canvas.width / 8);
  const rasterData = new Uint8Array(widthBytes * canvas.height);

  for (let row = 0; row < canvas.height; row += 1) {
    for (let col = 0; col < canvas.width; col += 1) {
      const index = (row * canvas.width + col) * 4;
      const brightness = 0.299 * pixels[index] + 0.587 * pixels[index + 1] + 0.114 * pixels[index + 2];

      if (brightness < 160) {
        const byteIndex = row * widthBytes + Math.floor(col / 8);
        const bitIndex = 7 - (col % 8);
        rasterData[byteIndex] |= 1 << bitIndex;
      }
    }
  }

  const init = new Uint8Array([0x1b, 0x40]);
  const rasterCmd = new Uint8Array([
    0x1d,
    0x76,
    0x30,
    0x00,
    widthBytes & 0xff,
    (widthBytes >> 8) & 0xff,
    canvas.height & 0xff,
    (canvas.height >> 8) & 0xff,
  ]);
  const feedBytes = new Uint8Array(paperWidth === 80 ? [0x0a, 0x0a, 0x0a, 0x0a] : [0x0a, 0x0a, 0x0a]);
  const cutBytes = new Uint8Array([0x1d, 0x56, 0x41, 0x00]);
  const footerBytes = options.cutAfterPrint
    ? new Uint8Array(feedBytes.length + cutBytes.length)
    : feedBytes;

  if (options.cutAfterPrint) {
    footerBytes.set(feedBytes, 0);
    footerBytes.set(cutBytes, feedBytes.length);
  }

  const payload = new Uint8Array(init.length + rasterCmd.length + rasterData.length + footerBytes.length);
  payload.set(init, 0);
  payload.set(rasterCmd, init.length);
  payload.set(rasterData, init.length + rasterCmd.length);
  payload.set(footerBytes, init.length + rasterCmd.length + rasterData.length);

  return payload;
};

const createTestInvoice = (): PrintableInvoice => ({
  invoiceNumber: `TEST-${Date.now().toString().slice(-5)}`,
  createdAt: new Date(),
  customerName: "وضع الاختبار",
  paymentMethod: "cash",
  subtotal: 5000,
  discountAmount: 0,
  total: 5000,
  cartItems: [
    { name: "فحص الطابعة", quantity: 1, price: 2500, subtotal: 2500 },
    { name: "محاذاة العربية", quantity: 1, price: 2500, subtotal: 2500 },
  ],
});

export class BluetoothPrinter {
  private webDevice: WebBluetoothDevice | null = null;
  private webServer: WebBluetoothRemoteGattServer | null = null;
  private webCharacteristic: WebBluetoothCharacteristic | null = null;
  private nativePrinterId = "";
  private nativePrinterName = "";
  private queuedJob: Promise<void> = Promise.resolve();

  private get hasNativePrinter() {
    return (
      Capacitor.isNativePlatform() &&
      Capacitor.getPlatform() === "android" &&
      Capacitor.isPluginAvailable("BluetoothPrinter")
    );
  }

  private get hasWebBluetooth() {
    return Boolean(getBluetoothNavigator());
  }

  supportsBluetooth() {
    return this.hasNativePrinter || this.hasWebBluetooth;
  }

  private async ensureNativePermissions() {
    if (!this.hasNativePrinter) {
      return;
    }

    const permissions = await NativeBluetoothPrinter.checkPermissions();

    if (permissions.bluetooth === "granted") {
      return;
    }

    const requested = await NativeBluetoothPrinter.requestPermissions();

    if (requested.bluetooth !== "granted") {
      throw new BluetoothPrinterError("يجب منح إذن البلوتوث للطباعة", "permission_denied");
    }
  }

  private resetWebConnection() {
    try {
      this.webServer?.disconnect();
    } catch (error) {
      console.warn("Failed to close web bluetooth connection:", error);
    }

    if (this.webDevice) {
      this.webDevice.removeEventListener("gattserverdisconnected", this.handleWebDisconnect);
    }

    this.webDevice = null;
    this.webServer = null;
    this.webCharacteristic = null;
  }

  private handleWebDisconnect = () => {
    this.webCharacteristic = null;
    this.webServer = null;
  };

  private async connectWebDevice(device: WebBluetoothDevice) {
    const server = await device.gatt?.connect();

    if (!server) {
      throw new BluetoothPrinterError("تعذر فتح اتصال البلوتوث مع الطابعة", "connection_failed");
    }

    const services = await server.getPrimaryServices();
    let writableCharacteristic: WebBluetoothCharacteristic | null = null;

    for (const service of services) {
      const characteristics = await service.getCharacteristics();
      writableCharacteristic =
        characteristics.find(
          (characteristic: WebBluetoothCharacteristic) =>
            characteristic.properties.writeWithoutResponse
        ) ??
        characteristics.find(
          (characteristic: WebBluetoothCharacteristic) => characteristic.properties.write
        ) ??
        null;

      if (writableCharacteristic) {
        break;
      }
    }

    if (!writableCharacteristic) {
      throw new BluetoothPrinterError("لم يتم العثور على قناة كتابة مناسبة في الطابعة", "no_characteristic");
    }

    if (this.webDevice && this.webDevice !== device) {
      this.webDevice.removeEventListener("gattserverdisconnected", this.handleWebDisconnect);
    }

    this.webDevice = device;
    this.webServer = server;
    this.webCharacteristic = writableCharacteristic;
    this.webDevice.addEventListener("gattserverdisconnected", this.handleWebDisconnect);
  }

  private async resolveWebDevice(options: {
    printerId?: string;
    printerName?: string;
    preferPaired?: boolean;
    requestDevice?: boolean;
  }) {
    if (this.webDevice?.gatt?.connected && this.webCharacteristic) {
      if (
        (!options.printerId || this.webDevice.id === options.printerId) &&
        (!options.printerName || this.webDevice.name === options.printerName)
      ) {
        return this.webDevice;
      }
    }

    const bluetooth = getBluetoothNavigator();

    if (!bluetooth) {
      throw new BluetoothPrinterError("هذا المتصفح لا يدعم البلوتوث", "unsupported");
    }

    if (options.preferPaired && typeof bluetooth.getDevices === "function") {
      const devices = await bluetooth.getDevices();
      const preferredDevice =
        devices.find((device: WebBluetoothDevice) => device.id === options.printerId) ??
        devices.find((device: WebBluetoothDevice) => device.name === options.printerName);

      if (preferredDevice) {
        return preferredDevice;
      }
    }

    if (options.requestDevice === false) {
      throw new BluetoothPrinterError("لا توجد طابعة محفوظة جاهزة لإعادة الاتصال", "printer_not_found");
    }

    return bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: WEB_BLUETOOTH_SERVICES,
    });
  }

  async getStatus(): Promise<PrinterStatus> {
    if (this.hasNativePrinter) {
      const permissions = await NativeBluetoothPrinter.checkPermissions();
      const status = await NativeBluetoothPrinter.getStatus();

      this.nativePrinterId = status.address ?? "";
      this.nativePrinterName = status.name ?? "";

      return {
        supported: status.available,
        connected: status.connected,
        enabled: status.enabled,
        printerId: status.address ?? "",
        printerName: status.name ?? "",
        mode: "native",
        permission: permissions.bluetooth,
      };
    }

    if (this.hasWebBluetooth) {
      return {
        supported: true,
        connected: Boolean(this.webDevice?.gatt?.connected && this.webCharacteristic),
        enabled: true,
        printerId: this.webDevice?.id ?? "",
        printerName: this.webDevice?.name ?? "",
        mode: "web",
        permission: "granted",
      };
    }

    return {
      supported: false,
      connected: false,
      enabled: false,
      printerId: "",
      printerName: "",
      mode: "unsupported",
      permission: "unknown",
    };
  }

  async listAvailablePrinters(options: { requestPermissions?: boolean } = {}) {
    if (this.hasNativePrinter) {
      if (options.requestPermissions) {
        await this.ensureNativePermissions();
      } else {
        const permissions = await NativeBluetoothPrinter.checkPermissions();

        if (permissions.bluetooth !== "granted") {
          return [] as PrinterDevice[];
        }
      }

      const response = await NativeBluetoothPrinter.listPairedDevices();

      return response.devices.map(device => ({
        id: device.address,
        name: device.name || "طابعة بدون اسم",
      }));
    }

    const bluetooth = getBluetoothNavigator();

    if (bluetooth && typeof bluetooth.getDevices === "function") {
      const devices = await bluetooth.getDevices();
      return devices.map((device: WebBluetoothDevice) => ({
        id: device.id,
        name: device.name || "Bluetooth Printer",
      }));
    }

    if (this.webDevice) {
      return [
        {
          id: this.webDevice.id,
          name: this.webDevice.name || "Bluetooth Printer",
        },
      ];
    }

    return [] as PrinterDevice[];
  }

  async connect(options: {
    printerId?: string;
    printerName?: string;
    preferPaired?: boolean;
    requestDevice?: boolean;
  } = {}): Promise<PrinterJobResult> {
    try {
      if (this.hasNativePrinter) {
        await this.ensureNativePermissions();
        const status = await NativeBluetoothPrinter.connect({
          address: options.printerId,
          name: options.printerName,
        });

        this.nativePrinterId = status.address ?? "";
        this.nativePrinterName = status.name ?? "";

        return createPrinterResult(this.nativePrinterId, this.nativePrinterName);
      }

      if (!this.hasWebBluetooth) {
        throw new BluetoothPrinterError("هذا الجهاز لا يدعم طباعة البلوتوث", "unsupported");
      }

      const device = await this.resolveWebDevice({
        printerId: options.printerId,
        printerName: options.printerName,
        preferPaired: options.preferPaired ?? true,
        requestDevice: options.requestDevice ?? true,
      });

      await this.connectWebDevice(device);

      return createPrinterResult(device.id, device.name ?? "Bluetooth Printer");
    } catch (error) {
      const normalizedError = normalizeBluetoothError(error);

      if (this.hasWebBluetooth && normalizedError.code !== "cancelled") {
        this.resetWebConnection();
      }

      throw normalizedError;
    }
  }

  async disconnect() {
    if (this.hasNativePrinter) {
      await NativeBluetoothPrinter.disconnect();
      this.nativePrinterId = "";
      this.nativePrinterName = "";
      return;
    }

    this.resetWebConnection();
  }

  private async printBytes(payload: Uint8Array, options: PrintOptions = {}) {
    if (this.hasNativePrinter) {
      await this.ensureNativePermissions();
      const result = await NativeBluetoothPrinter.print({
        payloadBase64: bytesToBase64(payload),
        address: options.printerId,
        name: options.printerName,
      });

      this.nativePrinterId = result.address ?? "";
      this.nativePrinterName = result.name ?? "";

      return createPrinterResult(this.nativePrinterId, this.nativePrinterName);
    }

    if (!this.webCharacteristic || !this.webDevice?.gatt?.connected) {
      await this.connect({
        printerId: options.printerId,
        printerName: options.printerName,
        preferPaired: Boolean(options.printerId || options.printerName || options.silent),
        requestDevice: !options.silent,
      });
    }

    if (!this.webCharacteristic || !this.webDevice) {
      throw new BluetoothPrinterError("تعذر تهيئة الطابعة قبل الإرسال", "connection_failed");
    }

    const chunkSize = 120;

    for (let index = 0; index < payload.length; index += chunkSize) {
      const chunk = payload.slice(index, index + chunkSize);

      if (
        this.webCharacteristic.properties.writeWithoutResponse &&
        this.webCharacteristic.writeValueWithoutResponse
      ) {
        await this.webCharacteristic.writeValueWithoutResponse(chunk);
      } else {
        await this.webCharacteristic.writeValue(chunk);
      }

      await sleep(10);
    }

    return createPrinterResult(this.webDevice.id, this.webDevice.name ?? "Bluetooth Printer");
  }

  private shouldRetryPrint(error: BluetoothPrinterError) {
    return ["connection_failed", "print_failed", "no_characteristic"].includes(error.code);
  }

  private async printBytesWithRecovery(
    payload: Uint8Array,
    options: PrintOptions,
    allowRetry = true
  ): Promise<PrinterJobResult> {
    try {
      return await this.printBytes(payload, options);
    } catch (error) {
      const normalizedError = normalizeBluetoothError(error);

      if (!allowRetry || !this.shouldRetryPrint(normalizedError)) {
        throw normalizedError;
      }

      await this.disconnect().catch(() => undefined);
      return this.printBytesWithRecovery(payload, options, false);
    }
  }

  private enqueueJob<T>(job: () => Promise<T>) {
    const scheduled = this.queuedJob.catch(() => undefined).then(job);
    this.queuedJob = scheduled.then(
      () => undefined,
      () => undefined
    );
    return scheduled;
  }

  async printRasterReceipt(invoice: PrintableInvoice, options: PrintOptions = {}) {
    return this.enqueueJob(async () => {
      const payload = createReceiptPayload(invoice, options);
      const copies = clampCopyCount(options.copies);
      let lastResult = createPrinterResult(options.printerId ?? "", options.printerName ?? "");

      for (let copyIndex = 0; copyIndex < copies; copyIndex += 1) {
        lastResult = await this.printBytesWithRecovery(payload, options, copyIndex === 0);
      }

      return lastResult;
    });
  }

  async printTestReceipt(options: PrintOptions = {}) {
    return this.printRasterReceipt(createTestInvoice(), options);
  }
}

export { BluetoothPrinterError };
export const thermalPrinter = new BluetoothPrinter();
