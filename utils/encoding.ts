// encoding.ts

import { encodeHex } from "jsr:@std/encoding/hex";
 
/**
 * Hashes the password using SHA-512
 */
export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-512", data);
  return encodeHex(hashBuffer);
}