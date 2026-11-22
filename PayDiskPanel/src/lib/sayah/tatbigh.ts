/**
 * Central Bank Sayah — Sheba ↔ national-id match.
 *
 * Transports (PAYDISK_SAYAH_MODE):
 * - rest  — NIX GSB JSON (gservices.nix.gov.ir) — needs USER_KEY + bundle-id + Basic Auth
 * - soap  — IT.org SOAP (gsbservices.iran.gov.ir) — Basic Auth only (راهنمای سرویس)
 * - auto  — try REST first, fall back to SOAP on transport/network failure (default)
 */

import { readFileSync } from "fs";
import * as https from "https";
import * as http from "http";
import { URL } from "url";

export type SayahAccountOwnerType = "1" | "2" | "3" | "4";
export type SayahTransport = "rest" | "soap";
export type SayahMode = "auto" | "rest" | "soap";

export type SayahTatbighConfig = {
  mode: SayahMode;
  restBaseUrl: string;
  soapUrl: string;
  userKey: string;
  bundleId: string;
  username: string;
  password: string;
  /** Optional PEM/CER path for CBI CBISWDRootCA (SOAP TLS). */
  caFile: string | null;
};

export type SayahMatchRequest = {
  /** 1=حقیقی ایرانی 2=حقوقی ایرانی 3=حقیقی خارجی 4=حقوقی خارجی */
  accountOwnerType: SayahAccountOwnerType;
  nationalId: string;
  /** "0" for natural persons (حقیقی) */
  legalId: string;
  /** IR + 24 digits (26 chars) */
  shebaId: string;
};

export type SayahMatchResult = {
  ok: boolean;
  matched: boolean | null;
  hasError: boolean;
  statusCode: number | null;
  message: string | null;
  errors: Array<{ ErrorCd?: string; ErrorDsc?: string }>;
  transport?: SayahTransport;
  /** When auto fallback used, which attempts ran. */
  tried?: SayahTransport[];
  raw?: unknown;
};

function env(name: string): string {
  return (process.env[name] || "").trim();
}

function requireEnv(name: string): string {
  const v = env(name);
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

export function getSayahMode(): SayahMode {
  const m = env("PAYDISK_SAYAH_MODE").toLowerCase();
  if (m === "rest" || m === "soap" || m === "auto") return m;
  return "auto";
}

export function getSayahTatbighConfig(): SayahTatbighConfig {
  const mode = getSayahMode();
  const username = requireEnv("PAYDISK_SAYAH_USERNAME");
  const password = requireEnv("PAYDISK_SAYAH_PASSWORD");
  const userKey = env("PAYDISK_SAYAH_USER_KEY");
  const bundleId = env("PAYDISK_SAYAH_BUNDLE_ID");

  if (mode === "rest" && (!userKey || !bundleId)) {
    throw new Error(
      "REST mode needs PAYDISK_SAYAH_USER_KEY and PAYDISK_SAYAH_BUNDLE_ID",
    );
  }
  if (mode === "auto" && (!userKey || !bundleId)) {
    // Still allow soap-only auto if NIX keys missing
  }

  return {
    mode,
    restBaseUrl: (
      env("PAYDISK_SAYAH_BASE_URL") || "https://gservices.nix.gov.ir"
    ).replace(/\/+$/, ""),
    soapUrl: (
      env("PAYDISK_SAYAH_SOAP_URL") ||
      "https://gsbservices.iran.gov.ir/BankMarkazi/SayahEstelam/TatbighService.svc"
    ).replace(/\?.*$/, "").replace(/\/+$/, ""),
    userKey,
    bundleId,
    username,
    password,
    caFile: env("PAYDISK_SAYAH_CA_FILE") || null,
  };
}

export function isSayahTatbighConfigured(): boolean {
  try {
    const mode = getSayahMode();
    if (!env("PAYDISK_SAYAH_USERNAME") || !env("PAYDISK_SAYAH_PASSWORD")) {
      return false;
    }
    if (mode === "rest") {
      return !!(env("PAYDISK_SAYAH_USER_KEY") && env("PAYDISK_SAYAH_BUNDLE_ID"));
    }
    // auto / soap: username+password enough (REST keys optional for auto→soap)
    return true;
  } catch {
    return false;
  }
}

export function sayahTransportStatus() {
  const mode = getSayahMode();
  const hasAuth = !!(env("PAYDISK_SAYAH_USERNAME") && env("PAYDISK_SAYAH_PASSWORD"));
  const hasNix = !!(env("PAYDISK_SAYAH_USER_KEY") && env("PAYDISK_SAYAH_BUNDLE_ID"));
  return {
    mode,
    configured: isSayahTatbighConfigured(),
    restReady: hasAuth && hasNix,
    soapReady: hasAuth,
    caFile: env("PAYDISK_SAYAH_CA_FILE") || null,
  };
}

/** Normalize Sheba to IR + 24 digits (26 chars). */
export function normalizeShebaId(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  let s = String(raw).trim().toUpperCase().replace(/\s+/g, "");
  if (!s) return null;
  if (s.startsWith("IR")) {
    s = "IR" + s.slice(2).replace(/\D/g, "");
  } else {
    s = "IR" + s.replace(/\D/g, "");
  }
  if (s.length !== 26) return null;
  if (!/^IR\d{24}$/.test(s)) return null;
  return s;
}

export function normalizeNationalId(
  raw: string | null | undefined,
): string | null {
  if (raw == null) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length !== 10) return null;
  return digits;
}

