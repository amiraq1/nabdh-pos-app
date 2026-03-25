import { Capacitor } from "@capacitor/core";

export const API_URL_STORAGE_KEY = "nabdh-pos-api-url";
export const EMULATOR_API_URL = "http://10.0.2.2:3000";
export const API_REQUEST_TIMEOUT_MS = 6000;

const NETWORK_ERROR_PATTERN =
  /Failed to fetch|fetch failed|Load failed|NetworkError|ERR_CONNECTION|ERR_NETWORK|ERR_NAME_NOT_RESOLVED/i;

export function normalizeApiUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

export function getConfiguredApiUrl() {
  return normalizeApiUrl(import.meta.env.VITE_API_URL?.trim() || "");
}

export function getStoredApiUrl() {
  if (typeof window === "undefined") {
    return "";
  }

  return normalizeApiUrl(window.localStorage.getItem(API_URL_STORAGE_KEY) ?? "");
}

export function setStoredApiUrl(value: string) {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = normalizeApiUrl(value);

  if (!normalized) {
    window.localStorage.removeItem(API_URL_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(API_URL_STORAGE_KEY, normalized);
}

export function clearStoredApiUrl() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(API_URL_STORAGE_KEY);
}

export function isNativeRuntime() {
  if (typeof window === "undefined") {
    return false;
  }

  const isCapacitorOrigin =
    window.location.origin.includes("localhost") && !window.location.port;

  return isCapacitorOrigin || Capacitor.isNativePlatform();
}

export function getBaseUrl() {
  const configuredUrl = getConfiguredApiUrl();
  const storedUrl = getStoredApiUrl();

  if (typeof window === "undefined") {
    return storedUrl || configuredUrl;
  }

  if (!isNativeRuntime()) {
    return "";
  }

  return storedUrl || configuredUrl || EMULATOR_API_URL;
}

export function isUsingEmulatorFallback() {
  return isNativeRuntime() && !getStoredApiUrl() && !getConfiguredApiUrl();
}

export function getApiConnectionHint() {
  if (!isNativeRuntime()) {
    return "في المتصفح سيتم استخدام نفس أصل الصفحة لطلبات API.";
  }

  if (isUsingEmulatorFallback()) {
    return "10.0.2.2 يعمل داخل Android Emulator فقط. على الهاتف الحقيقي استخدم IP الجهاز الذي يشغّل الخادم، مثل http://192.168.1.50:3000.";
  }

  return "استخدم عنوان الجهاز الذي يشغّل الخادم على نفس الشبكة المحلية، مثل http://192.168.1.50:3000.";
}

export function formatApiErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");

  if (message === "API_REQUEST_TIMEOUT") {
    return isUsingEmulatorFallback()
      ? "انتهت مهلة الاتصال بالخادم. التطبيق على الهاتف يستخدم حاليًا عنوان المحاكي 10.0.2.2؛ افتح صفحة المزيد واضبط عنوان الخادم المحلي."
      : "انتهت مهلة الاتصال بالخادم. تحقق من الشبكة أو من عنوان الخادم في صفحة المزيد.";
  }

  if (NETWORK_ERROR_PATTERN.test(message)) {
    return isUsingEmulatorFallback()
      ? "تعذر الوصول إلى الخادم. 10.0.2.2 يعمل فقط داخل المحاكي؛ على الهاتف الحقيقي استخدم IP الجهاز الذي يشغّل الخادم."
      : "تعذر الوصول إلى الخادم. تحقق من الشبكة وعنوان الخادم في صفحة المزيد.";
  }

  return message;
}
