// Preconfigured storage helpers for Manus WebDev templates
// Uses the Biz-provided storage proxy (Authorization: Bearer <token>)

import { ENV } from './_core/env';

type StorageConfig = { baseUrl: string; apiKey: string };

function getStorageConfig(): StorageConfig {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;

  if (!baseUrl || !apiKey) {
    throw new Error(
      "Storage proxy credentials missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

function assertStorageKey(key: string) {
  if (!key || key.trim() === "") {
    throw new Error("Storage key is required and cannot be empty");
  }
}

function buildUploadUrl(baseUrl: string, relKey: string): URL {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}

async function buildDownloadUrl(
  baseUrl: string,
  relKey: string,
  apiKey: string,
  signal?: AbortSignal
): Promise<string> {
  const downloadApiUrl = new URL(
    "v1/storage/downloadUrl",
    ensureTrailingSlash(baseUrl)
  );
  downloadApiUrl.searchParams.set("path", normalizeKey(relKey));

  const response = await fetch(downloadApiUrl, {
    method: "GET",
    headers: buildAuthHeaders(apiKey),
    signal,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(
      `Storage download URL request failed (${response.status} ${response.statusText}): ${message}`
    );
  }

  const payload = await response.json();
  if (!payload?.url || typeof payload.url !== "string") {
    throw new Error("Storage API returned an invalid download URL response");
  }

  return payload.url;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function toFormData(
  data: Buffer | Uint8Array | string,
  contentType: string,
  fileName: string
): FormData {
  // Use BlobPart casting instead of any to help TS understand the runtime support
  const blob = new Blob([data as BlobPart], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}

function buildAuthHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}` };
}

/**
 * Uploads a file to storage
 */
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
  options?: { signal?: AbortSignal }
): Promise<{ key: string; url: string }> {
  assertStorageKey(relKey);
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  const uploadUrl = buildUploadUrl(baseUrl, key);
  const formData = toFormData(data, contentType, key.split("/").pop() ?? key);

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: buildAuthHeaders(apiKey),
    body: formData,
    signal: options?.signal,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(
      `Storage upload failed (${response.status} ${response.statusText}): ${message}`
    );
  }

  const payload = await response.json();
  if (!payload?.url || typeof payload.url !== "string") {
    throw new Error("Storage API returned an invalid upload response");
  }

  return { key, url: payload.url };
}

/**
 * Gets the download URL for a file in storage
 */
export async function storageGetDownloadUrl(
  relKey: string,
  options?: { signal?: AbortSignal }
): Promise<{ key: string; url: string }> {
  assertStorageKey(relKey);
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);

  return {
    key,
    url: await buildDownloadUrl(baseUrl, key, apiKey, options?.signal),
  };
}

// Alias for compatibility
export const storageGet = storageGetDownloadUrl;
