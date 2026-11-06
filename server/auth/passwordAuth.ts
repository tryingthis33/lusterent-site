import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import passport from "passport";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { z } from "zod";
import { sql } from "drizzle-orm";
import type { Express, RequestHandler, Request, Response } from "express";
import { db } from "../db";
import { sendEmail } from "../email";
import { domainAcceptsMail } from "../inquiryGuard";
import { authStorage } from "../replit_integrations/auth/storage";

/**
 * Email + password login (replaces Replit Auth, which only works inside Replit).
 *
 * - The session user keeps the same shape the rest of the app already reads:
 *   { claims: { sub, email, first_name, last_name }, expires_at }.
 * - Passwords live in `user_credentials` (never in `users`).
 * - An account can only sign in after its email is verified. Verifying (or
 *   resetting a password) is also what proves ownership of an ADMIN_EMAILS
 *   address, so admin can never be claimed by simply registering an email.
 */

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const BCRYPT_ROUNDS = 12;
const MAX_FAILED_LOGINS = 5;
const LOCK_MS = 15 * 60 * 1000;
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;
const DUMMY_HASH = bcrypt.hashSync("timing-equalizer-not-a-real-password", BCRYPT_ROUNDS);

export function getSession() {
  const pgStore = connectPg(session);
  return session({
    secret: process.env.SESSION_SECRET!,
    store: new pgStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: false,
      ttl: SESSION_TTL_MS,
      tableName: "sessions",
    }),
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, secure: true, sameSite: "lax", maxAge: SESSION_TTL_MS },
  });
}

