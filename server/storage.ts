import { db } from "./db";
import {
  websites,
  investmentInquiries,
  companySettings,
  blogPosts,
  jobOpenings,
  creditApplications,
  creditAccounts,
  creditTransactions,
  creditMemberships,
  membershipPayments,
  consentRecords,
  creditStatements,
  metro2Reports,
  creditDisputes,
  type Website,
  type InsertWebsite,
  type InvestmentInquiry,
  type InsertInvestmentInquiry,
  type CompanySetting,
  type BlogPost,
  type InsertBlogPost,
  type JobOpening,
  type InsertJobOpening,
  type CreditApplication,
  type InsertCreditApplication,
  type CreditAccount,
  type InsertCreditAccount,
  type CreditTransaction,
  type InsertCreditTransaction,
  type CreditMembership,
  type InsertCreditMembership,
  type MembershipPayment,
  type ConsentRecord,
  type InsertConsentRecord,
  type CreditStatement,
  type InsertCreditStatement,
  type Metro2Report,
  type InsertMetro2Report,
  type CreditDispute,
} from "@shared/schema";
import { eq, asc, desc } from "drizzle-orm";

export interface IStorage {
  getWebsites(): Promise<Website[]>;
  createWebsite(website: InsertWebsite): Promise<Website>;
  updateWebsite(id: number, website: Partial<InsertWebsite>): Promise<Website>;
  deleteWebsite(id: number): Promise<void>;
  
  createInvestmentInquiry(inquiry: InsertInvestmentInquiry): Promise<InvestmentInquiry>;
  
  getSettings(): Promise<CompanySetting[]>;
  updateSetting(key: string, value: string): Promise<CompanySetting>;

  getBlogPosts(): Promise<BlogPost[]>;
  createBlogPost(post: InsertBlogPost): Promise<BlogPost>;

  getJobOpenings(): Promise<JobOpening[]>;
  createJobOpening(job: InsertJobOpening): Promise<JobOpening>;

  createCreditApplication(app: InsertCreditApplication & { userId?: string | null }): Promise<CreditApplication>;
  getCreditApplicationByUser(userId: string): Promise<CreditApplication | undefined>;
  getCreditApplication(id: number): Promise<CreditApplication | undefined>;
  updateCreditApplication(id: number, patch: Partial<CreditApplication>): Promise<CreditApplication>;
  listCreditApplications(): Promise<CreditApplication[]>;

  createCreditAccount(account: InsertCreditAccount): Promise<CreditAccount>;
  getCreditAccountByUser(userId: string): Promise<CreditAccount | undefined>;
  getCreditAccount(id: number): Promise<CreditAccount | undefined>;
  updateCreditAccount(id: number, patch: Partial<CreditAccount>): Promise<CreditAccount>;
  listCreditAccounts(): Promise<CreditAccount[]>;

  createCreditTransaction(tx: InsertCreditTransaction): Promise<CreditTransaction>;
  getCreditTransactionsByAccount(accountId: number): Promise<CreditTransaction[]>;
  listRecentCreditTransactions(limit?: number): Promise<CreditTransaction[]>;

  createConsentRecord(rec: InsertConsentRecord): Promise<ConsentRecord>;
  listConsentRecordsByUser(userId: string): Promise<ConsentRecord[]>;

  getMembershipByUser(userId: string): Promise<CreditMembership | undefined>;
  createMembership(m: InsertCreditMembership): Promise<CreditMembership>;
  updateMembership(id: number, patch: Partial<CreditMembership>): Promise<CreditMembership>;
  listMemberships(): Promise<CreditMembership[]>;
  createMembershipPayment(p: Omit<MembershipPayment, "id" | "createdAt">): Promise<MembershipPayment>;
  listMembershipPaymentsByUser(userId: string): Promise<MembershipPayment[]>;

  createStatement(s: InsertCreditStatement): Promise<CreditStatement>;
  listStatementsByAccount(accountId: number): Promise<CreditStatement[]>;

