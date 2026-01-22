import crypto from "crypto";

export function okxSign(secret: string, prehash: string): string {
  return crypto.createHmac("sha256", secret).update(prehash).digest("base64");
}
