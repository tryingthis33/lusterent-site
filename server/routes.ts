import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { sql, eq, and, gte, desc } from "drizzle-orm";
import { api } from "@shared/routes";
import { z } from "zod";
import { sendInvestmentInquiryNotification, sendLentCreditApplicationNotification, sendApplicationDecisionEmail } from "./email";
import { inquiryInputSchema, rejectReason, clientIp } from "./inquiryGuard";
import { getLentCreditProvider } from "./lentCredit/paymentProvider";
import { encrypt, last4 } from "./lentCredit/encryption";
import { audit, actorFromReq } from "./lentCredit/audit";
import { getIdentityProvider } from "./lentCredit/identity";
import { getMembershipProvider } from "./lentCredit/membershipProvider";
import { generateStatements, generateMetro2Report, transmitMetro2Report } from "./lentCredit/service";
import { creditAccounts, creditTransactions, getBuilderTier, insertCreditApplicationSchema, creditApplicationSubmissionSchema, enrollBuilderSchema, generateMetro2Schema, simulateSpendingSchema, makePaymentSchema, adminUpdateCreditApplicationSchema, adminUpdateCreditAccountSchema, LENT_CREDIT_TIERS, BUILDER_MEMBERSHIP_FEE_CENTS, PUBLIC_CREDIT_APPLICATION_FIELDS, type CreditApplication, type PublicCreditApplication, type AdminCreditApplication, type CreditTransaction } from "@shared/schema";
import { isAuthenticated, authStorage } from "./replit_integrations/auth";
import { users } from "@shared/models/auth";
import { updateUserRoleSchema } from "@shared/routes";
import type { Request, Response, NextFunction } from "express";
import { registerPortfolioRestoreRoutes } from "./portfolioRestore";

const ADMIN_EMAILS_DEFAULT = ["lusterent@gmail.com"];
function getAdminEmails(): string[] {
  const env = process.env.ADMIN_EMAILS;
  if (!env) return ADMIN_EMAILS_DEFAULT;
  return env.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}