  createMetro2Report(r: InsertMetro2Report): Promise<Metro2Report>;
  getMetro2Report(id: number): Promise<Metro2Report | undefined>;
  updateMetro2Report(id: number, patch: Partial<Metro2Report>): Promise<Metro2Report>;
  listMetro2Reports(): Promise<Metro2Report[]>;

  listCreditDisputes(): Promise<CreditDispute[]>;
}

export class DatabaseStorage implements IStorage {
  async getWebsites(): Promise<Website[]> {
    return await db.select().from(websites).orderBy(asc(websites.order));
  }

  async createWebsite(insertWebsite: InsertWebsite): Promise<Website> {
    const [website] = await db.insert(websites).values(insertWebsite).returning();
    return website;
  }

  async updateWebsite(id: number, website: Partial<InsertWebsite>): Promise<Website> {
    const [updated] = await db.update(websites).set(website).where(eq(websites.id, id)).returning();
    return updated;
  }

  async deleteWebsite(id: number): Promise<void> {
    await db.delete(websites).where(eq(websites.id, id));
  }

  async createInvestmentInquiry(inquiry: InsertInvestmentInquiry): Promise<InvestmentInquiry> {
    const [result] = await db.insert(investmentInquiries).values(inquiry).returning();
    return result;
  }

  async getSettings(): Promise<CompanySetting[]> {
    return await db.select().from(companySettings);
  }

  async updateSetting(key: string, value: string): Promise<CompanySetting> {
    const [existing] = await db.select().from(companySettings).where(eq(companySettings.key, key));
    if (existing) {
      const [updated] = await db.update(companySettings).set({ value }).where(eq(companySettings.key, key)).returning();
      return updated;
    }
    const [created] = await db.insert(companySettings).values({ key, value }).returning();
    return created;
  }

  async getBlogPosts(): Promise<BlogPost[]> {
    return await db.select().from(blogPosts).orderBy(desc(blogPosts.publishedAt));
  }

  async createBlogPost(post: InsertBlogPost): Promise<BlogPost> {
    const [result] = await db.insert(blogPosts).values(post).returning();
    return result;
  }

  async getJobOpenings(): Promise<JobOpening[]> {
    return await db.select().from(jobOpenings);
  }

  async createJobOpening(job: InsertJobOpening): Promise<JobOpening> {
    const [result] = await db.insert(jobOpenings).values(job).returning();
    return result;
  }

  async createCreditApplication(app: InsertCreditApplication & { userId?: string | null }): Promise<CreditApplication> {
    const [result] = await db.insert(creditApplications).values(app).returning();
    return result;
  }

  async getCreditApplicationByUser(userId: string): Promise<CreditApplication | undefined> {
    const [result] = await db.select().from(creditApplications).where(eq(creditApplications.userId, userId)).orderBy(desc(creditApplications.createdAt)).limit(1);
    return result;
  }

  async getCreditApplication(id: number): Promise<CreditApplication | undefined> {
    const [result] = await db.select().from(creditApplications).where(eq(creditApplications.id, id));
    return result;
  }

  async updateCreditApplication(id: number, patch: Partial<CreditApplication>): Promise<CreditApplication> {
    const [result] = await db.update(creditApplications).set(patch).where(eq(creditApplications.id, id)).returning();
    return result;
  }

  async listCreditApplications(): Promise<CreditApplication[]> {
    return await db.select().from(creditApplications).orderBy(desc(creditApplications.createdAt));
  }

  async createCreditAccount(account: InsertCreditAccount): Promise<CreditAccount> {
    const [result] = await db.insert(creditAccounts).values(account).returning();
    return result;
  }

  async getCreditAccountByUser(userId: string): Promise<CreditAccount | undefined> {
    const [result] = await db.select().from(creditAccounts).where(eq(creditAccounts.userId, userId));
    return result;
  }

  async getCreditAccount(id: number): Promise<CreditAccount | undefined> {
    const [result] = await db.select().from(creditAccounts).where(eq(creditAccounts.id, id));
    return result;
  }

