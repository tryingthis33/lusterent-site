import type { Express, Request } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { authStorage } from "../replit_integrations/auth/storage";
import { mountGoogleAdmin, isAdminEmail } from "./googleAdmin";

/**
 * "Continue with Google" for lusterent.com. One Google account = one portal profile (matched on the
 * verified email). Admin follows the site's existing rule: the DB role is the source of truth, and an
 * ADMIN_EMAILS address is promoted only while the site has no admin yet (so a role revoked in the portal
 * stays revoked). Everyone else signs in as a normal member.
 */
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function setupGoogleSignIn(app: Express) {
  mountGoogleAdmin(app, {
    paths: { userFail: "/login", adminFail: "/login", userHome: "/portal", adminHome: "/portal" },
    async findOrCreateUser(p) {
      const found = (await db.execute(sql`SELECT * FROM users WHERE lower(email) = ${p.email} LIMIT 1`)).rows[0] as any;
      let user = found;
      if (!user) {
        user = await authStorage.upsertUser({
          email: p.email, firstName: p.given ?? null, lastName: p.family ?? null, profileImageUrl: p.picture ?? null,
        } as any);
        user = { ...user, first_name: user.firstName, last_name: user.lastName };
      }
      if (isAdminEmail(p.email) && user.role !== "admin") {
        const [{ count }] = (await db.execute(sql`SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin'`)).rows as { count: number }[];
        if (count === 0) {
          await db.execute(sql`UPDATE users SET role = 'admin', updated_at = now() WHERE id = ${user.id}`);
          user.role = "admin";
        }
      }
      return user;
    },
    async startSession(req: Request, res, user, ctx) {
      // The admin door only opens for someone who really is an admin in the database.
      if (ctx.mode === "admin" && user.role !== "admin") return void res.redirect("/login?error=not_admin");
      const sessionUser = {
        claims: { sub: user.id, email: user.email, first_name: user.first_name ?? user.firstName ?? null, last_name: user.last_name ?? user.lastName ?? null },
        expires_at: Math.floor((Date.now() + SESSION_TTL_MS) / 1000),
      };
      await new Promise<void>((resolve, reject) => (req as any).login(sessionUser, (e: any) => (e ? reject(e) : resolve())));
    },
  });
}