function basicAuthHeader(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

function dig(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

function loadCa(): Buffer | undefined {
  const path = env("PAYDISK_SAYAH_CA_FILE");
  if (!path) return undefined;
  try {
    return readFileSync(path);
  } catch {
    return undefined;
  }
}

type HttpResult = { status: number; text: string; headers: http.IncomingHttpHeaders };

/** Low-level HTTPS request so we can attach CBI CA without NODE_EXTRA_CA_CERTS. */
function sayahHttp(
  urlStr: string,
  opts: {
    method: string;
    headers: Record<string, string>;
    body?: string;
    timeoutMs: number;
  },
): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const isHttps = u.protocol === "https:";
    const ca = loadCa();
    const lib = isHttps ? https : http;
    const req = lib.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || (isHttps ? 443 : 80),
        path: `${u.pathname}${u.search}`,
        method: opts.method,
        headers: opts.headers,
        timeout: opts.timeoutMs,
        ...(isHttps
          ? {
              rejectUnauthorized: true,
              ...(ca ? { ca } : {}),
            }
          : {}),
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        res.on("end", () => {
          resolve({
            status: res.statusCode || 0,
            text: Buffer.concat(chunks).toString("utf8"),
            headers: res.headers,
          });
        });
      },
    );
    req.on("timeout", () => {
      req.destroy(new Error("timeout"));
    });
    req.on("error", reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

function isTransportFailure(result: SayahMatchResult): boolean {
  if (result.matched != null && !result.hasError) return false;
  const msg = (result.message || "").toLowerCase();
  return (
    result.statusCode == null ||
    /timeout|مهلت|econnrefused|enotfound|fetch failed|network|socket|tls|cert|unable to verify/i.test(
      msg,
    ) ||
    (result.statusCode != null && result.statusCode >= 502)
  );
}

function normalizeIds(req: SayahMatchRequest): {
  shebaId: string | null;
  nationalId: string;
  legalId: string;
  invalid?: SayahMatchResult;
} {
  const shebaId = normalizeShebaId(req.shebaId);
  if (!shebaId) {
    return {
      shebaId: null,
      nationalId: "",
      legalId: "0",
      invalid: {
        ok: false,
        matched: null,
        hasError: true,
        statusCode: null,
        message: "شبا نامعتبر (باید IR + ۲۴ رقم باشد)",
        errors: [{ ErrorCd: "11", ErrorDsc: "shebaId" }],
      },
    };
  }
  const nationalId =
    req.accountOwnerType === "1"
      ? normalizeNationalId(req.nationalId) || "0"
      : String(req.nationalId || "0");
  const legalId =
    req.accountOwnerType === "1"
      ? "0"
      : String(req.legalId || req.nationalId || "0");
  return { shebaId, nationalId, legalId };
}

function parseBoolish(v: unknown): boolean | null {
  if (v == null) return null;
  const s = String(v).trim().toLowerCase();
  if (s === "true" || s === "1") return true;
  if (s === "false" || s === "0") return false;
  return null;
}

/** NIX GSB REST — CustomerHasShebaId */
export async function customerHasShebaIdRest(
  req: SayahMatchRequest,
  opts?: { timeoutMs?: number },
): Promise<SayahMatchResult> {
  const cfg = getSayahTatbighConfig();
  if (!cfg.userKey || !cfg.bundleId) {
    return {
      ok: false,
      matched: null,
      hasError: true,
      statusCode: null,
      message: "کلید NIX (USER_KEY / bundle-id) تنظیم نشده",
      errors: [],
      transport: "rest",
    };
  }

  const ids = normalizeIds(req);
  if (ids.invalid) return { ...ids.invalid, transport: "rest" };

  const url = `${cfg.restBaseUrl}/ctx/gw/cbiir/tatbigh/1.0/SayahEstelam/CustomerHasShebaId`;
  const body = JSON.stringify({
    accountOwnerType: req.accountOwnerType,
    nationalId: ids.nationalId,
    legalId: ids.legalId,
    shebaId: ids.shebaId,
  });

  try {
    const res = await sayahHttp(url, {
      method: "POST",
      timeoutMs: opts?.timeoutMs ?? 30_000,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Content-Length": String(Buffer.byteLength(body)),
        USER_KEY: cfg.userKey,
        "bundle-id": cfg.bundleId,
        X_Authorization: basicAuthHeader(cfg.username, cfg.password),
      },
      body,
    });

    let json: unknown = null;
    try {
      json = res.text ? JSON.parse(res.text) : null;
    } catch {
      return {
        ok: false,
        matched: null,
        hasError: true,
        statusCode: res.status,
        message: `پاسخ غیر JSON از سیاح REST (HTTP ${res.status})`,
        errors: [{ ErrorDsc: res.text.slice(0, 200) }],
        transport: "rest",
        raw: res.text.slice(0, 500),
      };
    }

    const gatewayStatus = dig(json, ["status", "statusCode"]);
    const gatewayMsg = dig(json, ["status", "message"]);
    const result = dig(json, [
      "result",
      "data",
      "CustomerHasShebaIdResponse",
      "CustomerHasShebaIdResult",
    ]) as Record<string, unknown> | undefined;

    const hasError =
      parseBoolish(result?.HasError) === true ||
      String(result?.HasError).toLowerCase() === "true";
    const matched = parseBoolish(result?.ReturnValue);

    const errors: Array<{ ErrorCd?: string; ErrorDsc?: string }> = [];
    const errorsRaw = result?.Errors;
    if (Array.isArray(errorsRaw)) {
      for (const e of errorsRaw) {
        if (e && typeof e === "object") {
          errors.push({
            ErrorCd: String((e as { ErrorCd?: unknown }).ErrorCd ?? ""),
            ErrorDsc: String((e as { ErrorDsc?: unknown }).ErrorDsc ?? ""),
          });
        }
      }
    }

    if (res.status < 200 || res.status >= 300) {
      return {
        ok: false,
        matched: null,
        hasError: true,
        statusCode: Number(gatewayStatus) || res.status,
        message: String(gatewayMsg || `HTTP ${res.status}`),
        errors,
        transport: "rest",
        raw: json,
      };
    }

    return {
      ok: !hasError && matched != null,
      matched,
      hasError,
      statusCode: Number(gatewayStatus) || res.status,
      message: String(
        gatewayMsg || (matched ? "تطبیق دارد (REST)" : "تطبیق ندارد (REST)"),
      ),
      errors,
      transport: "rest",
      raw: json,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      matched: null,
      hasError: true,
      statusCode: null,
      message: /timeout/i.test(msg) ? "مهلت پاسخ سیاح REST تمام شد" : msg,
      errors: [],
      transport: "rest",
    };
  }
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function xmlTag(xml: string, localName: string): string | null {
  const re = new RegExp(
    `<(?:[\\w.-]+:)?${localName}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?${localName}>`,
    "i",
  );
  const m = xml.match(re);
  return m ? m[1].trim() : null;
}

function xmlAllErrors(xml: string): Array<{ ErrorCd?: string; ErrorDsc?: string }> {
  const out: Array<{ ErrorCd?: string; ErrorDsc?: string }> = [];
  const re =
    /<(?:[\w.-]+:)?Error(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w.-]+:)?Error>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const block = m[1] || "";
    out.push({
      ErrorCd: xmlTag(block, "ErrorCd") || undefined,
      ErrorDsc: xmlTag(block, "ErrorDsc") || undefined,
    });
  }
  return out;
}