  async updateCreditAccount(id: number, patch: Partial<CreditAccount>): Promise<CreditAccount> {
    const [result] = await db.update(creditAccounts).set(patch).where(eq(creditAccounts.id, id)).returning();
    return result;
  }

  async listCreditAccounts(): Promise<CreditAccount[]> {
    return await db.select().from(creditAccounts).orderBy(desc(creditAccounts.createdAt));
  }

  async createCreditTransaction(tx: InsertCreditTransaction): Promise<CreditTransaction> {
    const [result] = await db.insert(creditTransactions).values(tx).returning();
    return result;
  }

  async getCreditTransactionsByAccount(accountId: number): Promise<CreditTransaction[]> {
    return await db.select().from(creditTransactions).where(eq(creditTransactions.accountId, accountId)).orderBy(desc(creditTransactions.createdAt));
  }

  async listRecentCreditTransactions(limit: number = 50): Promise<CreditTransaction[]> {
    return await db.select().from(creditTransactions).orderBy(desc(creditTransactions.createdAt)).limit(limit);
  }

  async createConsentRecord(rec: InsertConsentRecord): Promise<ConsentRecord> {
    const [result] = await db.insert(consentRecords).values(rec).returning();
    return result;
  }

  async listConsentRecordsByUser(userId: string): Promise<ConsentRecord[]> {
    return await db.select().from(consentRecords).where(eq(consentRecords.userId, userId)).orderBy(desc(consentRecords.acceptedAt));
  }

  async getMembershipByUser(userId: string): Promise<CreditMembership | undefined> {
    const [result] = await db.select().from(creditMemberships).where(eq(creditMemberships.userId, userId));
    return result;
  }

  async createMembership(m: InsertCreditMembership): Promise<CreditMembership> {
    const [result] = await db.insert(creditMemberships).values(m).returning();
    return result;
  }

  async updateMembership(id: number, patch: Partial<CreditMembership>): Promise<CreditMembership> {
    const [result] = await db.update(creditMemberships).set(patch).where(eq(creditMemberships.id, id)).returning();
    return result;
  }

  async listMemberships(): Promise<CreditMembership[]> {
    return await db.select().from(creditMemberships).orderBy(desc(creditMemberships.createdAt));
  }

  async createMembershipPayment(p: Omit<MembershipPayment, "id" | "createdAt">): Promise<MembershipPayment> {
    const [result] = await db.insert(membershipPayments).values(p).returning();
    return result;
  }

  async listMembershipPaymentsByUser(userId: string): Promise<MembershipPayment[]> {
    return await db.select().from(membershipPayments).where(eq(membershipPayments.userId, userId)).orderBy(desc(membershipPayments.createdAt));
  }

  async createStatement(s: InsertCreditStatement): Promise<CreditStatement> {
    const [result] = await db.insert(creditStatements).values(s).returning();
    return result;
  }

  async listStatementsByAccount(accountId: number): Promise<CreditStatement[]> {
    return await db.select().from(creditStatements).where(eq(creditStatements.accountId, accountId)).orderBy(desc(creditStatements.statementDate));
  }

  async createMetro2Report(r: InsertMetro2Report): Promise<Metro2Report> {
    const [result] = await db.insert(metro2Reports).values(r).returning();
    return result;
  }

  async getMetro2Report(id: number): Promise<Metro2Report | undefined> {
    const [result] = await db.select().from(metro2Reports).where(eq(metro2Reports.id, id));
    return result;
  }

  async updateMetro2Report(id: number, patch: Partial<Metro2Report>): Promise<Metro2Report> {
    const [result] = await db.update(metro2Reports).set(patch).where(eq(metro2Reports.id, id)).returning();
    return result;
  }

  async listMetro2Reports(): Promise<Metro2Report[]> {
    return await db.select().from(metro2Reports).orderBy(desc(metro2Reports.createdAt));
  }

  async listCreditDisputes(): Promise<CreditDispute[]> {
    return await db.select().from(creditDisputes).orderBy(desc(creditDisputes.createdAt));
  }
}

export const storage = new DatabaseStorage();
