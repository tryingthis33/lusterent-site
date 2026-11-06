import crypto from "crypto";

// AES-256-GCM column-level encryption for PII at rest (SSN, DOB).
// Ciphertext format: "enc:v1:<ivB64>:<tagB64>:<dataB64>"
// Legacy plaintext values (no prefix) are returned as-is by decrypt() so the
// system keeps working while old rows are migrated on next write.

const PREFIX = "enc:v1:";

let cachedKey: Buffer | null = null;

function getKey(): Buffer | null {
  if (cachedKey) return cachedKey;
  // Prefer a dedicated key; otherwise derive one from SESSION_SECRET so PII
  // is never stored in plaintext. Set LENT_CREDIT_ENCRYPTION_KEY before
  // rotating SESSION_SECRET, or existing ciphertext becomes unreadable.
  const raw =
    process.env.LENT_CREDIT_ENCRYPTION_KEY ||
    (process.env.SESSION_SECRET ? `lent-credit-pii:${process.env.SESSION_SECRET}` : null);
  if (!raw) return null;
  // Accept either a 64-char hex string (32 bytes) or any string we hash to 32 bytes.
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    cachedKey = Buffer.from(raw, "hex");
  } else {
    cachedKey = crypto.createHash("sha256").update(raw).digest();
  }
  return cachedKey;
}

export function isEncryptionConfigured(): boolean {
  return getKey() !== null;
}

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

export function encrypt(plaintext: string | null | undefined): string {
  if (plaintext == null) return "";
  const key = getKey();
  if (!key) {
    // Never persist PII in plaintext. Require a key (dedicated or derived).
    throw new Error(
      "PII encryption unavailable: set LENT_CREDIT_ENCRYPTION_KEY or SESSION_SECRET",
    );
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decrypt(value: string | null | undefined): string {
  if (value == null) return "";
  if (!isEncrypted(value)) return value; // legacy plaintext
  const key = getKey();
  if (!key) return "";
  const body = value.slice(PREFIX.length);
  const [ivB64, tagB64, dataB64] = body.split(":");
  if (!ivB64 || !tagB64 || !dataB64) return "";
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const dec = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
    return dec.toString("utf8");
  } catch (err) {
    console.error("LENT Credit decrypt failed:", err);
    return "";
  }
}

export function last4(value: string | null | undefined): string {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.slice(-4) || "----";
}
