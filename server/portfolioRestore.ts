import { createHash } from "node:crypto";
import { sql, eq } from "drizzle-orm";
import type { Express, RequestHandler } from "express";
import { z } from "zod";
import type { Website } from "@shared/schema";

/**
 * This is intentionally a small, approved manifest.  It is not derived from
 * the database and it must not grow into a general-purpose website importer.
 * In particular, the two logo-only entries are never inserted.
 */
export const PORTFOLIO_RESTORATION_MANIFEST: readonly PortfolioRestorationManifestEntry[] = [
  {
    key: "pc-travel-members",
    name: "Pc Travel Members",
    url: "https://pctravelmembers.com",
    category: "TRAVEL / LIFESTYLE",
    description:
      "Exclusive members-only travel club offering luxury vacations, premium hotel rates, and curated experiences — payable in $Pc with members-only crypto pricing.",
    imageUrl: "/logos/pctravelmembers.png",
    order: 13,
    kind: "restore",
    logoPolicy: "set",
  },
  {
    key: "pc-casino",
    name: "Pc Casino",
    url: "https://pccasino.online",
    category: "IGAMING",
    description: "Premium online casino experience powered by $Pc cryptocurrency.",
    imageUrl: "/logos/pccasino.png",
    order: 11,
    kind: "restore",
    logoPolicy: "set",
  },
  {
    key: "ai-assist",
    name: "AI Assist",
    url: "https://aiassis.online",
    category: "AI / TECHNOLOGY",
    description:
      "Premium AI assistant platform delivering intelligent automation, productivity tools, and conversational AI for businesses and individuals.",
    imageUrl: "/logos/aiassist.png",
    order: 12,
    kind: "restore",
    logoPolicy: "set",
  },
  {
    key: "boot-jean-joyner",
    name: "Boot Jean Joyner",
    url: "https://bootjeanjoyner.com",
    category: "FASHION / APPAREL",
    description:
      "Premium American denim and boot label blending heritage craftsmanship with modern lifestyle drops — $Pc-native checkout.",
    imageUrl: "/logos/bootjeanjoyner.png",
    order: 16,
    kind: "restore",
    logoPolicy: "set",
  },
  {
    key: "selfmadebeatz",
    name: "SelfMadeBeatz",
    url: "https://selfmadebeatz.com",
    category: "MUSIC / CREATIVE",
    description:
      "Producer-first beats marketplace where artists license original instrumentals with instant $Pc settlement and automatic royalty splits.",
    imageUrl: "/logos/selfmadebeatz.png",
    order: 15,
    kind: "restore",
    logoPolicy: "set",
  },
  {
    key: "hagenz",
    name: "Hagenz",
    url: "https://hagenz.online",
    category: "E-COMMERCE / LIFESTYLE",
    description:
      "Premium lifestyle and apparel storefront delivering curated goods with $Pc-native checkout and instant cashback rewards.",
    imageUrl: null,
    order: 14,
    kind: "restore",
    logoPolicy: "preserve",
  },
  {
    key: "weparlay-logo",
    name: "WeParlay",
    url: "https://weparlay.io",
    imageUrl: "/logos/weparlay.png",
    kind: "logo-fix",
    logoPolicy: "set",
  },
  {
    key: "divine-tarots-logo",
    name: "Divine Tarots",
    url: "https://divinetarots.com",
    imageUrl: "/logos/divine-tarots.png",
    kind: "logo-fix",
    logoPolicy: "set",
  },
] as const;

export interface PortfolioRestorationManifestEntry {
  readonly key: string;
  readonly name: string;
  readonly url: string;
  readonly category?: string;
  readonly description?: string;
  readonly imageUrl: string | null;
  readonly order?: number;
  readonly kind: "restore" | "logo-fix";
  readonly logoPolicy: "set" | "preserve";
}

// Keep aliases exported under descriptive names for callers and pure-helper tests.
export const APPROVED_PORTFOLIO_RESTORATION_MANIFEST =
  PORTFOLIO_RESTORATION_MANIFEST;
export const PORTFOLIO_RESTORE_MANIFEST = PORTFOLIO_RESTORATION_MANIFEST;

export const PORTFOLIO_RESTORATION_PATH =
  "/api/admin/portfolio-restoration";

