import { pgTable, text, serial, integer, boolean, timestamp, varchar, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const websites = pgTable("websites", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  category: text("category").default("VENTURE"),
  isVisible: boolean("is_visible").default(true),
  order: integer("order").default(0),
  // Executive Metrics
  marketCap: text("market_cap"),
  revenue: text("revenue"),
  growth: text("growth"),
  status: text("status").default("active"),
});

export const partners = pgTable("partners", {
  id: serial("id").primaryKey(),
  replitId: text("replit_id").notNull().unique(),
  username: text("username").notNull(),
  tier: text("tier").default("standard"),
  lastActive: timestamp("last_active").defaultNow(),
});

export const executiveBriefs = pgTable("executive_briefs", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  summary: text("summary"),
  category: text("category"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const investmentInquiries = pgTable("investment_inquiries", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  amount: text("amount"),
  interest: text("interest"),
  message: text("message"),
  type: text("type").default("investment"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const companySettings = pgTable("company_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
});

export const blogPosts = pgTable("blog_posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  excerpt: text("excerpt").notNull(),
  content: text("content"),
  imageUrl: text("image_url"),
  category: text("category").default("NEWS"),
  isPublished: boolean("is_published").default(true),
  publishedAt: timestamp("published_at").defaultNow(),
});

export const jobOpenings = pgTable("job_openings", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  department: text("department").notNull(),
  location: text("location").notNull(),
  type: text("type").default("FULL-TIME"),
  description: text("description").notNull(),
  requirements: text("requirements"),
  isActive: boolean("is_active").default(true),
});

export const ventureProposals = pgTable("venture_proposals", {
  id: serial("id").primaryKey(),
  partnerId: text("partner_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  fundingRequired: text("funding_required"),
  estimatedRoi: text("estimated_roi"),
  status: text("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const LENT_CREDIT_TIERS = [
  { id: "starter", name: "Starter", limitCents: 2000, rewardsRate: 1, minIncome: 0 },
  { id: "bronze", name: "Bronze", limitCents: 500000, rewardsRate: 2, minIncome: 25000 },
  { id: "silver", name: "Silver", limitCents: 5000000, rewardsRate: 3, minIncome: 75000 },
  { id: "gold", name: "Gold", limitCents: 50000000, rewardsRate: 4, minIncome: 250000 },
  { id: "platinum", name: "Platinum", limitCents: 500000000, rewardsRate: 5, minIncome: 1000000 },
] as const;

export type LentCreditTierId = typeof LENT_CREDIT_TIERS[number]["id"];

// Track an applicant can be routed to:
//  - "spend"   => admin-approved real spendable line (no monthly fee)
//  - "builder" => paid monthly membership, tradeline reported to bureaus, no spend power
export const ACCOUNT_MODELS = ["spend", "builder"] as const;
export type AccountModel = typeof ACCOUNT_MODELS[number];

export const BILLING_RAILS = ["stripe", "pc"] as const;
export type BillingRail = typeof BILLING_RAILS[number];

// Versioned legal agreements captured at e-sign time.
export const CONSENT_TYPES = [
  "credit_terms",
  "esign_disclosure",
  "credit_report_authorization",
  "membership_terms",
] as const;
export type ConsentType = typeof CONSENT_TYPES[number];

export const BUILDER_MEMBERSHIP_FEE_CENTS = 2999; // legacy flat fee (column default / pre-ladder memberships)

// Credit-builder membership ladder: paid monthly, report-only tradeline, NO spending power.
// reportedLimitCents is the tradeline limit reported to the bureaus for that tier.
export const BUILDER_TIERS = [
  { id: "starter", name: "Starter", minLimitCents: 0, maxLimitCents: 100000, reportedLimitCents: 100000, monthlyFeeCents: 599 },
  { id: "bronze", name: "Bronze", minLimitCents: 100000, maxLimitCents: 500000, reportedLimitCents: 500000, monthlyFeeCents: 2999 },
  { id: "silver", name: "Silver", minLimitCents: 500000, maxLimitCents: 1000000, reportedLimitCents: 1000000, monthlyFeeCents: 5999 },
  { id: "gold", name: "Gold", minLimitCents: 1000000, maxLimitCents: 5000000, reportedLimitCents: 5000000, monthlyFeeCents: 12999 },
  { id: "platinum", name: "Platinum", minLimitCents: 5000000, maxLimitCents: 25000000, reportedLimitCents: 25000000, monthlyFeeCents: 19999 },
  { id: "diamond", name: "Diamond", minLimitCents: 25000000, maxLimitCents: null, reportedLimitCents: 50000000, monthlyFeeCents: 29999 },
] as const;

export type BuilderTierId = typeof BUILDER_TIERS[number]["id"];

export function getBuilderTier(id: string) {
  return BUILDER_TIERS.find((t) => t.id === id);
}

export function formatBuilderTierRange(tier: typeof BUILDER_TIERS[number]): string {
  const lo = `$${(tier.minLimitCents / 100).toLocaleString()}`;
  if (tier.maxLimitCents == null) return `${lo}+`;
  const hi = `$${(tier.maxLimitCents / 100).toLocaleString()}`;
  return tier.minLimitCents === 0 ? `up to ${hi}` : `${lo} – ${hi}`;
}

export const creditApplications = pgTable("credit_applications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  // dateOfBirth and ssn are stored ENCRYPTED at rest (see server/lentCredit/encryption.ts)
  dateOfBirth: text("date_of_birth").notNull(),
  ssn: text("ssn").notNull(),
  ssnLast4: text("ssn_last4"),
  addressLine1: text("address_line1").notNull(),
  addressLine2: text("address_line2"),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zipCode: text("zip_code").notNull(),
  employmentStatus: text("employment_status").notNull(),
  employerName: text("employer_name"),
  jobTitle: text("job_title"),
  annualIncome: integer("annual_income").notNull(),
  requestedTier: text("requested_tier").notNull(),
  requestedLimitCents: integer("requested_limit_cents").notNull(),
  primarySpendingBusiness: text("primary_spending_business"),
  // Two-track routing + identity verification.
  track: text("track").default("spend").notNull(),
  identityStatus: text("identity_status").default("unverified").notNull(),
  identityRef: text("identity_ref"),
  status: text("status").default("pending").notNull(),
  externalApplicationId: text("external_application_id"),
  decisionNotes: text("decision_notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const creditAccounts = pgTable("credit_accounts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().unique(),
  applicationId: integer("application_id"),
  // "spend" accounts can charge; "builder" accounts are report-only.
  accountModel: text("account_model").default("spend").notNull(),
  tier: text("tier").notNull(),
  limitCents: integer("limit_cents").notNull(),
  balanceCents: integer("balance_cents").default(0).notNull(),
  rewardsPc: integer("rewards_pc").default(0).notNull(),
  aprBasisPoints: integer("apr_basis_points").default(0).notNull(),
  status: text("status").default("active").notNull(),
  // Statement / delinquency tracking for Metro 2 reporting.
  openedDate: timestamp("opened_date").defaultNow(),
  statementBalanceCents: integer("statement_balance_cents").default(0).notNull(),
  minimumDueCents: integer("minimum_due_cents").default(0).notNull(),
  lastStatementDate: timestamp("last_statement_date"),
  paymentDueDate: timestamp("payment_due_date"),
  lastPaymentDate: timestamp("last_payment_date"),
  daysPastDue: integer("days_past_due").default(0).notNull(),
  // Metro 2 Base Segment account status code (11 = current/paid as agreed).
  metro2Status: text("metro2_status").default("11").notNull(),
  chargeOffDate: timestamp("charge_off_date"),
  closedDate: timestamp("closed_date"),
  externalAccountId: text("external_account_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const creditTransactions = pgTable("credit_transactions", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull(),
  type: text("type").default("charge").notNull(),
  amountCents: integer("amount_cents").notNull(),
  merchantName: text("merchant_name").notNull(),
  description: text("description"),
  rewardsEarnedPc: integer("rewards_earned_pc").default(0).notNull(),
  externalTransactionId: text("external_transaction_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Paid credit-builder membership (track = "builder").
export const creditMemberships = pgTable("credit_memberships", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().unique(),
  accountId: integer("account_id"),
  plan: text("plan").default("builder").notNull(),
  tier: text("tier").default("bronze").notNull(), // builder ladder tier id
  billingRail: text("billing_rail").notNull(), // "stripe" | "pc"
  status: text("status").default("active").notNull(), // active | past_due | canceled
  monthlyFeeCents: integer("monthly_fee_cents").default(BUILDER_MEMBERSHIP_FEE_CENTS).notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  currentPeriodEnd: timestamp("current_period_end"),
  canceledAt: timestamp("canceled_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const membershipPayments = pgTable("membership_payments", {
  id: serial("id").primaryKey(),
  membershipId: integer("membership_id").notNull(),
  userId: varchar("user_id").notNull(),
  amountCents: integer("amount_cents").notNull(),
  rail: text("rail").notNull(), // "stripe" | "pc"
  status: text("status").default("succeeded").notNull(), // succeeded | failed | pending
  externalRef: text("external_ref"),
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  createdAt: timestamp("created_at").defaultNow(),
});

// E-sign / consent capture for FCRA/ECOA/E-SIGN compliance.
export const consentRecords = pgTable("consent_records", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id"),
  applicationId: integer("application_id"),
  consentType: text("consent_type").notNull(),
  documentVersion: text("document_version").notNull(),
  signature: text("signature").notNull(), // typed legal name
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  acceptedAt: timestamp("accepted_at").defaultNow(),
});

// Append-only audit trail for every sensitive action / state change.
export const creditAuditLog = pgTable("credit_audit_log", {
  id: serial("id").primaryKey(),
  actorId: varchar("actor_id"),
  actorType: text("actor_type").default("system").notNull(), // user | admin | system
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  metadata: jsonb("metadata"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Monthly statements; the basis for delinquency / Metro 2 reporting.
export const creditStatements = pgTable("credit_statements", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull(),
  userId: varchar("user_id").notNull(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  statementDate: timestamp("statement_date").defaultNow().notNull(),
  dueDate: timestamp("due_date").notNull(),
  openingBalanceCents: integer("opening_balance_cents").default(0).notNull(),
  closingBalanceCents: integer("closing_balance_cents").default(0).notNull(),
  minimumDueCents: integer("minimum_due_cents").default(0).notNull(),
  purchasesCents: integer("purchases_cents").default(0).notNull(),
  paymentsCents: integer("payments_cents").default(0).notNull(),
  daysPastDue: integer("days_past_due").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Generated Metro 2 reporting files per period/bureau.
export const metro2Reports = pgTable("metro2_reports", {
  id: serial("id").primaryKey(),
  periodKey: text("period_key").notNull(), // e.g. "2026-06"
  bureau: text("bureau").default("all").notNull(), // equifax | experian | transunion | all
  recordCount: integer("record_count").default(0).notNull(),
  content: text("content").notNull(),
  status: text("status").default("generated").notNull(), // generated | transmitted | failed
  generatedBy: varchar("generated_by"),
  transmittedAt: timestamp("transmitted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// FCRA disputes (direct or via e-OSCAR).
export const creditDisputes = pgTable("credit_disputes", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id"),
  userId: varchar("user_id"),
  channel: text("channel").default("direct").notNull(), // direct | e-oscar
  reasonCode: text("reason_code"),
  description: text("description").notNull(),
  status: text("status").default("open").notNull(), // open | investigating | resolved
  resolution: text("resolution"),
  fcraDueDate: timestamp("fcra_due_date"),
  createdAt: timestamp("created_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

export const insertCreditApplicationSchema = createInsertSchema(creditApplications, {
  email: z.string().email(),
  phone: z.string().min(7),
  ssn: z.string().regex(/^\d{3}-?\d{2}-?\d{4}$/, "Enter a valid SSN"),
  zipCode: z.string().min(5),
  annualIncome: z.coerce.number().int().min(0),
  requestedLimitCents: z.coerce.number().int().min(2000),
  requestedTier: z.enum(["starter", "bronze", "silver", "gold", "platinum"]),
  employmentStatus: z.enum(["employed", "self-employed", "unemployed", "retired", "student"]),
  dateOfBirth: z.string().min(8),
}).omit({
  id: true,
  ssnLast4: true,
  track: true,
  identityStatus: true,
  identityRef: true,
  status: true,
  externalApplicationId: true,
  decisionNotes: true,
  createdAt: true,
  userId: true,
});

// Submission wraps the application with required e-sign consent.
export const creditApplicationSubmissionSchema = insertCreditApplicationSchema.extend({
  consentSignature: z.string().min(2, "Please type your full legal name to sign"),
  consentAccepted: z.literal(true, {
    errorMap: () => ({ message: "You must accept the agreements to continue" }),
  }),
});
export type CreditApplicationSubmission = z.infer<typeof creditApplicationSubmissionSchema>;

export const enrollBuilderSchema = z.object({
  builderTier: z.enum(["starter", "bronze", "silver", "gold", "platinum", "diamond"]),
  billingRail: z.enum(BILLING_RAILS),
  consentSignature: z.string().min(2, "Please type your full legal name to sign"),
  consentAccepted: z.literal(true, {
    errorMap: () => ({ message: "You must accept the membership terms to continue" }),
  }),
});
export type EnrollBuilderInput = z.infer<typeof enrollBuilderSchema>;

export const insertCreditAccountSchema = createInsertSchema(creditAccounts).omit({ id: true, createdAt: true });
export const insertCreditTransactionSchema = createInsertSchema(creditTransactions).omit({ id: true, createdAt: true });
export const insertCreditMembershipSchema = createInsertSchema(creditMemberships).omit({ id: true, createdAt: true });
export const insertConsentRecordSchema = createInsertSchema(consentRecords).omit({ id: true, acceptedAt: true });
export const insertCreditStatementSchema = createInsertSchema(creditStatements).omit({ id: true, createdAt: true });
export const insertMetro2ReportSchema = createInsertSchema(metro2Reports).omit({ id: true, createdAt: true });

export const simulateSpendingSchema = z.object({
  merchantName: z.string().min(1),
  amountCents: z.coerce.number().int().positive(),
  description: z.string().optional(),
});

export const makePaymentSchema = z.object({
  amountCents: z.coerce.number().int().positive(),
});

export const generateMetro2Schema = z.object({
  periodKey: z.string().regex(/^\d{4}-\d{2}$/, "Use YYYY-MM").optional(),
});

export type CreditApplication = typeof creditApplications.$inferSelect;
export type InsertCreditApplication = z.infer<typeof insertCreditApplicationSchema>;
export type CreditAccount = typeof creditAccounts.$inferSelect;
export type InsertCreditAccount = z.infer<typeof insertCreditAccountSchema>;
export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type InsertCreditTransaction = z.infer<typeof insertCreditTransactionSchema>;
export type CreditMembership = typeof creditMemberships.$inferSelect;
export type InsertCreditMembership = z.infer<typeof insertCreditMembershipSchema>;
export type MembershipPayment = typeof membershipPayments.$inferSelect;
export type ConsentRecord = typeof consentRecords.$inferSelect;
export type InsertConsentRecord = z.infer<typeof insertConsentRecordSchema>;
export type CreditAuditLogEntry = typeof creditAuditLog.$inferSelect;
export type CreditStatement = typeof creditStatements.$inferSelect;
export type InsertCreditStatement = z.infer<typeof insertCreditStatementSchema>;
export type Metro2Report = typeof metro2Reports.$inferSelect;
export type InsertMetro2Report = z.infer<typeof insertMetro2ReportSchema>;
export type CreditDispute = typeof creditDisputes.$inferSelect;

export type PublicCreditApplication = Pick<
  CreditApplication,
  "id" | "userId" | "requestedTier" | "requestedLimitCents" | "primarySpendingBusiness" | "track" | "identityStatus" | "status" | "externalApplicationId" | "decisionNotes" | "createdAt"
>;

export const PUBLIC_CREDIT_APPLICATION_FIELDS: ReadonlyArray<keyof PublicCreditApplication> = [
  "id",
  "userId",
  "requestedTier",
  "requestedLimitCents",
  "primarySpendingBusiness",
  "track",
  "identityStatus",
  "status",
  "externalApplicationId",
  "decisionNotes",
  "createdAt",
] as const;

// Admin view never includes the encrypted SSN/DOB — only last4 of SSN.
export type AdminCreditApplication = Omit<CreditApplication, "ssn" | "dateOfBirth"> & { ssnLast4: string };

export const adminUpdateCreditApplicationSchema = z.object({
  status: z.enum(["pending", "approved", "denied"]).optional(),
  track: z.enum(ACCOUNT_MODELS).optional(),
  decisionNotes: z.string().nullable().optional(),
});

export const adminUpdateCreditAccountSchema = z.object({
  status: z.enum(["active", "frozen", "closed"]).optional(),
});

export const insertVentureProposalSchema = createInsertSchema(ventureProposals).omit({ id: true, createdAt: true });
export type VentureProposal = typeof ventureProposals.$inferSelect;
export type InsertVentureProposal = z.infer<typeof insertVentureProposalSchema>;

export const insertWebsiteSchema = createInsertSchema(websites).omit({ id: true });
export const insertInvestmentInquirySchema = createInsertSchema(investmentInquiries).omit({ id: true, createdAt: true });
export const insertCompanySettingsSchema = createInsertSchema(companySettings).omit({ id: true });
export const insertBlogPostSchema = createInsertSchema(blogPosts).omit({ id: true, publishedAt: true });
export const insertJobOpeningSchema = createInsertSchema(jobOpenings).omit({ id: true });

export type Website = typeof websites.$inferSelect;
export type InsertWebsite = z.infer<typeof insertWebsiteSchema>;
export type InvestmentInquiry = typeof investmentInquiries.$inferSelect;
export type InsertInvestmentInquiry = z.infer<typeof insertInvestmentInquirySchema>;
export type CompanySetting = typeof companySettings.$inferSelect;
export type BlogPost = typeof blogPosts.$inferSelect;
export type InsertBlogPost = z.infer<typeof insertBlogPostSchema>;
export type JobOpening = typeof jobOpenings.$inferSelect;
export type InsertJobOpening = z.infer<typeof insertJobOpeningSchema>;

export * from "./models/chat";
export * from "./models/auth";
