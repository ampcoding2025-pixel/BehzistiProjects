import { ARMAGHAN } from "@/lib/armaghan";

export type GetListMakeoverResult = {
  ok: boolean;
  trId: number;
  fileName: string | null;
  message: string;
  accessDenied?: boolean;
  status?: number;
  raw?: unknown;
  ms: number;
};

/** Diskette host used by Armaghan download UI (not the MakeOver API on .16). */
export function armaghanDisketteBase(): string {
  const fromEnv =
    process.env.PAYDISK_ARMAGHAN_DISKETTE_BASE?.trim() ||
    process.env.PAYDISK_ARMAGHAN_DISKETTE?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/+$/, "");
  }
  // Normalize discovered `http://10.1.0.17//Diskette`
  return String(ARMAGHAN.disketteBase).replace(/\/+$/, "").replace(/([^:])\/\//g, "$1/");
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json, text/plain, */*",
  };
  const token = process.env.PAYDISK_ARMAGHAN_TOKEN?.trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    headers.Token = token;
  }
  const cookie = process.env.PAYDISK_ARMAGHAN_COOKIE?.trim();
  if (cookie) {
    headers.Cookie = cookie;
  }
  return headers;
}

function pickFileName(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const s = raw.trim();
    if (/\.csv$/i.test(s)) return s;
    return null;
  }
  if (typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  for (const key of [
    "FileName",
    "fileName",
    "Filename",
    "filename",
    "Key2",
    "key2",
    "DownloadURL",
    "downloadUrl",
    "Data",
    "data",
    "Result",
    "result",
  ]) {
    const v = o[key];
    if (typeof v === "string" && v.trim()) {
      const s = v.trim();
      // DownloadURL may be full URL — take last path segment
      if (/^https?:\/\//i.test(s) || s.includes("/")) {
        const part = s.split(/[\\/]/).pop() || s;
        if (part.includes(".")) return part;
      }
      return s;
    }
    if (v && typeof v === "object") {
      const nested = pickFileName(v);
      if (nested) return nested;
    }
  }
  if (typeof o.Message === "string" && /\.csv$/i.test(o.Message)) {
    return o.Message.trim();
  }
  return null;
}

/**
 * POST Diskette/GetListMakeover?id= — creates CSV on Armaghan diskette host
 * and typically sets MakeOverTransactions.Key2 to that filename.
 */
export async function armaghanGetListMakeover(
  trId: number,
): Promise<GetListMakeoverResult> {
  if (!Number.isFinite(trId) || trId <= 0) {
    throw new Error("TransactionId نامعتبر");
  }
  const token = process.env.PAYDISK_ARMAGHAN_TOKEN?.trim();
  const cookie = process.env.PAYDISK_ARMAGHAN_COOKIE?.trim();
  if (!token && !cookie) {
    throw new Error(
      "برای تایید از مسیر ارمغان، PAYDISK_ARMAGHAN_TOKEN یا PAYDISK_ARMAGHAN_COOKIE را در .env.local تنظیم کنید",
    );
  }

  const base = armaghanDisketteBase();
  const url = `${base}/GetListMakeover?id=${encodeURIComponent(String(trId))}`;
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10 * 60_000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: authHeaders(),
      signal: controller.signal,
    });
    const text = await res.text();
    let raw: unknown = text;
    try {
      raw = text ? JSON.parse(text) : null;
    } catch {
      /* keep text */
    }

    const obj =
      raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
    const accessDenied = !!(obj && obj.AccessDenied === true);
    const success = !!(obj && (obj.Success === true || obj.success === true));
    const apiMessage =
      (obj && typeof obj.Message === "string" && obj.Message) ||
      (obj && typeof obj.message === "string" && obj.message) ||
      "";
    const fileName = pickFileName(raw);

    if (accessDenied || res.status === 401 || res.status === 403) {
      return {
        ok: false,
        trId,
        fileName: null,
        accessDenied: true,
        status: res.status,
        message:
          apiMessage ||
          "دسترسی ارمغان رد شد — توکن/کوکی سرویس را بررسی کنید",
        raw,
        ms: Date.now() - started,
      };
    }

    if (!res.ok) {
      return {
        ok: false,
        trId,
        fileName,
        status: res.status,
        message:
          apiMessage ||
          `GetListMakeover HTTP ${res.status}: ${text.slice(0, 200)}`,
        raw,
        ms: Date.now() - started,
      };
    }

    if (obj && obj.Success === false) {
      return {
        ok: false,
        trId,
        fileName,
        status: res.status,
        message: apiMessage || "GetListMakeover ناموفق بود",
        raw,
        ms: Date.now() - started,
      };
    }

    return {
      ok: success || !!fileName || res.ok,
      trId,
      fileName,
      status: res.status,
      message:
        apiMessage ||
        (fileName
          ? `لیست افراد ساخته شد: ${fileName}`
          : "GetListMakeover اجرا شد"),
      raw,
      ms: Date.now() - started,
    };
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.name === "AbortError"
          ? "زمان GetListMakeover به پایان رسید (۱۰ دقیقه)"
          : err.message
        : String(err);
    return {
      ok: false,
      trId,
      fileName: null,
      message: msg,
      ms: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}

export function armaghanDisketteDownloadUrl(fileName: string): string {
  const base = armaghanDisketteBase();
  return `${base}/Download?filename=${encodeURIComponent(fileName)}`;
}
