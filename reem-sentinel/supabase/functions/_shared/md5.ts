/** URL hash utility using Web Crypto API (SHA-256, truncated to 32 hex chars for compat). */

export async function md5(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  // Truncate to 32 hex chars (same length as MD5) for DB column compat
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}
