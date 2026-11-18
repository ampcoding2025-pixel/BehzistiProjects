import type { UserRole } from "@/lib/types";

export const SESSION_COOKIE = "paydisk_session";

export interface SessionUser {
  username: string;
  displayName: string;
  role: UserRole;
}

interface SessionPayload extends SessionUser {
  exp: number;
}

function secret() {
  return process.env.PAYDISK_SESSION_SECRET || "dev-only-paydisk-secret-change-me";
}

function toBase64Url(buf: ArrayBuffer | Uint8Array) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(s: string) {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function sign(body: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return toBase64Url(sig);
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let ok = 0;
  for (let i = 0; i < a.length; i++) ok |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return ok === 0;
}

export async function encodeSession(user: SessionUser, ttlHours = 12): Promise<string> {
  const payload: SessionPayload = {
    ...user,
    exp: Date.now() + ttlHours * 60 * 60 * 1000,
  };
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await sign(body);
  return `${body}.${sig}`;
}

export async function decodeSession(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = await sign(body);
  if (!timingSafeEqual(sig, expected)) return null;
  try {
    const json = new TextDecoder().decode(fromBase64Url(body));
    const payload = JSON.parse(json) as SessionPayload;
    if (!payload.exp || Date.now() > payload.exp) return null;
    return {
      username: payload.username,
      displayName: payload.displayName,
      role: payload.role,
    };
  } catch {
    return null;
  }
}