let schemaReady: Promise<void> | undefined;
function ensureAuthSchema(): Promise<void> {
  schemaReady ??= (async () => {
    await db.execute(sql`CREATE TABLE IF NOT EXISTS sessions (
      sid varchar PRIMARY KEY, sess jsonb NOT NULL, expire timestamp NOT NULL)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON sessions (expire)`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS user_credentials (
      user_id varchar PRIMARY KEY,
      password_hash varchar NOT NULL,
      email_verified_at timestamp,
      verify_token_hash varchar,
      verify_expires timestamp,
      reset_token_hash varchar,
      reset_expires timestamp,
      failed_logins integer NOT NULL DEFAULT 0,
      locked_until timestamp,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now())`);
  })().catch((err) => {
    schemaReady = undefined; // allow a retry on the next request
    throw err;
  });
  return schemaReady;
}

const normEmail = (e: string) => e.trim().toLowerCase();
const sha256 = (v: string) => crypto.createHash("sha256").update(v).digest("hex");
const newToken = () => crypto.randomBytes(32).toString("hex");
const baseUrl = () => (process.env.APP_URL || "https://www.lusterent.com").replace(/\/$/, "");
const adminEmails = () =>
  (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

type Row = Record<string, any>;
const rows = (r: { rows: unknown[] }) => r.rows as Row[];

async function findUserByEmail(email: string): Promise<Row | undefined> {
  return rows(await db.execute(sql`SELECT * FROM users WHERE LOWER(email) = ${email} LIMIT 1`))[0];
}
async function findCredentials(userId: string): Promise<Row | undefined> {
  return rows(await db.execute(sql`SELECT * FROM user_credentials WHERE user_id = ${userId}`))[0];
}

/** Grant admin to an ADMIN_EMAILS address once its owner is verified, but only
 *  while no admin exists (the same bootstrap rule the app already uses). */
async function bootstrapAdmin(userId: string, email: string | null | undefined) {
  if (!email || !adminEmails().includes(email.toLowerCase())) return;
  const [{ count }] = rows(await db.execute(sql`SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin'`));
  if (count > 0) return;
  await db.execute(sql`UPDATE users SET role = 'admin', updated_at = now() WHERE id = ${userId}`);
}

function sessionUserFor(user: Row) {
  return {
    claims: { sub: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name },
    expires_at: Math.floor((Date.now() + SESSION_TTL_MS) / 1000),
  };
}

// Small per-instance limiter for endpoints that send email (best effort on serverless).
const hits = new Map<string, number[]>();
function tooMany(req: Request, bucket: string, limit = 10, windowMs = 15 * 60 * 1000): boolean {
  const key = `${bucket}:${req.ip}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > limit;
}

function page(title: string, body: string, buttonText: string, url: string) {
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0a0a0a;color:#fff;padding:32px;border:1px solid #D4AF37">
  <h2 style="color:#D4AF37;margin-top:0">${title}</h2><p style="line-height:1.6">${body}</p>
  <p><a href="${url}" style="display:inline-block;background:#D4AF37;color:#000;padding:12px 24px;text-decoration:none;font-weight:bold">${buttonText}</a></p>
  <p style="color:#999;font-size:12px">If the button doesn't work, copy this link: ${url}</p></div>`;
}

async function sendVerification(email: string, token: string) {
  const url = `${baseUrl()}/verify-email?token=${token}`;
  return sendEmail({
    to: email,
    subject: "Verify your Luster Entertainment account",
    text: `Verify your email to finish setting up your account: ${url} (valid for 24 hours)`,
    html: page("Verify your email", "Confirm this email address to finish setting up your Luster Entertainment account. This link is valid for 24 hours.", "Verify email", url),
  });
}
async function sendReset(email: string, token: string) {
  const url = `${baseUrl()}/reset-password?token=${token}`;
  return sendEmail({
    to: email,
    subject: "Reset your Luster Entertainment password",
    text: `Reset your password: ${url} (valid for 1 hour). If you didn't ask for this, ignore this email.`,
    html: page("Reset your password", "We received a request to reset your password. This link is valid for 1 hour. If you didn't ask for this, you can ignore this email.", "Reset password", url),
  });
}

const passwordSchema = z.string().min(10, "Password must be at least 10 characters").max(128);
const registerSchema = z.object({
  email: z.string().email("Enter a valid email").max(254),
  password: passwordSchema,
  firstName: z.string().trim().max(80).optional(),
  lastName: z.string().trim().max(80).optional(),
});
const loginSchema = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(128) });
const emailOnly = z.object({ email: z.string().email().max(254) });
const tokenSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) });
const resetSchema = tokenSchema.extend({ password: passwordSchema });

const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? "Invalid request";
const fail = (res: Response, status: number, message: string, extra: object = {}) =>
  res.status(status).json({ message, ...extra });

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  await ensureAuthSchema();
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());
  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  const user = req.user as { expires_at?: number } | undefined;
  if (!req.isAuthenticated() || !user?.expires_at || Math.floor(Date.now() / 1000) > user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};

const logIn = (req: Request, user: Express.User) =>
  new Promise<void>((resolve, reject) => req.login(user, (err) => (err ? reject(err) : resolve())));
const logOut = (req: Request) =>
  new Promise<void>((resolve) => req.logout(() => req.session.destroy(() => resolve())));