async function isUserAdmin(req: Request): Promise<boolean> {
  const sub = (req.user as { claims?: { sub?: string; email?: string } } | undefined)?.claims?.sub;
  if (!sub) return false;
  // DB role is the source of truth. The env allowlist is a bootstrap-only
  // fallback used when the user has no persisted record yet; once a DB record
  // exists, its role is enforced exclusively (a portal revocation sticks).
  const u = await authStorage.getUser(sub);
  if (u?.role === "admin") return true;
   if (process.env.VERCEL) return false;
  const claimEmail = (req.user as { claims?: { email?: string } } | undefined)?.claims?.email?.toLowerCase();
  const email = (u?.email ?? claimEmail)?.toLowerCase();
  if (!email || !getAdminEmails().includes(email)) return false;
  // Bootstrap only: the env allowlist applies solely while no DB admin exists.
  // Once any admin is persisted, DB roles are enforced exclusively, so a
  // portal revocation of an env-listed email sticks.
  const [{ count }] = (await db.execute(sql`SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin'`)).rows as { count: number }[];
  if (count > 0) return false;
  if (u) {
    await db.execute(sql`UPDATE users SET role = 'admin' WHERE id = ${u.id}`);
  }
  return true;
}
const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  if (!(req as any).isAuthenticated || !(req as any).isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  if (!(await isUserAdmin(req))) {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
};
function toAdminApplication(app: CreditApplication): AdminCreditApplication {
  const { ssn, dateOfBirth, ...rest } = app;
  return { ...rest, ssnLast4: rest.ssnLast4 || "----" };
}

const SITES = [
  { name: "Pawn Coin ($Pc)", url: "https://PawnCoinPC.com", category: "FINTECH", description: "Professional-grade cryptocurrency exchange platform.", marketCap: "$0", revenue: "$0", growth: "0%" },
  { name: "Lusters Life Changing LLC", url: "https://LustersLifeChanging.com", category: "FINANCIAL SERVICES", description: "Comprehensive credit repair and financial guidance.", marketCap: "$0", revenue: "$0", growth: "0%" },
  { name: "WeParlay", url: "https://Weparlay.io", category: "IGAMING", description: "Premier sports betting and AI-driven analytics.", marketCap: "$0", revenue: "$0", growth: "0%" },
  { name: "King Engine", url: "https://KingEngine.online", category: "SPORTS ANALYTICS", description: "Sports picks engine: odds, simulations and daily picks.", marketCap: "$0", revenue: "$0", growth: "0%" },
  { name: "Tradeline Listings", url: "https://TradelineListings.com", category: "FINTECH", description: "Improve credit scores with tradeline marketplaces.", marketCap: "$0", revenue: "$0", growth: "0%" },
  { name: "Affiliate Found", url: "https://AffiliatesFound.com", category: "MARKETING", description: "Performance marketing and affiliate connections.", marketCap: "$0", revenue: "$0", growth: "0%" },
  { name: "QR My Business Card", url: "https://QRMyBusinessCard.com", category: "DIGITAL", description: "Modern networking with QR business cards.", marketCap: "$0", revenue: "$0", growth: "0%" },
  { name: "Vapp TV", url: "https://VappTv.com", category: "MEDIA", description: "Exclusive streaming and original programming.", marketCap: "$0", revenue: "$0", growth: "0%" },
  { name: "People On Podcast", url: "https://PeopleOnPodcasts.com", category: "MEDIA", description: "Connecting visionaries with global audiences.", marketCap: "$0", revenue: "$0", growth: "0%" },
  { name: "Divine Tarots", url: "https://Divinetarots.com", category: "WELLNESS", description: "Professional spiritual guidance.", marketCap: "$0", revenue: "$0", growth: "0%" },
  { name: "Date Character", url: "https://DateCharacter.com", category: "SOCIAL", description: "Personality-driven dating platform.", marketCap: "$0", revenue: "$0", growth: "0%" },
  { name: "Pc Casino", url: "https://Pccasino.online", category: "IGAMING", description: "Premium online casino experience powered by $Pc cryptocurrency.", marketCap: "$0", revenue: "$0", growth: "0%" },
  { name: "AI Assist", url: "https://Aiassis.online", category: "AI / TECHNOLOGY", description: "Premium AI assistant platform delivering intelligent automation, productivity tools, and conversational AI for businesses and individuals.", marketCap: "$0", revenue: "$0", growth: "0%" },
  { name: "Pc Travel Members", url: "https://PcTravelMembers.com", category: "TRAVEL / LIFESTYLE", description: "Exclusive members-only travel club offering luxury vacations, premium hotel rates, and curated experiences — payable in $Pc with members-only crypto pricing.", marketCap: "$0", revenue: "$0", growth: "0%" },
  { name: "Hagenz", url: "https://Hagenz.store", category: "E-COMMERCE / LIFESTYLE", description: "Premium lifestyle and apparel storefront delivering curated goods with $Pc-native checkout and instant cashback rewards.", marketCap: "$0", revenue: "$0", growth: "0%" },
  { name: "SelfMadeBeatz", url: "https://SelfMadeBeatz.com", category: "MUSIC / CREATIVE", description: "Producer-first beats marketplace where artists license original instrumentals with instant $Pc settlement and automatic royalty splits.", marketCap: "$0", revenue: "$0", growth: "0%" },
  { name: "Pc Payments", url: "https://PcPayments.online", category: "FINTECH / PAYMENTS", description: "The $PcPay merchant gateway powering checkout, settlement, and cross-portfolio rewards across every Luster Ent venture.", marketCap: "$0", revenue: "$0", growth: "0%" },
  { name: "Boot Jean Joyner", url: "https://BootJeanJoyner.com", category: "FASHION / APPAREL", description: "Premium American denim and boot label blending heritage craftsmanship with modern lifestyle drops — $Pc-native checkout.", marketCap: "$0", revenue: "$0", growth: "0%" },
  { name: "DigiPawns", url: "https://Digipawns.online", category: "FINTECH / CRYPTO", description: "Instant crypto loans against NFTs with AI-powered appraisals — payouts in 15+ currencies including Pawn Coin ($Pc), secured by audited smart contract vaults.", marketCap: "$0", revenue: "$0", growth: "0%" },
  { name: "Rubicoin", url: "https://Rubicoin.online", category: "FINTECH / CRYPTO", description: "Next-generation cryptocurrency venture in the Luster Ent digital asset portfolio — launching soon.", marketCap: "$0", revenue: "$0", growth: "0%" },
  { name: "RaceApexNow", url: "https://RaceApexNow.online", category: "SPORTS ANALYTICS", description: "Horse racing race cards, results and handicapping tools for US and international racing: official entries, morning-line odds, payoffs, race simulations and paper betting.", marketCap: "$0", revenue: "$0", growth: "0%" },
  { name: "StructifyMe", url: "https://StructifyMe.online", category: "BUSINESS SOFTWARE", description: "Business structuring platform: design legal and operational structures, organize documents and track formation tasks. Early stage.", marketCap: "$0", revenue: "$0", growth: "0%" },
];

const NEW_SITE_IMAGES: Record<string, string> = {
  DigiPawns: "/logos/digipawns.png",
  Rubicoin: "/logos/rubicoin.png",
  RaceApexNow: "/logos/raceapexnow.png",
  "Pc Payments": "/logos/pcpay.png",
  StructifyMe: "/logos/structurify.png",
};

// Owner-approved (2026-10-06): one-time, update-only fixes to existing portfolio cards: real logos instead of favicons / blank
// images, and the correct Affiliates Found address. Each fix only applies while the row still has the old value, so later
// admin-portal edits are never overwritten.
const LOGO_FIXES: Record<string, string> = {
  "Pawn Coin ($Pc)": "/logos/pawncoin.png",
  "Date Character": "/logos/date-character.png",
  "Lusters Life Changing LLC": "/logos/lusters.png",
  "King Engine": "/logos/king-engine.png",
  "Tradeline Listings": "/logos/tradeline-listings.png",
  "Affiliate Found": "/logos/affiliate-found.png",
  "QR My Business Card": "/logos/qr-card.png",
  "Vapp TV": "/logos/vapptv.png",
  "People On Podcast": "/logos/people-on-podcast.png",
  Hagenz: "/logos/hagenz.png",
};
async function applyPortfolioCardFixes() {
  for (const w of await storage.getWebsites()) {
    const patch: Partial<typeof w> = {};
    const logo = LOGO_FIXES[w.name];
    if (logo && (!w.imageUrl || w.imageUrl.includes("google.com/s2/favicons"))) patch.imageUrl = logo;
    if (w.name === "Affiliate Found" && w.url.toLowerCase() === "https://affiliatefound.com") patch.url = "https://AffiliatesFound.com";
    if (w.name === "People On Podcast" && /^https:\/\/peopleonpodcast\.com\/?$/i.test(w.url)) patch.url = "https://PeopleOnPodcasts.com";
    if (w.name === "Structurify") patch.name = "StructifyMe";
    if (Object.keys(patch).length) await storage.updateWebsite(w.id, patch);
  }
}

const BLOG_POSTS = [
  { title: "Building a portfolio of small AI-run businesses", excerpt: "Luster Ent Inc. is an early-stage portfolio company building and operating web apps and services.", category: "ANNOUNCEMENT", content: "We are launching our first products and services. Contact us for services or to discuss acquiring one of our apps: lusterent@gmail.com.", isPublished: true },
];

const JOB_OPENINGS = [
  { title: "Senior Software Engineer", department: "Technology", location: "Remote", type: "FULL-TIME", description: "Lead development of our cutting-edge digital platforms.", requirements: "5+ years experience, React, Node.js, TypeScript", isActive: true },
  { title: "Investment Analyst", department: "Finance", location: "New York, NY", type: "FULL-TIME", description: "Analyze market opportunities and evaluate potential acquisitions.", requirements: "MBA preferred, 3+ years in venture capital or private equity", isActive: true },
  { title: "Marketing Director", department: "Marketing", location: "Los Angeles, CA", type: "FULL-TIME", description: "Drive brand strategy across our portfolio of digital ventures.", requirements: "7+ years in digital marketing, experience with fintech preferred", isActive: true },
  { title: "UX/UI Designer", department: "Design", location: "Remote", type: "CONTRACT", description: "Create exceptional user experiences for our digital products.", requirements: "Strong portfolio, Figma expertise, 3+ years experience", isActive: true },
];

// Bootstrap backfill: promote env-allowlisted admin emails to the DB `admin`
// role ONLY when no admin exists yet. Once at least one DB admin exists, the
// portal is the sole source of truth — a revoked env-listed admin stays revoked.
async function backfillAdminRoles() {
  const allow = getAdminEmails();
  if (allow.length === 0) return;
  const [{ count }] = (await db.execute(sql`SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin'`)).rows as { count: number }[];
  if (count > 0) return;
  await db.execute(sql`
    UPDATE users SET role = 'admin'
    WHERE LOWER(email) IN (${sql.join(allow.map((e) => sql`${e}`), sql`, `)})
  `);
}

// Corrections that must also run on Vercel (where seeding is deliberately off). They only UPDATE existing rows, are
// idempotent, and the figures reset is guarded by a settings key so it runs once and never overwrites later admin edits.
async function applyHonestyCorrections() {
const LENT_TITLE = "LENT Credit: Coming Soon";
const LENT_EXCERPT = "We are building LENT Credit with a licensed lending partner. It is not open yet, and we are not accepting applications.";
const LENT_CONTENT = "LENT Credit is a credit-building product we plan to offer through a licensed lending partner, so that on-time payments can be reported to the credit bureaus. It is not available yet: we are not accepting applications, issuing credit, or collecting Social Security numbers at this time. When it launches, all accounts will be subject to standard underwriting and to ECOA and FCRA requirements. Questions? Email lusterent@gmail.com.";
const LENT_CARD = "Coming soon: credit-building with a licensed lending partner. Not open for applications yet.";

  const all = await storage.getWebsites();
  // Earlier text described live credit lines and bureau reporting that do not exist yet.
  for (const w of all.filter((x) => x.name === "LENT Credit" && x.description !== LENT_CARD)) await storage.updateWebsite(w.id, { description: LENT_CARD });
  // King Engine is a sports picks site; the original card called it an auto parts business.
  for (const w of all.filter((x) => x.name === "King Engine" && x.category === "AUTOMOTIVE")) {
    await storage.updateWebsite(w.id, { category: "SPORTS ANALYTICS", description: "Sports picks engine: odds, simulations and daily picks." });
  }
  // One-time correction (2026-09-25): no revenue has been earned yet, so every portfolio card shows $0, and the
  // early sample announcements (acquisition, record quarter, media partnership) that were never true are unpublished.
  // Runs once (guarded by a settings key) so later edits made in the admin portal are never overwritten.
  const FIGURES_KEY = "figures_reset_2026_09_25";
  if (!(await storage.getSettings()).some((x) => x.key === FIGURES_KEY)) {
    for (const w of await storage.getWebsites()) await storage.updateWebsite(w.id, { marketCap: "$0", revenue: "$0", growth: "0%" });
    const { blogPosts } = await import("@shared/schema");
    await db.update(blogPosts).set({ isPublished: false })
      .where(sql`${blogPosts.title} IN ('LUSTER ENT INC. Expands Fintech Portfolio', 'Q4 2025 Performance Exceeds Expectations', 'New Partnership with Leading Media Networks')`);
    // The four sample job openings were placeholders, not real hiring: hide them (kept in the database, inactive).
    const { jobOpenings } = await import("@shared/schema");
    await db.update(jobOpenings).set({ isActive: false });
    await storage.updateSetting(FIGURES_KEY, "done");
  }

  const { blogPosts } = await import("@shared/schema");
  await db.update(blogPosts).set({ title: LENT_TITLE, excerpt: LENT_EXCERPT, content: LENT_CONTENT, category: "ANNOUNCEMENT" })
    .where(and(sql`${blogPosts.title} ILIKE '%LENT Credit%'`, sql`${blogPosts.title} <> ${LENT_TITLE}`));
}

// Production-safe: inserts portfolio sites listed in NEW_SITE_IMAGES that are missing from an already-seeded database, so a newly
// finished site shows up on lusterent.com after the next deploy. Insert-only and idempotent (matched by name and by web address),
// so it never edits or duplicates existing rows, and it never seeds an empty database.
async function ensureNewPortfolioSites() {
  await applyPortfolioCardFixes();
  const all = await storage.getWebsites();
  if (all.length === 0) return;
  const hostOf = (u: string) => {
    try {
      return new URL(u).hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      return u.toLowerCase();
    }
  };
  for (const [name, imageUrl] of Object.entries(NEW_SITE_IMAGES)) {
    const site = SITES.find((x) => x.name === name);
    if (!site) continue;
    if (all.some((w) => w.name === name || hostOf(w.url) === hostOf(site.url))) continue;
    await storage.createWebsite({ ...site, imageUrl, order: SITES.indexOf(site), isVisible: true });
  }
}

async function seedDatabase() {
  const LENT_CARD = "Coming soon: credit-building with a licensed lending partner. Not open for applications yet.";
  const LENT_TITLE = "LENT Credit: Coming Soon";
  const LENT_EXCERPT = "We are building LENT Credit with a licensed lending partner. It is not open yet, and we are not accepting applications.";
  const LENT_CONTENT = "LENT Credit is a credit-building product we plan to offer through a licensed lending partner, so that on-time payments can be reported to the credit bureaus. It is not available yet: we are not accepting applications, issuing credit, or collecting Social Security numbers at this time. When it launches, all accounts will be subject to standard underwriting and to ECOA and FCRA requirements. Questions? Email lusterent@gmail.com.";
  // Seed LENT Credit portfolio entry if missing
  const all = await storage.getWebsites();
  const lentExists = all.some((w) => w.name === "LENT Credit");
  if (!lentExists) {
    await storage.createWebsite({
      name: "LENT Credit",
      url: "/lent-credit",
      category: "FINTECH",
      description: LENT_CARD,
      imageUrl: "https://www.google.com/s2/favicons?domain=lusterent.com&sz=128",
      order: 100,
      isVisible: true,
      marketCap: "$0",
      revenue: "$0",
      growth: "0%",
      status: "active",
    });
  }

  const allPosts = await storage.getBlogPosts();
  const lentPostExists = allPosts.some((p) => p.title.includes("LENT Credit"));
  if (!lentPostExists) {
    await storage.createBlogPost({ title: LENT_TITLE, excerpt: LENT_EXCERPT, content: LENT_CONTENT, category: "ANNOUNCEMENT", isPublished: true });
  }

  // Seed any newly-added SITES entries into an already-seeded database
  for (const [name, imageUrl] of Object.entries(NEW_SITE_IMAGES)) {
    if (all.length > 0 && !all.some((w) => w.name === name)) {
      const site = SITES.find((s) => s.name === name);
      if (site) {
        await storage.createWebsite({
          ...site,
          imageUrl,
          order: SITES.indexOf(site),
          isVisible: true,
        });
      }
    }
  }

  const existing = all;
  if (existing.length === 0) {
    for (let i = 0; i < SITES.length; i++) {
      const site = SITES[i];
      await storage.createWebsite({
        ...site,
        imageUrl: NEW_SITE_IMAGES[site.name] ?? `https://www.google.com/s2/favicons?domain=${site.url}&sz=128`,
        order: i,
        isVisible: true
      });
    }
    await storage.updateSetting("about_story", "LUSTER ENT INC. was founded on the principles of excellence, integrity, and relentless innovation. Our mission is to scale world-class digital assets that redefine their respective markets.");
    await storage.updateSetting("about_vision", "To be the leading holding company for digital-first enterprises across the globe.");
  }

  const existingPosts = await storage.getBlogPosts();
  if (existingPosts.length === 0) {
    for (const post of BLOG_POSTS) {
      await storage.createBlogPost(post);
    }
  }

  // No sample job openings are seeded: the Careers section only shows real openings added in the admin portal.
}

import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { setupGoogleSignIn } from "./auth/googleAdminSetup";
import { registerAudioRoutes } from "./replit_integrations/audio";
import { registerImageRoutes } from "./replit_integrations/image";

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);
  setupGoogleSignIn(app); // Continue with Google (ADMIN_EMAILS for the owner)
  registerAudioRoutes(app);
  registerImageRoutes(app);
   // A Vercel preview must not seed or bootstrap roles in the live database.
   // Existing Replit startup behavior is retained.
   if (!process.env.VERCEL) {
     seedDatabase().then(() => applyHonestyCorrections()).catch(() => console.error("Database seed failed"));
     backfillAdminRoles().catch(() => console.error("Admin bootstrap failed"));
   } else {
     // Update-only and idempotent, so it is safe on the live database (previews have no database).
     await applyHonestyCorrections().catch(() => console.error("Honesty corrections failed"));
     // Production only (never previews): add any newly finished sites to the portfolio list.
     if (process.env.VERCEL_ENV === "production") await ensureNewPortfolioSites().catch(() => console.error("Portfolio site sync failed"));
   }

  // These two are always shown first on the portfolio; the rest follow the saved order.
  const FEATURED_FIRST = ["pawncoinpc.com", "datecharacter.com"];
  const featuredRank = (url: string) => {
    let host = "";
    try {
      host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      host = url.toLowerCase();
    }
    const i = FEATURED_FIRST.indexOf(host);
    return i === -1 ? FEATURED_FIRST.length : i;
  };

  app.get(api.websites.list.path, async (req, res) => {
    const sites = await storage.getWebsites();
    // Array.prototype.sort is stable, so non-featured sites keep their saved order
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    // Logos are stored as base64 data URIs; serve them as cacheable image URLs so the list stays small.
    const slim = sites.map((x) => (x.imageUrl?.startsWith("data:") ? { ...x, imageUrl: `/api/websites/${x.id}/image` } : x));
    res.json(slim.sort((a, b) => featuredRank(a.url) - featuredRank(b.url)));
  });

  app.get("/api/websites/:id/image", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ message: "Invalid website ID" });
    const site = (await storage.getWebsites()).find((x) => x.id === id);
    const m = site?.imageUrl?.match(/^data:(image\/(?:png|jpeg|webp|gif|svg\+xml));base64,([\s\S]+)$/);
    if (!m) return res.status(404).json({ message: "Not found" });
    res.setHeader("Content-Type", m[1]);
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800");
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (m[1] === "image/svg+xml") res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'");
    res.send(Buffer.from(m[2], "base64"));
  });

  registerPortfolioRestoreRoutes(app, requireAdmin);

  app.post(api.websites.create.path, requireAdmin, async (req, res) => {
    const parsed = api.websites.create.input.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid website data" });
    res.status(201).json(await storage.createWebsite(parsed.data));
  });

  app.patch(api.websites.update.path, requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ message: "Invalid website ID" });
    const parsed = api.websites.update.input.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid website data" });
    res.json(await storage.updateWebsite(id, parsed.data));
  });

  app.delete(api.websites.delete.path, requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ message: "Invalid website ID" });
    await storage.deleteWebsite(id);
    res.status(204).send();
  });

  // Only keys the public site actually renders are exposed; internal markers (e.g. migration flags) stay private.
  const PUBLIC_SETTING_KEYS = new Set(["about_story"]);
  app.get(api.settings.list.path, async (req, res) => {
    const all = await storage.getSettings();
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    res.json(all.filter((x) => PUBLIC_SETTING_KEYS.has(x.key)));
  });

  app.post(api.settings.update.path, requireAdmin, async (req, res) => {
    res.json(await storage.updateSetting(req.body.key, req.body.value));
  });

  app.post(api.investments.create.path, async (req, res) => {
    const parsed = inquiryInputSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Please check your name and email." });
    const reason = await rejectReason(parsed.data, clientIp(req.headers, req.ip));
    if (reason) {
      console.log(`Inquiry dropped (${reason})`);
      return res.status(201).json({ ok: true }); // same answer as a real one, so bots learn nothing
    }
    const { website: _hp, elapsedMs: _t, ...fields } = parsed.data;
    const inquiry = await storage.createInvestmentInquiry(fields);

    // Notify the owner only. No auto-reply to the submitted address: bots type in
    // fake or stolen addresses, and those replies came back as bounce emails.
    await sendInvestmentInquiryNotification(fields).catch(() => console.error("Investment notification failed"));

    res.status(201).json(inquiry);
  });

  app.get(api.blogPosts.list.path, async (req, res) => {
    res.json((await storage.getBlogPosts()).filter((p) => p.isPublished !== false)); // unpublished posts stay hidden
  });

  app.post(api.blogPosts.create.path, requireAdmin, async (req, res) => {
    res.status(201).json(await storage.createBlogPost(req.body));
  });

  app.get(api.jobOpenings.list.path, async (req, res) => {
    res.json((await storage.getJobOpenings()).filter((j) => j.isActive !== false));
  });

  app.post(api.jobOpenings.create.path, requireAdmin, async (req, res) => {
    res.status(201).json(await storage.createJobOpening(req.body));
  });

  // ----- LENT Credit -----
  // Build a strict public DTO for credit applications. ALL KYC/PII fields
  // (SSN, DOB, full name, email, phone, address, employment, income) are
  // intentionally excluded from any API response after submission.
  const toPublicApplication = (
    app: CreditApplication | undefined | null,
  ): PublicCreditApplication | null => {
    if (!app) return null;
    const out = {} as Record<keyof PublicCreditApplication, unknown>;
    for (const key of PUBLIC_CREDIT_APPLICATION_FIELDS) {
      out[key] = app[key];
    }
    return out as PublicCreditApplication;
  };

  // LENT Credit is not live: no lender or bureau reporting partner is connected yet, so the product is closed.
  // (Set LENT_CREDIT_OPEN=true only once a real, licensed partner is wired in.)
  const lentOpen = () => process.env.LENT_CREDIT_OPEN === "true";
  const requireLentOpen = (_req: Request, res: Response, next: NextFunction) =>
    lentOpen() ? next() : res.status(503).json({ message: "LENT Credit is coming soon and is not accepting applications yet." });
  app.get("/api/lent-credit/status", (_req, res) => res.json({ open: lentOpen() }));

  app.post(api.lentCredit.submitApplication.path, requireLentOpen, async (req, res) => {
    try {
      const { consentSignature, consentAccepted, ...appData } =
        creditApplicationSubmissionSchema.parse(req.body);
      const claims = (req.user as { claims?: { sub?: string } } | undefined)?.claims;
      const userId: string | null = claims?.sub ?? null;
      const { ipAddress } = actorFromReq(req);
      const userAgent = req.headers["user-agent"] ?? null;

      // Encrypt PII at rest; keep only last 4 of SSN for display.
      const ssnLast4 = last4(appData.ssn);
      const created = await storage.createCreditApplication({
        ...appData,
        ssn: encrypt(appData.ssn),
        dateOfBirth: encrypt(appData.dateOfBirth),
        userId,
      });

      // Capture e-sign consents (FCRA/ECOA/E-SIGN).
      for (const consentType of ["credit_terms", "esign_disclosure", "credit_report_authorization"] as const) {
        await storage.createConsentRecord({
          userId,
          applicationId: created.id,
          consentType,
          documentVersion: "v1",
          signature: consentSignature,
          ipAddress,
          userAgent,
        });
      }

      // Run identity verification (KYC/IDV) on the plaintext SSN.
      let identityStatus = "pending";
      let identityRef: string | null = null;
      try {
        const idv = await getIdentityProvider().verify(created, appData.ssn);
        identityStatus = idv.status;
        identityRef = idv.ref;
      } catch (e) {
        console.error("Identity verification error:", e);
      }

      const updated = await storage.updateCreditApplication(created.id, {
        ssnLast4,
        identityStatus,
        identityRef,
      });

      await audit({
        actorId: userId,
        actorType: userId ? "user" : "system",
        action: "application.submitted",
        entityType: "credit_application",
        entityId: created.id,
        metadata: { identityStatus, track: updated.track },
        ipAddress,
      });

      await sendLentCreditApplicationNotification({
        id: updated.id,
        firstName: updated.firstName,
        lastName: updated.lastName,
        email: updated.email,
        phone: updated.phone,
        requestedTier: updated.requestedTier,
        requestedLimitCents: updated.requestedLimitCents,
        annualIncome: updated.annualIncome,
        primarySpendingBusiness: updated.primarySpendingBusiness,
        city: updated.city,
        state: updated.state,
        status: updated.status,
      }).catch(() => console.error("Application notification failed"));

      res.status(201).json(toPublicApplication(updated));
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: err.errors });
      }
      console.error("LENT Credit application error:", err);
      res.status(500).json({ message: "Failed to submit application" });
    }
  });

  const requireUserId = (req: Express.Request): string => {
    const sub = (req.user as { claims?: { sub?: string } } | undefined)?.claims?.sub;
    if (!sub) throw new Error("Unauthenticated request reached protected handler");
    return sub;
  };

  app.get(api.lentCredit.myApplication.path, isAuthenticated, async (req, res) => {
    const userId = requireUserId(req);
    const application = await storage.getCreditApplicationByUser(userId);
    res.json(toPublicApplication(application ?? null));
  });

  app.get(api.lentCredit.myAccount.path, isAuthenticated, async (req, res) => {
    const userId = requireUserId(req);
    const account = await storage.getCreditAccountByUser(userId);
    res.json(account ?? null);
  });

  app.get(api.lentCredit.myTransactions.path, isAuthenticated, async (req, res) => {
    const userId = requireUserId(req);
    const account = await storage.getCreditAccountByUser(userId);
    if (!account) return res.json([]);
    const txs = await storage.getCreditTransactionsByAccount(account.id);
    res.json(txs);
  });

  app.post(api.lentCredit.simulateSpending.path, isAuthenticated, requireLentOpen, async (req, res) => {
    try {
      const parsed = simulateSpendingSchema.parse(req.body);
      const userId = requireUserId(req);
      const initialAccount = await storage.getCreditAccountByUser(userId);
      if (!initialAccount) return res.status(404).json({ message: "No active credit account" });

      const result = await db.transaction(async (dbTx) => {
        // Serialize charges per-account so concurrent spends can't exceed the limit.
        await dbTx.execute(sql`SELECT pg_advisory_xact_lock(${initialAccount.id})`);

        const [account] = await dbTx.select().from(creditAccounts).where(eq(creditAccounts.id, initialAccount.id));
        if (!account) return { error: { code: 404, message: "No active credit account" } };
        if (account.accountModel !== "spend") {
          return { error: { code: 403, message: "Credit-builder accounts cannot be used for spending" } };
        }
        if (account.status !== "active") return { error: { code: 403, message: "Account not active" } };

        const newBalance = account.balanceCents + parsed.amountCents;
        if (newBalance > account.limitCents) {
          return { error: { code: 400, message: "Charge would exceed credit limit" } };
        }

        const tier = LENT_CREDIT_TIERS.find((t) => t.id === account.tier) ?? LENT_CREDIT_TIERS[0];
        const rewardsEarnedPc = Math.floor((parsed.amountCents * tier.rewardsRate) / 100 / 100);

        const provider = getLentCreditProvider();
        const record = await provider.recordTransaction(
          account.externalAccountId ?? "",
          parsed.amountCents,
          parsed.merchantName,
        );
        if (rewardsEarnedPc > 0) {
          await provider.creditRewards(account.externalAccountId ?? "", rewardsEarnedPc);
        }

        const [tx] = await dbTx
          .insert(creditTransactions)
          .values({
            accountId: account.id,
            amountCents: parsed.amountCents,
            merchantName: parsed.merchantName,
            description: parsed.description ?? null,
            rewardsEarnedPc,
            externalTransactionId: record.externalTransactionId,
          })
          .returning();

        await dbTx
          .update(creditAccounts)
          .set({ balanceCents: newBalance, rewardsPc: account.rewardsPc + rewardsEarnedPc })
          .where(eq(creditAccounts.id, account.id));

        return { tx };
      });

      if ("error" in result && result.error) {
        return res.status(result.error.code).json({ message: result.error.message });
      }
      res.status(201).json(result.tx);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: err.errors });
      }
      console.error("LENT Credit spend error:", err);
      res.status(500).json({ message: "Failed to record transaction" });
    }
  });

  app.post(api.lentCredit.makePayment.path, isAuthenticated, requireLentOpen, async (req, res) => {
    try {
      const parsed = makePaymentSchema.parse(req.body);
      const userId = requireUserId(req);
      const initialAccount = await storage.getCreditAccountByUser(userId);
      if (!initialAccount) return res.status(404).json({ message: "No active credit account" });

      const result = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(${initialAccount.id})`);

        const [account] = await tx.select().from(creditAccounts).where(eq(creditAccounts.id, initialAccount.id));
        if (!account) return { status: 404 as const, body: { message: "No active credit account" } as object };
        if (account.status !== "active") return { status: 403 as const, body: { message: "Account not active" } as object };
        if (parsed.amountCents > account.balanceCents) {
          return { status: 400 as const, body: { message: "Payment exceeds current balance" } as object };
        }

        const cutoff = new Date(Date.now() - 5000);
        const [duplicate] = await tx
          .select()
          .from(creditTransactions)
          .where(
            and(
              eq(creditTransactions.accountId, account.id),
              eq(creditTransactions.type, "payment"),
              eq(creditTransactions.amountCents, parsed.amountCents),
              gte(creditTransactions.createdAt, cutoff),
            ),
          )
          .orderBy(desc(creditTransactions.createdAt))
          .limit(1);
        if (duplicate) {
          return { status: 200 as const, body: duplicate as object };
        }

        const provider = getLentCreditProvider();
        const record = await provider.recordPayment(
          account.externalAccountId ?? "",
          parsed.amountCents,
        );

        const [created] = await tx
          .insert(creditTransactions)
          .values({
            accountId: account.id,
            type: "payment",
            amountCents: parsed.amountCents,
            merchantName: "Payment - Thank You",
            description: null,
            rewardsEarnedPc: 0,
            externalTransactionId: record.externalTransactionId,
          })
          .returning();

        await tx
          .update(creditAccounts)
          .set({ balanceCents: account.balanceCents - parsed.amountCents })
          .where(eq(creditAccounts.id, account.id));

        return { status: 201 as const, body: created as object };
      });

      res.status(result.status).json(result.body);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: err.errors });
      }
      console.error("LENT Credit payment error:", err);
      res.status(500).json({ message: "Failed to process payment" });
    }
  });

  // Enroll in the paid credit-builder membership (report-only tradeline).
  app.post(api.lentCredit.enrollBuilder.path, isAuthenticated, requireLentOpen, async (req, res) => {
    try {
      const { builderTier, billingRail, consentSignature } = enrollBuilderSchema.parse(req.body);
      const ladder = getBuilderTier(builderTier);
      if (!ladder) return res.status(400).json({ message: "Unknown builder tier" });
      const userId = requireUserId(req);
      const { ipAddress } = actorFromReq(req);
      const userAgent = req.headers["user-agent"] ?? null;

      const existingMembership = await storage.getMembershipByUser(userId);
      if (existingMembership && existingMembership.status === "active") {
        return res.status(409).json({ message: "You already have an active membership" });
      }

      // Spend-line holders don't need (and can't buy) the builder membership.
      const existingAccount = await storage.getCreditAccountByUser(userId);
      if (existingAccount && existingAccount.accountModel === "spend") {
        return res.status(409).json({
          message: "You already have an approved credit line — the builder membership is not needed",
        });
      }

      const application = await storage.getCreditApplicationByUser(userId);
      const claimEmail =
        (req.user as { claims?: { email?: string } } | undefined)?.claims?.email ?? application?.email ?? "";

      await storage.createConsentRecord({
        userId,
        applicationId: application?.id ?? null,
        consentType: "membership_terms",
        documentVersion: "v1",
        signature: consentSignature,
        ipAddress,
        userAgent,
      });

      // Create the report-only builder account if one doesn't exist.
      let account = existingAccount;
      if (account) {
        // Re-enrolling (e.g. after cancellation) with a possibly different tier.
        account = (await storage.updateCreditAccount(account.id, {
          tier: ladder.id,
          limitCents: ladder.reportedLimitCents,
        })) ?? account;
      } else {
        account = await storage.createCreditAccount({
          userId,
          applicationId: application?.id ?? null,
          accountModel: "builder",
          tier: ladder.id,
          limitCents: ladder.reportedLimitCents,
          balanceCents: 0,
          rewardsPc: 0,
          status: "active",
          externalAccountId: null,
        });
      }

      // Charge the first membership fee via the chosen rail.
      const charge = await getMembershipProvider().startSubscription({
        userId,
        email: claimEmail,
        monthlyFeeCents: ladder.monthlyFeeCents,
        rail: billingRail,
      });

      // user_id is unique on memberships: update the prior (canceled/past_due)
      // record on re-enrollment instead of inserting a duplicate.
      const membershipFields = {
        accountId: account.id,
        plan: "builder",
        tier: ladder.id,
        billingRail,
        status: charge.status === "succeeded" ? "active" : "past_due",
        monthlyFeeCents: ladder.monthlyFeeCents,
        stripeCustomerId: charge.customerId ?? null,
        stripeSubscriptionId: charge.subscriptionId ?? null,
        currentPeriodEnd: charge.currentPeriodEnd ?? null,
        canceledAt: null,
      };
      const membership = existingMembership
        ? await storage.updateMembership(existingMembership.id, membershipFields)
        : await storage.createMembership({ userId, ...membershipFields });

      await storage.createMembershipPayment({
        membershipId: membership.id,
        userId,
        amountCents: ladder.monthlyFeeCents,
        rail: billingRail,
        status: charge.status,
        externalRef: charge.externalRef,
        periodStart: new Date(),
        periodEnd: charge.currentPeriodEnd ?? null,
      });

      await audit({
        actorId: userId,
        actorType: "user",
        action: "membership.enrolled",
        entityType: "credit_membership",
        entityId: membership.id,
        metadata: { billingRail, builderTier: ladder.id, chargeStatus: charge.status },
        ipAddress,
      });

      res.status(201).json(membership);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: err.errors });
      }
      console.error("LENT Credit builder enrollment error:", err);
      res.status(500).json({ message: "Failed to enroll in membership" });
    }
  });

  app.get(api.lentCredit.myMembership.path, isAuthenticated, async (req, res) => {
    const userId = requireUserId(req);
    const membership = await storage.getMembershipByUser(userId);
    res.json(membership ?? null);
  });

  app.get(api.lentCredit.myStatements.path, isAuthenticated, async (req, res) => {
    const userId = requireUserId(req);
    const account = await storage.getCreditAccountByUser(userId);
    if (!account) return res.json([]);
    res.json(await storage.listStatementsByAccount(account.id));
  });

  // ----- LENT Credit Admin -----
  app.get("/api/admin/me", async (req, res) => {
    if (!(req as any).isAuthenticated || !(req as any).isAuthenticated()) {
      return res.json({ isAdmin: false });
    }
    res.json({ isAdmin: await isUserAdmin(req) });
  });

  // ----- Admin user management -----
  app.get(api.admin.listUsers.path, requireAdmin, async (_req, res) => {
    const list = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));
    res.json(list);
  });

  app.patch(api.admin.updateUserRole.path, requireAdmin, async (req, res) => {
    try {
      const { role } = updateUserRoleSchema.parse(req.body);
      const targetId = String(req.params.id);
      const selfId = (req.user as { claims?: { sub?: string } } | undefined)?.claims?.sub;
      if (role === "member" && selfId === targetId) {
        return res.status(400).json({ message: "You cannot remove your own admin access" });
      }
      const [existing] = await db.select().from(users).where(eq(users.id, targetId));
      if (!existing) return res.status(404).json({ message: "User not found" });
      const [updated] = await db
        .update(users)
        .set({ role, updatedAt: new Date() })
        .where(eq(users.id, targetId))
        .returning({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          role: users.role,
          createdAt: users.createdAt,
        });
      const { ipAddress } = actorFromReq(req);
      await audit({
        actorId: selfId ?? null,
        actorType: "admin",
        action: role === "admin" ? "admin.role_granted" : "admin.role_revoked",
        entityType: "user",
        entityId: targetId,
        metadata: { targetUserId: targetId, targetEmail: existing.email, role },
        ipAddress,
      });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: err.errors });
      }
      console.error("Admin role update error:", err);
      res.status(500).json({ message: "Failed to update role" });
    }
  });

  app.get(api.lentCredit.adminListApplications.path, requireAdmin, async (_req, res) => {
    const apps = await storage.listCreditApplications();
    res.json(apps.map(toAdminApplication));
  });

  app.patch(api.lentCredit.adminUpdateApplication.path, requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const patch = adminUpdateCreditApplicationSchema.parse(req.body);
      const existing = await storage.getCreditApplication(id);
      if (!existing) return res.status(404).json({ message: "Not found" });

      const updated = await storage.updateCreditApplication(id, patch);

      // Approving a spend-track application provisions a real spendable line.
      if (patch.status === "approved" && updated.userId && (updated.track ?? "spend") === "spend") {
        const acct = await storage.getCreditAccountByUser(updated.userId);
        if (!acct) {
          const tier = LENT_CREDIT_TIERS.find((t) => t.id === updated.requestedTier) ?? LENT_CREDIT_TIERS[0];
          await storage.createCreditAccount({
            userId: updated.userId,
            applicationId: updated.id,
            accountModel: "spend",
            tier: tier.id,
            limitCents: Math.min(updated.requestedLimitCents, tier.limitCents),
            balanceCents: 0,
            rewardsPc: 0,
            status: "active",
            openedDate: new Date(),
            externalAccountId: null,
          });
        }
      }

      const { actorId, ipAddress } = actorFromReq(req);
      await audit({
        actorId,
        actorType: "admin",
        action: `application.${patch.status ?? "updated"}`,
        entityType: "credit_application",
        entityId: id,
        metadata: { status: patch.status, track: updated.track },
        ipAddress,
      });

      // Notify the applicant: approval email, or FCRA/ECOA adverse-action notice on denial.
      if (patch.status === "approved" || patch.status === "denied") {
        await sendApplicationDecisionEmail({
          email: existing.email,
          firstName: existing.firstName,
          status: patch.status,
          track: updated.track,
        }).catch(() => console.error("Decision email failed"));
      }

      res.json(toAdminApplication(updated));
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: err.errors });
      }
      console.error("Admin update application error:", err);
      res.status(500).json({ message: "Failed to update application" });
    }
  });

  app.get(api.lentCredit.adminListAccounts.path, requireAdmin, async (_req, res) => {
    res.json(await storage.listCreditAccounts());
  });

  app.patch(api.lentCredit.adminUpdateAccount.path, requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const patch = adminUpdateCreditAccountSchema.parse(req.body);
      const existing = await storage.getCreditAccount(id);
      if (!existing) return res.status(404).json({ message: "Not found" });
      const updated = await storage.updateCreditAccount(id, patch);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: err.errors });
      }
      console.error("Admin update account error:", err);
      res.status(500).json({ message: "Failed to update account" });
    }
  });

  app.get(api.lentCredit.adminListTransactions.path, requireAdmin, async (_req, res) => {
    res.json(await storage.listRecentCreditTransactions(100));
  });

  app.get(api.lentCredit.adminListMemberships.path, requireAdmin, async (_req, res) => {
    res.json(await storage.listMemberships());
  });

  app.post(api.lentCredit.adminGenerateStatements.path, requireAdmin, async (req, res) => {
    try {
      const { actorId } = actorFromReq(req);
      const result = await generateStatements(actorId);
      res.json(result);
    } catch (err) {
      console.error("Generate statements error:", err);
      res.status(500).json({ message: "Failed to generate statements" });
    }
  });

  app.post(api.lentCredit.adminGenerateMetro2.path, requireAdmin, async (req, res) => {
    try {
      const { periodKey } = generateMetro2Schema.parse(req.body ?? {});
      const { actorId } = actorFromReq(req);
      const report = await generateMetro2Report(actorId, periodKey);
      res.status(201).json(report);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: err.errors });
      }
      console.error("Generate Metro 2 error:", err);
      res.status(500).json({ message: "Failed to generate Metro 2 file" });
    }
  });

  app.get(api.lentCredit.adminListMetro2.path, requireAdmin, async (_req, res) => {
    const reports = await storage.listMetro2Reports();
    // Omit the (potentially large) file body from the list view.
    res.json(reports.map(({ content, ...rest }) => ({ ...rest, content: "" })));
  });

  app.get(api.lentCredit.adminGetMetro2.path, requireAdmin, async (req, res) => {
    const report = await storage.getMetro2Report(Number(req.params.id));
    if (!report) return res.status(404).json({ message: "Not found" });
    res.json(report);
  });

  app.post(api.lentCredit.adminTransmitMetro2.path, requireAdmin, async (req, res) => {
    try {
      const { actorId } = actorFromReq(req);
      const updated = await transmitMetro2Report(actorId, Number(req.params.id));
      res.json(updated);
    } catch (err) {
      console.error("Transmit Metro 2 error:", err);
      res.status(500).json({ message: "Failed to transmit Metro 2 file" });
    }
  });

  app.get(api.lentCredit.adminListAuditLog.path, requireAdmin, async (_req, res) => {
    const { db } = await import("./db");
    const { creditAuditLog } = await import("@shared/schema");
    const { desc } = await import("drizzle-orm");
    const rows = await db.select().from(creditAuditLog).orderBy(desc(creditAuditLog.createdAt)).limit(200);
    res.json(rows);
  });

  app.get(api.lentCredit.adminListDisputes.path, requireAdmin, async (_req, res) => {
    res.json(await storage.listCreditDisputes());
  });

  return httpServer;
}
