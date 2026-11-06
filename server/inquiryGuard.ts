import { z } from "zod";
import { promises as dns } from "dns";
import { db } from "./db";
import { investmentInquiries } from "@shared/schema";
import { sql, and, eq, gte } from "drizzle-orm";

// Filters bot submissions of the public inquiry form. Bots get the same 201 a
// person gets, so they have no signal to adapt to; nothing is saved or emailed.

export const inquiryInputSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(200),
  amount: z.string().trim().max(100).nullish().transform((v) => v || undefined),
  interest: z.string().trim().max(200).nullish().transform((v) => v || undefined),
  message: z.string().trim().max(3000).nullish().transform((v) => v || undefined),
  website: z.string().optional(), // honeypot, must stay empty
  elapsedMs: z.number().optional(), // time the form was open in the browser
});

export type InquiryInput = z.infer<typeof inquiryInputSchema>;

const MIN_FILL_MS = 3000;
const PER_IP_PER_HOUR = 3;
const ipHits = new Map<string, number[]>(); // best effort; resets on cold start

export function clientIp(headers: Record<string, unknown>, fallback = ""): string {
  const fwd = String(headers["x-forwarded-for"] ?? "").split(",")[0].trim();
  return fwd || String(headers["x-real-ip"] ?? "") || fallback;
}

function tooManyFromIp(ip: string): boolean {
  if (!ip) return false;
  const now = Date.now();
  const recent = (ipHits.get(ip) ?? []).filter((t) => now - t < 3600_000);
  recent.push(now);
  ipHits.set(ip, recent);
  return recent.length > PER_IP_PER_HOUR;
}

function looksLikeSpam(input: InquiryInput): boolean {
  const text = `${input.name} ${input.interest ?? ""} ${input.message ?? ""}`;
  const links = (text.match(/https?:\/\/|www\./gi) ?? []).length;
  if (links > 1) return true;
  if (/https?:\/\/|www\./i.test(input.name)) return true;
  if (/\b(seo|backlinks?|crypto recovery|casino bonus|viagra|cialis|porn|loan offer|guest post|rank your (site|website))\b/i.test(text)) return true;
  return false;
}

export async function domainAcceptsMail(email: string): Promise<boolean> {
  const domain = email.split("@")[1];
  if (!domain) return false;
  try {
    const mx = await Promise.race([
      dns.resolveMx(domain),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 3000)),
    ]);
    return mx.length > 0;
  } catch (err: any) {
    // Only a definite "no such domain / no MX" counts as fake; DNS hiccups let it through.
    return !(err?.code === "ENOTFOUND" || err?.code === "ENODATA");
  }
}

async function duplicateToday(email: string): Promise<boolean> {
  const rows = await db
    .select({ n: sql<number>`count(*)` })
    .from(investmentInquiries)
    .where(and(eq(investmentInquiries.email, email), gte(investmentInquiries.createdAt, sql`now() - interval '24 hours'`)));
  return Number(rows[0]?.n ?? 0) > 0;
}

/** Returns a reason string when the submission should be dropped, or null when it looks real. */
export async function rejectReason(input: InquiryInput, ip: string): Promise<string | null> {
  if (input.website && input.website.trim() !== "") return "honeypot";
  if (typeof input.elapsedMs !== "number") return "no-form"; // posted straight to the API, not from the page
  if (input.elapsedMs < MIN_FILL_MS) return "too-fast";
  if (tooManyFromIp(ip)) return "ip-rate";
  if (looksLikeSpam(input)) return "spam-content";
  if (!(await domainAcceptsMail(input.email))) return "no-mx";
  if (await duplicateToday(input.email)) return "duplicate";
  return null;
}