export function registerAuthRoutes(app: Express): void {
  // Old Replit-login links (/api/login) now lead to the new sign-in page.
  app.get("/api/login", (_req, res) => res.redirect("/login"));
  app.get("/api/logout", async (req, res) => {
    await logOut(req);
    res.redirect("/");
  });

  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      res.json(await authStorage.getUser(req.user.claims.sub));
    } catch {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    await logOut(req);
    res.json({ ok: true });
  });

  app.post("/api/auth/register", async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, firstIssue(parsed.error));
    if (tooMany(req, "register")) return fail(res, 429, "Too many requests. Please try again later.");
    const { password, firstName, lastName } = parsed.data;
    const email = normEmail(parsed.data.email);
    // Don't mail domains that can't receive email (bot sign-ups, typos): those bounce back.
    if (!(await domainAcceptsMail(email))) return fail(res, 400, "That email address can't receive mail. Please check it.");
    const generic = "Check your email to verify your account.";
    try {
      let user = await findUserByEmail(email);
      const existing = user ? await findCredentials(user.id) : undefined;
      if (existing) {
        // Never overwrite an existing password; point the owner to reset instead.
        await sendEmail({
          to: email,
          subject: "You already have a Luster Entertainment account",
          text: `Someone tried to register with this email. If it was you, sign in or reset your password at ${baseUrl()}/forgot-password`,
          html: page("You already have an account", "Someone tried to create an account with this email. If that was you, sign in or reset your password.", "Reset password", `${baseUrl()}/forgot-password`),
        }).catch(() => false);
        return res.status(202).json({ message: generic });
      }
      const createdNow = !user;
      if (!user) {
        user = rows(await db.execute(sql`
          INSERT INTO users (email, first_name, last_name) VALUES (${email}, ${firstName ?? null}, ${lastName ?? null})
          RETURNING *`))[0];
      }
      const token = newToken();
      await db.execute(sql`
        INSERT INTO user_credentials (user_id, password_hash, verify_token_hash, verify_expires)
        VALUES (${user.id}, ${await bcrypt.hash(password, BCRYPT_ROUNDS)}, ${sha256(token)}, ${new Date(Date.now() + VERIFY_TTL_MS)})`);
      if (!(await sendVerification(email, token))) {
        await db.execute(sql`DELETE FROM user_credentials WHERE user_id = ${user.id}`);
        if (createdNow) await db.execute(sql`DELETE FROM users WHERE id = ${user.id}`);
        return fail(res, 503, "Unable to send the verification email right now. Please try again later.");
      }
      res.status(202).json({ message: generic });
    } catch (err) {
      console.error("Register failed", err);
      fail(res, 500, "Something went wrong. Please try again.");
    }
  });

  app.post("/api/auth/verify-email", async (req, res) => {
    const parsed = tokenSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, "This link is invalid or has expired.");
    try {
      const cred = rows(await db.execute(sql`
        SELECT * FROM user_credentials WHERE verify_token_hash = ${sha256(parsed.data.token)} AND verify_expires > now()`))[0];
      if (!cred) return fail(res, 400, "This link is invalid or has expired.");
      await db.execute(sql`
        UPDATE user_credentials SET email_verified_at = COALESCE(email_verified_at, now()),
          verify_token_hash = NULL, verify_expires = NULL, updated_at = now() WHERE user_id = ${cred.user_id}`);
      const user = await authStorage.getUser(cred.user_id);
      await bootstrapAdmin(cred.user_id, user?.email);
      res.json({ message: "Email verified. You can now sign in." });
    } catch (err) {
      console.error("Verify failed", err);
      fail(res, 500, "Something went wrong. Please try again.");
    }
  });

  app.post("/api/auth/resend-verification", async (req, res) => {
    const parsed = emailOnly.safeParse(req.body);
    const generic = { message: "If that account needs verification, we've sent a new link." };
    if (!parsed.success) return res.json(generic);
    if (tooMany(req, "resend", 5)) return fail(res, 429, "Too many requests. Please try again later.");
    try {
      const email = normEmail(parsed.data.email);
      const user = await findUserByEmail(email);
      const cred = user ? await findCredentials(user.id) : undefined;
      if (user && cred && !cred.email_verified_at) {
        const token = newToken();
        await db.execute(sql`UPDATE user_credentials SET verify_token_hash = ${sha256(token)},
          verify_expires = ${new Date(Date.now() + VERIFY_TTL_MS)}, updated_at = now() WHERE user_id = ${user.id}`);
        await sendVerification(email, token);
      }
    } catch (err) {
      console.error("Resend failed", err);
    }
    res.json(generic);
  });

  app.post("/api/auth/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, "Enter your email and password.");
    const invalid = () => fail(res, 401, "Invalid email or password.");
    try {
      const email = normEmail(parsed.data.email);
      const user = await findUserByEmail(email);
      const cred = user ? await findCredentials(user.id) : undefined;
      if (!user || !cred) {
        await bcrypt.compare(parsed.data.password, DUMMY_HASH); // keep timing similar
        return invalid();
      }
      if (cred.locked_until && new Date(cred.locked_until) > new Date()) {
        return fail(res, 429, "Too many failed attempts. Try again in 15 minutes or reset your password.");
      }
      if (!(await bcrypt.compare(parsed.data.password, cred.password_hash))) {
        const failed = (cred.failed_logins ?? 0) + 1;
        const lockUntil = failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCK_MS) : null;
        await db.execute(sql`UPDATE user_credentials SET failed_logins = ${lockUntil ? 0 : failed},
          locked_until = ${lockUntil}, updated_at = now() WHERE user_id = ${user.id}`);
        return invalid();
      }
      if (!cred.email_verified_at) {
        return fail(res, 403, "Please verify your email first. Check your inbox for the link.", { needsVerification: true });
      }
      await db.execute(sql`UPDATE user_credentials SET failed_logins = 0, locked_until = NULL WHERE user_id = ${user.id}`);
      await logIn(req, sessionUserFor(user) as Express.User);
      res.json(await authStorage.getUser(user.id));
    } catch (err) {
      console.error("Login failed", err);
      fail(res, 500, "Something went wrong. Please try again.");
    }
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    const generic = { message: "If an account exists for that email, a reset link is on its way." };
    const parsed = emailOnly.safeParse(req.body);
    if (!parsed.success) return res.json(generic);
    if (tooMany(req, "forgot", 5)) return fail(res, 429, "Too many requests. Please try again later.");
    try {
      const email = normEmail(parsed.data.email);
      const user = await findUserByEmail(email);
      if (user) {
        const token = newToken();
        const expires = new Date(Date.now() + RESET_TTL_MS);
        // Accounts created under the old Replit login have no password yet: give
        // them an unusable placeholder that a successful reset replaces.
        const placeholder = await bcrypt.hash(newToken(), BCRYPT_ROUNDS);
        await db.execute(sql`
          INSERT INTO user_credentials (user_id, password_hash, reset_token_hash, reset_expires)
          VALUES (${user.id}, ${placeholder}, ${sha256(token)}, ${expires})
          ON CONFLICT (user_id) DO UPDATE SET reset_token_hash = EXCLUDED.reset_token_hash,
            reset_expires = EXCLUDED.reset_expires, updated_at = now()`);
        if (!(await sendReset(email, token))) console.error("Password reset email could not be sent");
      }
    } catch (err) {
      console.error("Forgot-password failed", err);
    }
    res.json(generic);
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    const parsed = resetSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.issues.find((i) => i.path[0] === "password")?.message ?? "This link is invalid or has expired.";
      return fail(res, 400, msg);
    }
    try {
      const cred = rows(await db.execute(sql`
        SELECT * FROM user_credentials WHERE reset_token_hash = ${sha256(parsed.data.token)} AND reset_expires > now()`))[0];
      if (!cred) return fail(res, 400, "This link is invalid or has expired.");
      await db.execute(sql`
        UPDATE user_credentials SET password_hash = ${await bcrypt.hash(parsed.data.password, BCRYPT_ROUNDS)},
          email_verified_at = COALESCE(email_verified_at, now()), reset_token_hash = NULL, reset_expires = NULL,
          failed_logins = 0, locked_until = NULL, updated_at = now() WHERE user_id = ${cred.user_id}`);
      const user = await authStorage.getUser(cred.user_id);
      await bootstrapAdmin(cred.user_id, user?.email);
      res.json({ message: "Password updated. You can now sign in." });
    } catch (err) {
      console.error("Reset failed", err);
      fail(res, 500, "Something went wrong. Please try again.");
    }
  });
}
