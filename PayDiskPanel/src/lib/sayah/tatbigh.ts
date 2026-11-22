/**
 * Central Bank Sayah — Sheba ↔ national-id match via NIX GSB gateway.
 * Spec: «وب‌سرویس تطبیق شبا به مشتری سیاح V1» (gservices.nix.gov.ir)
 */

export type SayahAccountOwnerType = "1" | "2" | "3" | "4";

export type SayahTatbighConfig = {
  baseUrl: string;
  userKey: string;
  bundleId: string;
  username: string;
  password: string;
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
  raw?: unknown;
};

function requireEnv(name: string): string {
  const v = (process.env[name] || "").trim();
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

export function getSayahTatbighConfig(): SayahTatbighConfig {
  return {
    baseUrl: (
      process.env.PAYDISK_SAYAH_BASE_URL ||
      "https://gservices.nix.gov.ir"
    ).replace(/\/+$/, ""),
    userKey: requireEnv("PAYDISK_SAYAH_USER_KEY"),
    bundleId: requireEnv("PAYDISK_SAYAH_BUNDLE_ID"),
    username: requireEnv("PAYDISK_SAYAH_USERNAME"),
    password: requireEnv("PAYDISK_SAYAH_PASSWORD"),
  };
}

export function isSayahTatbighConfigured(): boolean {
  try {
    getSayahTatbighConfig();
    return true;
  } catch {
    return false;
  }
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
  const token = Buffer.from(`${username}:${password}`, "utf8").toString(
    "base64",
  );
  return `Basic ${token}`;
}

function dig(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

/**
 * POST CustomerHasShebaId — does this Sheba belong to this national/legal id?
 */
export async function customerHasShebaId(
  req: SayahMatchRequest,
  opts?: { timeoutMs?: number },
): Promise<SayahMatchResult> {
  const cfg = getSayahTatbighConfig();
  const shebaId = normalizeShebaId(req.shebaId);
  if (!shebaId) {
    return {
      ok: false,
      matched: null,
      hasError: true,
      statusCode: null,
      message: "شبا نامعتبر (باید IR + ۲۴ رقم باشد)",
      errors: [{ ErrorCd: "11", ErrorDsc: "shebaId" }],
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

  const url = `${cfg.baseUrl}/ctx/gw/cbiir/tatbigh/1.0/SayahEstelam/CustomerHasShebaId`;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    opts?.timeoutMs ?? 30_000,
  );

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        USER_KEY: cfg.userKey,
        "bundle-id": cfg.bundleId,
        X_Authorization: basicAuthHeader(cfg.username, cfg.password),
      },
      body: JSON.stringify({
        accountOwnerType: req.accountOwnerType,
        nationalId,
        legalId,
        shebaId,
      }),
      signal: controller.signal,
    });

    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      return {
        ok: false,
        matched: null,
        hasError: true,
        statusCode: res.status,
        message: `پاسخ غیر JSON از سیاح (HTTP ${res.status})`,
        errors: [{ ErrorDsc: text.slice(0, 200) }],
        raw: text.slice(0, 500),
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

    const returnRaw = result?.ReturnValue;
    const hasErrorRaw = result?.HasError;
    const errorsRaw = result?.Errors;
    const hasError =
      String(hasErrorRaw).toLowerCase() === "true" || hasErrorRaw === true;
    const matched =
      returnRaw == null
        ? null
        : String(returnRaw).toLowerCase() === "true" || returnRaw === true;

    const errors: Array<{ ErrorCd?: string; ErrorDsc?: string }> = [];
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

    if (!res.ok) {
      return {
        ok: false,
        matched: null,
        hasError: true,
        statusCode: Number(gatewayStatus) || res.status,
        message: String(gatewayMsg || `HTTP ${res.status}`),
        errors,
        raw: json,
      };
    }

    return {
      ok: !hasError && matched != null,
      matched,
      hasError,
      statusCode: Number(gatewayStatus) || res.status,
      message: String(gatewayMsg || (matched ? "تطبیق دارد" : "تطبیق ندارد")),
      errors,
      raw: json,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      matched: null,
      hasError: true,
      statusCode: null,
      message: /abort/i.test(msg) ? "مهلت پاسخ سیاح تمام شد" : msg,
      errors: [],
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Sequential batch with small delay to respect GSB rate limits. */
export async function customerHasShebaIdBatch(
  items: Array<SayahMatchRequest & { id?: string | number }>,
  opts?: { delayMs?: number; timeoutMs?: number; limit?: number },
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

  return {
    checked: out.length,
    matchCount: matches.length,
    mismatchCount: mismatches.length,
    errorCount: errors.length,
    rows: out,
    mismatches,
    errors,
  };
}