const HOSTNAME_ALIASES: Record<string, string> = {
  // SITES used this historical hostname.  The approved canonical hostname is
  // hagenz.online, but an existing hagenz.store row is the same venture.
  "hagenz.store": "hagenz.online",
};

type WebsiteIdentity = Pick<
  Website,
  "id" | "name" | "url" | "description" | "imageUrl" | "category" | "isVisible" | "order"
>;

export type PortfolioRestorationWebsite = WebsiteIdentity;

export type PortfolioRestorationAction =
  | "insert"
  | "update"
  | "noop"
  | "conflict";

export interface PortfolioRestorationChange {
  key: string;
  name: string;
  action: PortfolioRestorationAction;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  changedFields: string[];
  reason?: string;
}

export interface PortfolioRestorationPlan {
  previewToken: string;
  changes: PortfolioRestorationChange[];
  warnings: string[];
  canApply: boolean;
}

/**
 * Canonical name matching is deliberately conservative about word content
 * while tolerating punctuation, casing, and whitespace differences.
 */
export function canonicalizePortfolioName(name: string): string {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function canonicalizePortfolioHostname(value: string): string {
  const candidate = value.trim();
  if (!candidate) return "";

  let hostname = candidate;
  try {
    const parsed = new URL(
      /^[a-z][a-z\d+\-.]*:\/\//i.test(candidate)
        ? candidate
        : `https://${candidate}`,
    );
    hostname = parsed.hostname;
  } catch {
    // A malformed URL cannot accidentally match a hostname.  The lower-cased
    // fallback is useful for deterministic conflict reporting.
    hostname = candidate.split("/")[0].split(":")[0];
  }

  hostname = hostname.toLowerCase().replace(/\.$/, "");
  if (hostname.startsWith("www.")) hostname = hostname.slice(4);
  return HOSTNAME_ALIASES[hostname] ?? hostname;
}

// Short aliases are convenient for consumers without weakening the canonical
// matching implementation above.
export const canonicalName = canonicalizePortfolioName;
export const canonicalHostname = canonicalizePortfolioHostname;

function compactWebsite(
  website: WebsiteIdentity,
  fields: Array<keyof WebsiteIdentity>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    result[field] = website[field] ?? null;
  }
  return result;
}

function valuesEqual(left: unknown, right: unknown): boolean {
  return left === right;
}

function findMatches(
  entry: PortfolioRestorationManifestEntry,
  websites: readonly PortfolioRestorationWebsite[],
): PortfolioRestorationWebsite[] {
  const targetName = canonicalizePortfolioName(entry.name);
  const targetHost = canonicalizePortfolioHostname(entry.url);
  const matches = websites.filter(
    (website) =>
      canonicalizePortfolioName(website.name) === targetName ||
      canonicalizePortfolioHostname(website.url) === targetHost,
  );

  // A stable order makes both previews and their hashes deterministic even if
  // a database query is changed to omit an ORDER BY in the future.
  return Array.from(
    new Map(matches.map((website) => [website.id, website])).values(),
  ).sort((a, b) => a.id - b.id);
}

