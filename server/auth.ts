import type { IncomingHttpHeaders } from "node:http";
import type { Environment } from "../api/src/service";

const subjectClaim =
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier";

// These headers are trustworthy ONLY behind the enabled App Service Easy Auth
// ingress, which removes/replaces caller-supplied X-MS-CLIENT-* headers.
// WEBSITE_AUTH_ENABLED and WEBSITE_SITE_NAME are read-only platform variables;
// never set them manually or use this adapter behind an untrusted/direct proxy.
export function easyAuthUser(
  headers: IncomingHttpHeaders,
  env: Environment,
): string | undefined {
  if (
    env.WEBSITE_AUTH_ENABLED?.toLowerCase() !== "true" ||
    !env.WEBSITE_SITE_NAME
  )
    return;

  const encoded = headers["x-ms-client-principal"];
  if (
    typeof encoded !== "string" ||
    !encoded ||
    encoded.length > 12_000 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)
  )
    return;
  try {
    const value: unknown = JSON.parse(
      Buffer.from(encoded, "base64").toString("utf8"),
    );
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    const principal = value as Record<string, unknown>;
    if (
      !["github", "aad"].includes(String(principal.auth_typ)) ||
      !Array.isArray(principal.claims)
    )
      return;
    const subjects = principal.claims.filter(
      (claim: unknown): claim is { typ: string; val: string } =>
        !!claim &&
        typeof claim === "object" &&
        (claim as Record<string, unknown>).typ === subjectClaim &&
        typeof (claim as Record<string, unknown>).val === "string",
    );
    if (subjects.length !== 1) return;
    const id = subjects[0].val;
    if (!id.trim() || id.length > 200 || /[\x00-\x1f\x7f]/.test(id)) return;
    return `${principal.auth_typ}:${id}`;
  } catch {
    return;
  }
}
