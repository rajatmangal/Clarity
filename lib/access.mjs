import { timingSafeEqual } from "node:crypto";
export function sameSecret(a, b) {
  const x = Buffer.from(a || ""),
    y = Buffer.from(b || "");
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}
export function authorized(headers, env = process.env) {
  if (env.CLARITY_DESKTOP_SECRET)
    return sameSecret(
      headers.get("x-clarity-desktop"),
      env.CLARITY_DESKTOP_SECRET,
    );
  if (!env.CLARITY_PASSWORD) return true;
  const auth = headers.get("authorization") || "";
  if (!auth.startsWith("Basic ")) return false;
  const credential = Buffer.from(auth.slice(6), "base64").toString();
  const colon = credential.indexOf(":");
  return (
    colon >= 0 &&
    credential.slice(0, colon) === "clarity" &&
    sameSecret(credential.slice(colon + 1), env.CLARITY_PASSWORD)
  );
}
export function allowedOrigins(env = process.env) {
  const port = env.PORT || "4310";
  return env.CLARITY_ORIGIN
    ? [new URL(env.CLARITY_ORIGIN).origin]
    : [`http://localhost:${port}`, `http://127.0.0.1:${port}`];
}