function makeChange(
  entry: PortfolioRestorationManifestEntry,
  websites: readonly PortfolioRestorationWebsite[],
): PortfolioRestorationChange {
  const matches = findMatches(entry, websites);

  if (matches.length > 1) {
    return {
      key: entry.key,
      name: entry.name,
      action: "conflict",
      before: null,
      after: null,
      changedFields: [],
      reason: `Ambiguous duplicate records match ${entry.name}; no record was changed.`,
    };
  }

  const existing = matches[0];
  if (!existing && entry.kind === "logo-fix") {
    return {
      key: entry.key,
      name: entry.name,
      action: "conflict",
      before: null,
      after: null,
      changedFields: [],
      reason: `${entry.name} is not present; the approved logo repair never inserts records.`,
    };
  }

  if (!existing) {
    // The restore entries intentionally contain no marketCap, revenue, growth,
    // or other invented financial values.
    const after: Record<string, unknown> = {
      name: entry.name,
      url: entry.url,
      category: entry.category ?? null,
      description: entry.description ?? null,
      imageUrl: entry.imageUrl,
      order: entry.order ?? 0,
      isVisible: true,
    };
    return {
      key: entry.key,
      name: entry.name,
      action: "insert",
      before: null,
      after,
      changedFields: Object.keys(after),
    };
  }

  if (entry.kind === "logo-fix") {
    const before = compactWebsite(existing, ["id", "name", "url", "imageUrl"]);
    const after = {
      ...before,
      imageUrl: entry.imageUrl,
    };
    const changedFields = valuesEqual(before.imageUrl, after.imageUrl)
      ? []
      : ["imageUrl"];
    return {
      key: entry.key,
      name: entry.name,
      action: changedFields.length > 0 ? "update" : "noop",
      before,
      after,
      changedFields,
    };
  }

  const before = compactWebsite(existing, [
    "id",
    "name",
    "url",
    "imageUrl",
    "isVisible",
  ]);
  const after = {
    ...before,
    url: entry.url,
    isVisible: true,
    // Hagenz has no approved new logo.  Preserve any saved value exactly.
    imageUrl:
      entry.logoPolicy === "preserve" ? existing.imageUrl ?? null : entry.imageUrl,
  };
  const changedFields = (["url", "isVisible", "imageUrl"] as const).filter(
    (field) => !valuesEqual(before[field], after[field]),
  );
  return {
    key: entry.key,
    name: entry.name,
    action: changedFields.length > 0 ? "update" : "noop",
    before,
    after,
    changedFields,
  };
}

function planWarnings(
  changes: readonly PortfolioRestorationChange[],
): string[] {
  const warnings = [
    "Hagenz original missing from the approved asset set; no logo will be inferred.",
    "Hagenz DNS could not be verified by this restoration preview; verify hagenz.online before publishing.",
    "Divine Tarots saved logo is not independently confirmed original; review the approved replacement path.",
  ];
  const hagenz = changes.find((change) => change.key === "hagenz");
  if (!hagenz?.before) {
    warnings.push(
      "Hagenz original record is missing; restore will create hagenz.online without a logo.",
    );
  } else {
    const imageUrl = hagenz.after?.imageUrl;
    if (!imageUrl) {
      warnings.push(
        "Hagenz has no saved logo; no logo will be invented until one is supplied.",
      );
    }
  }
  return warnings;
}

/**
 * Pure diff helper.  It only plans narrow, field-level changes and never
 * performs database writes, making it safe to use from previews and tests.
 */
export function buildPortfolioRestorationPlan(
  websites: readonly PortfolioRestorationWebsite[],
): PortfolioRestorationPlan {
  const changes = PORTFOLIO_RESTORATION_MANIFEST.map((entry) =>
    makeChange(entry, websites),
  );
  const claims = new Map<number, string[]>();
  for (const entry of PORTFOLIO_RESTORATION_MANIFEST) {
    for (const record of findMatches(entry, websites)) {
      claims.set(record.id, [...(claims.get(record.id) ?? []), entry.key]);
    }
  }
  const competingKeys = new Set(
    [...claims.values()].filter(keys => keys.length > 1).flat(),
  );
  for (const change of changes) {
    if (!competingKeys.has(change.key)) continue;
    change.action = "conflict";
    change.before = null;
    change.after = null;
    change.changedFields = [];
    change.reason = "One saved record matches multiple portfolio entries. Resolve its name and URL before restoring.";
  }
  const warnings = planWarnings(changes);
  return {
    previewToken: plannedChangesToken(changes),
    changes,
    warnings,
    canApply: !changes.some((change) => change.action === "conflict"),
  };
}

// Explicit aliases keep the pure diff easy to discover for callers without
// creating a second implementation.
export const diffPortfolioRestoration = buildPortfolioRestorationPlan;
export const buildPortfolioRestorationDiff = buildPortfolioRestorationPlan;

export function plannedChangesToken(
  changes: readonly PortfolioRestorationChange[],
): string {
  return createHash("sha256").update(JSON.stringify(changes)).digest("hex");
}

export const portfolioRestorationToken = plannedChangesToken;

const restoreRequestSchema = z.object({
  confirmed: z.literal(true),
  previewToken: z.string().regex(/^[a-f0-9]{64}$/i),
});

