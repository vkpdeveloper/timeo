import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/*
 * Seals small secrets (integration tokens, short-lived sign-in cookies) with AES-256-GCM, so the
 * database and the browser only ever hold ciphertext. The key comes from ENCRYPTION_KEY; changing
 * it makes every connected app ask to reconnect. `purpose` is bound into each seal, so a value
 * sealed for one use can't be replayed as another.
 */

let key: Buffer | undefined;

function secretKey() {
  if (key) return key;
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw && process.env.NODE_ENV === "production") throw new Error("ENCRYPTION_KEY is required in production");
  return (key = createHash("sha256").update(raw ?? "timeo-development-only").digest());
}

/** JSON value → "v1.<iv>.<tag>.<ciphertext>" (base64url). */
export function seal(value: unknown, purpose: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey(), iv);
  cipher.setAAD(Buffer.from(purpose));
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return ["v1", iv, cipher.getAuthTag(), data].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

/** The sealed value, or null when it was tampered with, sealed for another purpose or with another key. */
export function unseal<T>(sealed: string | null | undefined, purpose: string): T | null {
  if (!sealed) return null;
  const [v, iv, tag, data] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !data) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", secretKey(), Buffer.from(iv, "base64url"));
    decipher.setAAD(Buffer.from(purpose));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    const plain = Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]);
    return JSON.parse(plain.toString("utf8")) as T;
  } catch {
    return null;
  }
}
