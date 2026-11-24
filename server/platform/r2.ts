// The workspace cache's shared copy in a private Cloudflare R2 bucket, so a deploy (dozens a day) doesn't re-download
// every workspace from Supabase, and Render can switch servers with no gap (a Render disk would rule that out).
// Each file is gzipped and sealed with AES-256-GCM (WS_CACHE_KEY) before upload: Cloudflare only ever holds ciphertext.
// Not configured (tests, local dev) → every call is a no-op. Failures never reach the student: the caller reads Supabase.
import crypto from "node:crypto";
import zlib from "node:zlib";

const env = () => {
  const { R2_ACCOUNT_ID: account, R2_BUCKET: bucket, R2_ACCESS_KEY_ID: id, R2_SECRET_ACCESS_KEY: secret, WS_CACHE_KEY: k } = process.env;
  const key = k ? Buffer.from(k, "base64") : null;
  return account && bucket && id && secret && key?.length === 32 ? { account, bucket, id, secret, key } : null;
};
export const r2Ready = () => !!env();

const hmac = (k: crypto.BinaryLike, s: string) => crypto.createHmac("sha256", k).update(s).digest();
const hash = (b: crypto.BinaryLike) => crypto.createHash("sha256").update(b).digest("hex");

/** AWS Signature V4 headers for R2's S3 API (region "auto"). */
export function signR2(method: string, host: string, path: string, body: Buffer, id: string, secret: string, now = new Date()) {
  const amzDate = now.toISOString().replace(/[-:]|\.\d{3}/g, "");
  const day = amzDate.slice(0, 8);
  const payload = hash(body);
  const signed = "host;x-amz-content-sha256;x-amz-date";
  const canonical = [method, path, "", `host:${host}`, `x-amz-content-sha256:${payload}`, `x-amz-date:${amzDate}`, "", signed, payload].join("\n");
  const scope = `${day}/auto/s3/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, hash(canonical)].join("\n");
  const kSign = ["auto", "s3", "aws4_request"].reduce((k, s) => hmac(k, s), hmac(`AWS4${secret}`, day));
  return {
    "x-amz-content-sha256": payload,
    "x-amz-date": amzDate,
    authorization: `AWS4-HMAC-SHA256 Credential=${id}/${scope}, SignedHeaders=${signed}, Signature=${hmac(kSign, toSign).toString("hex")}`,
  };
}

/** gzip + AES-256-GCM; the object name is bound in, so one student's file can't be served as another's. */
export function seal(key: Buffer, name: string, value: unknown) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key, iv).setAAD(Buffer.from(name));
  const body = Buffer.concat([c.update(zlib.gzipSync(JSON.stringify(value))), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]);
}
export function unseal(key: Buffer, name: string, buf: Buffer): any {
  const d = crypto.createDecipheriv("aes-256-gcm", key, buf.subarray(0, 12)).setAAD(Buffer.from(name));
  d.setAuthTag(buf.subarray(12, 28));
  return JSON.parse(zlib.gunzipSync(Buffer.concat([d.update(buf.subarray(28)), d.final()])).toString("utf8"));
}

async function call(method: "GET" | "PUT" | "DELETE", name: string, body = Buffer.alloc(0)) {
  const e = env();
  if (!e) return null;
  const host = `${e.account}.r2.cloudflarestorage.com`;
  const path = `/${e.bucket}/${name}`;
  const r = await fetch(`https://${host}${path}`, {
    method,
    headers: signR2(method, host, path, body, e.id, e.secret),
    body: method === "PUT" ? new Uint8Array(body) : undefined,
    signal: AbortSignal.timeout(method === "GET" ? 2000 : 5000),
  });
  if (method === "GET" && r.status === 404) return null;
  if (!r.ok) throw new Error(`R2 ${method} ${r.status}`);
  return method === "GET" ? Buffer.from(await r.arrayBuffer()) : null;
}

/** The stored value, or null when absent, not configured, unreadable or slow. */
export async function r2Get(name: string): Promise<any> {
  const e = env();
  if (!e) return null;
  try { const b = await call("GET", name); return b ? unseal(e.key, name, b) : null; }
  catch (err: any) { console.warn("ws cache read failed:", err?.message); return null; }
}
export function r2Put(name: string, value: unknown) {
  const e = env();
  if (e) call("PUT", name, seal(e.key, name, value)).catch((err) => console.warn("ws cache write failed:", err?.message));
}
export function r2Delete(name: string) {
  if (env()) call("DELETE", name).catch((err) => console.warn("ws cache delete failed:", err?.message));
}