type ApplyResult =
  | { kind: "stale"; preview: PortfolioRestorationPlan }
  | { kind: "conflict"; preview: PortfolioRestorationPlan }
  | { kind: "applied"; preview: PortfolioRestorationPlan };

function recordValue(
  change: PortfolioRestorationChange,
  field: string,
): unknown {
  return change.after?.[field];
}

/**
 * Registers both endpoints but loads db/storage lazily.  Keeping those
 * imports inside request handlers means pure diff tests do not need a
 * DATABASE_URL and cannot accidentally connect to a live database.
 */
export function registerPortfolioRestoreRoutes(
  app: Express,
  requireAdmin: RequestHandler,
): void {
  app.get(PORTFOLIO_RESTORATION_PATH, requireAdmin, async (_req, res) => {
    try {
      const { storage } = await import("./storage");
      const websites = await storage.getWebsites();
      res.json(buildPortfolioRestorationPlan(websites));
    } catch {
      console.error("Portfolio restoration preview failed");
      res
        .status(500)
        .json({ message: "Failed to prepare portfolio restoration preview" });
    }
  });

  app.post(PORTFOLIO_RESTORATION_PATH, requireAdmin, async (req, res) => {
    const parsed = restoreRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "A confirmed restoration and previewToken are required",
        errors: parsed.error.issues,
      });
    }

    try {
      const [{ db }, schema] = await Promise.all([
        import("./db"),
        import("@shared/schema"),
      ]);
      const result = await db.transaction(async (tx): Promise<ApplyResult> => {
        // Serialize this restoration against all website writes.  The lock is
        // held through the plan recheck and every insert/update below.
        await tx.execute(
          sql`LOCK TABLE websites IN SHARE ROW EXCLUSIVE MODE`,
        );
        const websites = await tx.select().from(schema.websites);
        const currentPlan = buildPortfolioRestorationPlan(websites);

        if (currentPlan.previewToken !== parsed.data.previewToken) {
          return { kind: "stale", preview: currentPlan };
        }
        if (!currentPlan.canApply) {
          return { kind: "conflict", preview: currentPlan };
        }

        for (const change of currentPlan.changes) {
          if (change.action === "noop") continue;
          const entry = PORTFOLIO_RESTORATION_MANIFEST.find(
            (candidate) => candidate.key === change.key,
          );
          if (!entry) continue;

          if (change.action === "insert") {
            // Inserts contain only approved descriptive fields and ordering;
            // all financial metrics remain database nulls.
            await tx.insert(schema.websites).values({
              name: entry.name,
              url: entry.url,
              category: entry.category,
              description: entry.description,
              imageUrl: entry.imageUrl,
              order: entry.order,
              isVisible: true,
            });
            continue;
          }

          if (change.action !== "update" || !change.before?.id) continue;
          const patch: {
            url?: string;
            imageUrl?: string | null;
            isVisible?: boolean;
          } = {};
          for (const field of change.changedFields) {
            if (field === "url") patch.url = String(recordValue(change, field));
            if (field === "imageUrl") {
              const value = recordValue(change, field);
              patch.imageUrl = typeof value === "string" ? value : null;
            }
            if (field === "isVisible") patch.isVisible = true;
          }
          if (Object.keys(patch).length > 0) {
            await tx
              .update(schema.websites)
              .set(patch)
              .where(eq(schema.websites.id, Number(change.before.id)));
          }
        }

        // Return a fresh plan so clients can immediately see that a second
        // confirmed submit would be a no-op rather than another insert.
        const websitesAfter = await tx.select().from(schema.websites);
        return {
          kind: "applied",
          preview: buildPortfolioRestorationPlan(websitesAfter),
        };
      });

      if (result.kind === "stale") {
        return res.status(409).json({
          message: "Portfolio restoration preview is stale; refresh the preview.",
          preview: result.preview,
        });
      }
      if (result.kind === "conflict") {
        return res.status(409).json({
          message: "Portfolio restoration has conflicts and was not applied.",
          preview: result.preview,
        });
      }
      return res.status(200).json({
        applied: true,
        preview: result.preview,
      });
    } catch {
      console.error("Portfolio restoration apply failed");
      return res
        .status(500)
        .json({ message: "Failed to apply portfolio restoration" });
    }
  });
}