/**
 * IT.org / CBI SOAP — TatbighService.CustomerHasShebaId
 * Spec: راهنمای سرویس (gsbservices.iran.gov.ir … TatbighService.svc)
 */
export async function customerHasShebaIdSoap(
  req: SayahMatchRequest,
  opts?: { timeoutMs?: number },
): Promise<SayahMatchResult> {
  const cfg = getSayahTatbighConfig();
  const ids = normalizeIds(req);
  if (ids.invalid) return { ...ids.invalid, transport: "soap" };

  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Body>
    <CustomerHasShebaId xmlns="http://tempuri.org/">
      <accountOwnerType>${xmlEscape(req.accountOwnerType)}</accountOwnerType>
      <nationalId>${xmlEscape(ids.nationalId)}</nationalId>
      <legalId>${xmlEscape(ids.legalId)}</legalId>
      <shebaId>${xmlEscape(ids.shebaId!)}</shebaId>
    </CustomerHasShebaId>
  </s:Body>
</s:Envelope>`;

  const soapActions = [
    "http://tempuri.org/ITatbighService/CustomerHasShebaId",
    "http://tempuri.org/TatbighService/CustomerHasShebaId",
    "http://tempuri.org/CustomerHasShebaId",
  ];

  let last: SayahMatchResult | null = null;

  for (const soapAction of soapActions) {
    try {
      const res = await sayahHttp(cfg.soapUrl, {
        method: "POST",
        timeoutMs: opts?.timeoutMs ?? 30_000,
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction: `"${soapAction}"`,
          Authorization: basicAuthHeader(cfg.username, cfg.password),
          "Content-Length": String(Buffer.byteLength(envelope)),
        },
        body: envelope,
      });

      if (res.status === 500 && /SOAPAction|ActionNotSupported/i.test(res.text)) {
        last = {
          ok: false,
          matched: null,
          hasError: true,
          statusCode: res.status,
          message: `SOAPAction نامعتبر: ${soapAction}`,
          errors: [],
          transport: "soap",
          raw: res.text.slice(0, 400),
        };
        continue;
      }

      if (res.status === 401 || res.status === 403) {
        return {
          ok: false,
          matched: null,
          hasError: true,
          statusCode: res.status,
          message:
            res.status === 401
              ? "احراز هویت SOAP ناموفق (401) — نام کاربری/رمز"
              : "دسترسی SOAP رد شد (403) — مجوز دستگاه/کاربر",
          errors: [],
          transport: "soap",
          raw: res.text.slice(0, 400),
        };
      }

      const fault = xmlTag(res.text, "faultstring") || xmlTag(res.text, "Fault");
      if (fault && res.status >= 400) {
        return {
          ok: false,
          matched: null,
          hasError: true,
          statusCode: res.status,
          message: `SOAP Fault: ${fault.slice(0, 200)}`,
          errors: [],
          transport: "soap",
          raw: res.text.slice(0, 800),
        };
      }

      // Prefer nested boolResponse / CustomerHasShebaIdResult
      const resultBlock =
        xmlTag(res.text, "CustomerHasShebaIdResult") ||
        xmlTag(res.text, "CustomerHasShebaIdResponse") ||
        xmlTag(res.text, "boolResponse") ||
        res.text;

      const returnRaw =
        xmlTag(resultBlock, "ReturnValue") || xmlTag(res.text, "ReturnValue");
      const hasErrorRaw =
        xmlTag(resultBlock, "HasError") || xmlTag(res.text, "HasError");
      const matched = parseBoolish(returnRaw);
      const hasError = parseBoolish(hasErrorRaw) === true;
      const errors = xmlAllErrors(res.text);

      if (matched == null && res.status >= 400) {
        last = {
          ok: false,
          matched: null,
          hasError: true,
          statusCode: res.status,
          message: `پاسخ SOAP نامعتبر (HTTP ${res.status})`,
          errors,
          transport: "soap",
          raw: res.text.slice(0, 800),
        };
        continue;
      }

      return {
        ok: !hasError && matched != null,
        matched,
        hasError,
        statusCode: res.status,
        message: matched
          ? "تطبیق دارد (SOAP)"
          : hasError
            ? errors[0]?.ErrorDsc || "خطای سیاح SOAP"
            : "تطبیق ندارد (SOAP)",
        errors,
        transport: "soap",
        raw: res.text.slice(0, 1200),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      last = {
        ok: false,
        matched: null,
        hasError: true,
        statusCode: null,
        message: /timeout/i.test(msg) ? "مهلت پاسخ سیاح SOAP تمام شد" : msg,
        errors: [],
        transport: "soap",
      };
      // Network failure — no point trying other SOAPActions
      break;
    }
  }

  return (
    last || {
      ok: false,
      matched: null,
      hasError: true,
      statusCode: null,
      message: "فراخوانی SOAP سیاح ناموفق",
      errors: [],
      transport: "soap",
    }
  );
}

/**
 * Unified match: REST preferred, SOAP fallback (auto), or forced mode.
 */
export async function customerHasShebaId(
  req: SayahMatchRequest,
  opts?: { timeoutMs?: number; mode?: SayahMode },
): Promise<SayahMatchResult> {
  const mode = opts?.mode || getSayahMode();
  const tried: SayahTransport[] = [];

  if (mode === "soap") {
    const r = await customerHasShebaIdSoap(req, opts);
    return { ...r, tried: ["soap"] };
  }

  if (mode === "rest") {
    const r = await customerHasShebaIdRest(req, opts);
    return { ...r, tried: ["rest"] };
  }

  // auto
  const cfg = getSayahTatbighConfig();
  if (cfg.userKey && cfg.bundleId) {
    tried.push("rest");
    const rest = await customerHasShebaIdRest(req, opts);
    if (!isTransportFailure(rest)) {
      return { ...rest, tried };
    }
    tried.push("soap");
    const soap = await customerHasShebaIdSoap(req, opts);
    return {
      ...soap,
      tried,
      message: soap.message
        ? `${soap.message} (پس از خطای REST: ${rest.message})`
        : soap.message,
    };
  }

  tried.push("soap");
  const soap = await customerHasShebaIdSoap(req, opts);
  return { ...soap, tried };
}

/** Sequential batch with small delay to respect GSB rate limits. */
export async function customerHasShebaIdBatch(
  items: Array<SayahMatchRequest & { id?: string | number }>,
  opts?: {
    delayMs?: number;
    timeoutMs?: number;
    limit?: number;
    mode?: SayahMode;
  },
) {
  const limit = Math.min(items.length, Math.max(1, opts?.limit ?? 50));
  const delayMs = Math.max(0, opts?.delayMs ?? 200);
  const out: Array<{
    id?: string | number;
    nationalId: string;
    shebaId: string;
    result: SayahMatchResult;
  }> = [];

  for (let i = 0; i < limit; i++) {
    const item = items[i]!;
    const result = await customerHasShebaId(item, {
      timeoutMs: opts?.timeoutMs,
      mode: opts?.mode,
    });
    out.push({
      id: item.id,
      nationalId: item.nationalId,
      shebaId: item.shebaId,
      result,
    });
    if (i < limit - 1 && delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  const mismatches = out.filter((r) => r.result.matched === false);
  const errors = out.filter((r) => r.result.hasError || !r.result.ok);
  const matches = out.filter((r) => r.result.matched === true);
  const transports = [
    ...new Set(
      out.map((r) => r.result.transport).filter(Boolean) as SayahTransport[],
    ),
  ];

  return {
    checked: out.length,
    matchCount: matches.length,
    mismatchCount: mismatches.length,
    errorCount: errors.length,
    transports,
    rows: out,
    mismatches,
    errors,
  };
}
