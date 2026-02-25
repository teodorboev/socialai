import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY || "0000000000000000000000000000000000000000000000000000000000000000", "hex");

export function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${tag}:${encrypted}`;
}

export function decrypt(encrypted: string): string {
  if (!encrypted || encrypted.split(":").length !== 3) {
    return encrypted; // Return as-is if not encrypted
  }
  try {
    const [ivHex, tagHex, content] = encrypted.split(":");
    const decipher = createDecipheriv(ALGORITHM, KEY, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    let decrypted = decipher.update(content, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return encrypted; // Return as-is if decryption fails
  }
}
