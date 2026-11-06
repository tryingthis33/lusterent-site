import { addDays, subMonths } from "date-fns";
import { storage } from "../storage";
import { audit } from "./audit";
import { decrypt } from "./encryption";
import {
  generateMetro2File,
  metro2StatusForAccount,
  validateMetro2File,
  type Metro2AccountInput,
} from "./metro2";
import { getReportingProvider } from "./reportingProvider";
import type { CreditAccount, Metro2Report } from "@shared/schema";

const MIN_PAYMENT_FLOOR_CENTS = 2500; // $25 minimum payment floor
const PAYMENT_GRACE_DAYS = 25;

function minimumDueFor(balanceCents: number): number {
  if (balanceCents <= 0) return 0;
  const onePercent = Math.ceil(balanceCents * 0.01);
  return Math.min(balanceCents, Math.max(MIN_PAYMENT_FLOOR_CENTS, onePercent));
}

// Close out a billing cycle for every reportable account: write a statement,
// roll delinquency forward, and stamp the Metro 2 account-status code.
export async function generateStatements(actorId: string | null): Promise<{ generated: number }> {
  const accounts = await storage.listCreditAccounts();
  const now = new Date();
  let generated = 0;

  for (const account of accounts) {
    if (account.status === "closed") continue;

    const periodStart = account.lastStatementDate ?? account.openedDate ?? subMonths(now, 1);
    const periodEnd = now;
    const dueDate = addDays(now, PAYMENT_GRACE_DAYS);

    const txs = await storage.getCreditTransactionsByAccount(account.id);
    const inPeriod = txs.filter((t) => {
      const at = t.createdAt ? new Date(t.createdAt) : now;
      return at >= new Date(periodStart) && at <= periodEnd;
    });
    const purchasesCents = inPeriod
      .filter((t) => t.type === "charge")
      .reduce((sum, t) => sum + t.amountCents, 0);
    const paymentsCents = inPeriod
      .filter((t) => t.type === "payment")
      .reduce((sum, t) => sum + t.amountCents, 0);

    const openingBalanceCents = account.statementBalanceCents;
    const closingBalanceCents = account.balanceCents;
    const minimumDueCents = minimumDueFor(closingBalanceCents);

    // Delinquency roll-forward: if the previous cycle had a minimum due that
    // wasn't covered by payments this period, advance 30 days past due.
    let daysPastDue = account.daysPastDue;
    if (account.minimumDueCents > 0 && paymentsCents < account.minimumDueCents) {
      daysPastDue += 30;
    } else {
      daysPastDue = 0;
    }

    const metro2Status = metro2StatusForAccount({ ...account, daysPastDue });

    await storage.createStatement({
      accountId: account.id,
      userId: account.userId,
      periodStart: new Date(periodStart),
      periodEnd,
      statementDate: now,
      dueDate,
      openingBalanceCents,
      closingBalanceCents,
      minimumDueCents,
      purchasesCents,
      paymentsCents,
      daysPastDue,
    });

    await storage.updateCreditAccount(account.id, {
      statementBalanceCents: closingBalanceCents,
      minimumDueCents,
      lastStatementDate: now,
      paymentDueDate: dueDate,
      daysPastDue,
      metro2Status,
      chargeOffDate: daysPastDue >= 180 && !account.chargeOffDate ? now : account.chargeOffDate,
    });

    generated += 1;
  }

  await audit({
    actorId,
    actorType: actorId ? "admin" : "system",
    action: "statements.generated",
    entityType: "statement_run",
    metadata: { generated },
  });

  return { generated };
}

function currentPeriodKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Build a Metro 2 file from every reportable account and persist it. Consumer
// PII (SSN/DOB) is decrypted only in-memory here, never logged or returned.
export async function generateMetro2Report(
  actorId: string | null,
  periodKey?: string,
): Promise<Metro2Report> {
  const period = periodKey ?? currentPeriodKey();
  const accounts = await storage.listCreditAccounts();
  const reportable = accounts.filter((a: CreditAccount) => a.status !== "frozen");

  const inputs: Metro2AccountInput[] = [];
  for (const account of reportable) {
    const application = account.userId
      ? await storage.getCreditApplicationByUser(account.userId)
      : undefined;
    if (!application) continue;

    inputs.push({
      account,
      consumer: {
        firstName: application.firstName,
        lastName: application.lastName,
        ssn: decrypt(application.ssn),
        dateOfBirth: decrypt(application.dateOfBirth),
        addressLine1: application.addressLine1,
        addressLine2: application.addressLine2,
        city: application.city,
        state: application.state,
        zipCode: application.zipCode,
      },
    });
  }

  const { content, recordCount } = generateMetro2File(inputs, { reportDate: new Date() });
  const validation = validateMetro2File(content);

  const report = await storage.createMetro2Report({
    periodKey: period,
    bureau: "all",
    recordCount,
    content,
    status: validation.valid ? "generated" : "failed",
    generatedBy: actorId,
  });

  await audit({
    actorId,
    actorType: actorId ? "admin" : "system",
    action: "metro2.generated",
    entityType: "metro2_report",
    entityId: report.id,
    metadata: { periodKey: period, recordCount, valid: validation.valid, errors: validation.errors },
  });

  return report;
}

export async function transmitMetro2Report(
  actorId: string | null,
  reportId: number,
): Promise<Metro2Report> {
  const report = await storage.getMetro2Report(reportId);
  if (!report) throw new Error("Report not found");

  const result = await getReportingProvider().transmit(report.periodKey, report.content);

  const updated = await storage.updateMetro2Report(reportId, {
    status: result.transmitted ? "transmitted" : report.status,
    transmittedAt: result.transmitted ? new Date() : null,
  });

  await audit({
    actorId,
    actorType: actorId ? "admin" : "system",
    action: "metro2.transmitted",
    entityType: "metro2_report",
    entityId: reportId,
    metadata: { transmitted: result.transmitted, ref: result.ref, notes: result.notes },
  });

  return updated;
}
