import crypto from "crypto";
import type { Express, Request, Response } from "express";

/**
 * Luster Ent shared "Sign in with Google" core (Express). One copy lives in each site as
 * server/googleAdmin.ts; each site supplies a small adapter (see tools/google-admin/README.md).
 *
 * - Visitors: Google account = profile (matched on the verified email).
 * - Admin: same sign-in, allowed only for emails in ADMIN_EMAILS (comma separated). Unset = nobody.
 * - Standard OAuth authorization-code flow. `state` + `nonce` ride in a short-lived httpOnly cookie;
 *   the code is exchanged server-to-server; the ID token's iss/aud/exp/nonce/email_verified are checked.
 *
 * Env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ADMIN_EMAILS. Optional GOOGLE_CALLBACK_URL.
 * Google Cloud Console redirect URI: https://<site>/api/auth/google/callback
 */

export interface GoogleProfile { email: string; given?: string; family?: string; picture?: string; sub: string }
export interface GoogleAdminOptions {
  /** Public origin of the site, e.g. "https://www.divinetarots.com". Falls back to the request host. */
  baseUrl?: (req: Request) => string;
  paths: { userFail: string; adminFail: string; userHome: string; adminHome: string };
  /** Find the profile for this verified Google email, creating it if new. */
  findOrCreateUser: (profile: GoogleProfile) => Promise<any>;
  /** Log the person in (session / cookie / token). May send its own response; otherwise the core redirects. */
  startSession: (req: Request, res: Response, user: any, ctx: { isAdmin: boolean; mode: "admin" | "user" }) => Promise<void> | void;
}

const COOKIE = "g_oauth";
const ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);
export const googleConfigured = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
export const adminEmails = (): string[] =>
  String(process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
export const isAdminEmail = (email: string) => adminEmails().includes(String(email).trim().toLowerCase());

const same = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

export function mountGoogleAdmin(app: Express, opts: GoogleAdminOptions) {
  const callbackUrl = (req: Request) =>
    process.env.GOOGLE_CALLBACK_URL ||
    `${(opts.baseUrl?.(req) || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "")}/api/auth/google/callback`;
  const back = (mode: string) => (mode === "admin" ? opts.paths.adminFail : opts.paths.userFail);
  const fail = (res: Response, mode: string, code: string) => {
    res.clearCookie(COOKIE, { path: "/api/auth/google" });
    res.redirect(`${back(mode)}${back(mode).includes("?") ? "&" : "?"}error=${code}`);
  };

  app.get("/api/auth/google/enabled", (_req, res) => res.json({ google: googleConfigured() }));

  app.get("/api/auth/google", (req: Request, res: Response) => {
    const mode = req.query.mode === "admin" ? "admin" : "user";
    if (!googleConfigured()) return fail(res, mode, "google_not_configured");
    const state = crypto.randomBytes(24).toString("base64url");
    const nonce = crypto.randomBytes(24).toString("base64url");
    res.cookie(COOKIE, `${state}.${nonce}.${mode}`, {
      httpOnly: true, sameSite: "lax", secure: req.secure || req.get("x-forwarded-proto") === "https", maxAge: 10 * 60 * 1000, path: "/api/auth/google",
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: callbackUrl(req), response_type: "code",
      scope: "openid email profile", state, nonce, prompt: "select_account",
    })}`);
  });

  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    const raw = String((req as any).cookies?.[COOKIE] ?? /(?:^|;\s*)g_oauth=([^;]+)/.exec(req.headers.cookie || "")?.[1] ?? "");
    const [cState, cNonce, cMode] = decodeURIComponent(raw).split(".");
    const mode: "admin" | "user" = cMode === "admin" ? "admin" : "user";
    try {
      if (!googleConfigured()) return fail(res, mode, "google_not_configured");
      const state = String(req.query.state || "");
      if (!cState || !cNonce || !state || !same(state, cState)) return fail(res, mode, "google_failed");
      if (req.query.error || typeof req.query.code !== "string") return fail(res, mode, "google_failed");

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: req.query.code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          redirect_uri: callbackUrl(req), grant_type: "authorization_code",
        }),
      });
      if (!tokenRes.ok) return fail(res, mode, "google_failed");
      const { id_token } = (await tokenRes.json()) as { id_token?: string };
      if (!id_token) return fail(res, mode, "google_failed");

      // Received straight from Google's token endpoint over TLS; still verify what it claims.
      const c = JSON.parse(Buffer.from(id_token.split(".")[1], "base64url").toString("utf8"));
      const email = String(c.email || "").trim().toLowerCase();
      if (!ISSUERS.has(c.iss) || c.aud !== process.env.GOOGLE_CLIENT_ID || !(Number(c.exp) * 1000 > Date.now()) ||
          c.nonce !== cNonce || c.email_verified !== true || !email) return fail(res, mode, "google_failed");

      const isAdmin = isAdminEmail(email);
      if (mode === "admin" && !isAdmin) return fail(res, mode, "not_admin");

      const user = await opts.findOrCreateUser({ email, given: c.given_name, family: c.family_name, picture: c.picture, sub: String(c.sub) });
      res.clearCookie(COOKIE, { path: "/api/auth/google" });
      await opts.startSession(req, res, user, { isAdmin, mode });
      if (!res.headersSent) res.redirect(mode === "admin" ? opts.paths.adminHome : opts.paths.userHome);
    } catch (err) {
      console.error("google sign-in failed:", (err as Error).message);
      if (!res.headersSent) fail(res, mode, "google_failed");
    }
  });
}
