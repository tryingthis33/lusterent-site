// Metro 2 file generation (simplified, structured approximation of the CDIA
// Metro 2 fixed-length format). This produces a Header, one Base Segment per
// account, and a Trailer. It is intentionally vendor-neutral; transmission to
// the bureaus is handled separately by the reportingProvider abstraction.
//
// NOTE: The official Metro 2 spec is licensed by the CDIA. This module follows
// the documented field layout closely enough for review/QA but should be
// validated against the licensed spec before live bureau certification.

import type { CreditAccount } from "@shared/schema";

export interface Metro2Consumer {
  firstName: string;
  lastName: string;
  middleName?: string;
  ssn: string; // plaintext, 9 digits
  dateOfBirth: string; // MMDDYYYY or ISO; normalized below
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  zipCode: string;
}

export interface Metro2AccountInput {
  account: Pick<
    CreditAccount,
    | "id"
    | "accountModel"
    | "limitCents"
    | "balanceCents"
    | "statementBalanceCents"
    | "minimumDueCents"
    | "daysPastDue"
    | "metro2Status"
    | "openedDate"
    | "lastPaymentDate"
    | "status"
  >;
  consumer: Metro2Consumer;
}

function fixed(value: string | number | null | undefined, len: number, align: "L" | "R" = "L", pad = " "): string {
  let s = value == null ? "" : String(value);
  if (s.length > len) s = s.slice(0, len);
  return align === "L" ? s.padEnd(len, pad) : s.padStart(len, pad);
}

function num(value: number | null | undefined, len: number): string {
  const n = Math.max(0, Math.round(value ?? 0));
  return fixed(String(n), len, "R", "0");
}

function dollarsFromCents(cents: number | null | undefined): number {
  return Math.round((cents ?? 0) / 100);
}

function normalizeDateMMDDYYYY(input: string | Date | null | undefined): string {
  if (!input) return fixed("", 8, "R", "0");
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) {
    // already-formatted digits (e.g. "1990-05-01" handled above; raw digits)
    const digits = String(input).replace(/\D/g, "");
    return fixed(digits, 8, "R", "0");
  }
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${mm}${dd}${yyyy}`;
}

// Map an account to a Metro 2 Account Status code.
export function metro2StatusForAccount(a: Metro2AccountInput["account"]): string {
  if (a.status === "closed") return "13"; // paid/closed
  const dpd = a.daysPastDue ?? 0;
  if (dpd >= 180) return "97"; // charge-off
  if (dpd >= 120) return "84";
  if (dpd >= 90) return "83";
  if (dpd >= 60) return "82";
  if (dpd >= 30) return "81";
  return "11"; // current / paid as agreed
}

function baseSegment(input: Metro2AccountInput, reportDate: Date): string {
  const { account: a, consumer: c } = input;
  const status = metro2StatusForAccount(a);
  const reportMMDDYYYY = normalizeDateMMDDYYYY(reportDate);

  // Field-by-field (simplified Base Segment). Order/widths approximate the spec.
  const parts: string[] = [];
  parts.push(fixed("1", 4, "R", "0"));                      // Record Descriptor Word (block id)
  parts.push(fixed("", 20));                                // Processing Indicator / Time Stamp (reserved)
  parts.push(fixed("R", 1));                                // Identification Number prefix
  parts.push(fixed(`LENT${a.id}`, 20));                     // Account/Identification Number
  parts.push(fixed("18", 2));                               // Portfolio Type: 18 = line of credit
  parts.push(fixed("47", 2));                               // Account Type: 47 = credit line
  parts.push(normalizeDateMMDDYYYY(a.openedDate));          // Date Opened
  parts.push(num(dollarsFromCents(a.limitCents), 9));       // Credit Limit
  parts.push(num(dollarsFromCents(a.balanceCents), 9));     // Highest Credit / Original Amount
  parts.push(fixed("M", 1));                                // Terms Frequency: Monthly
  parts.push(num(dollarsFromCents(a.minimumDueCents), 9));  // Scheduled Monthly Payment
  parts.push(num(dollarsFromCents(a.statementBalanceCents || a.balanceCents), 9)); // Current Balance
  parts.push(num(dollarsFromCents(a.balanceCents), 9));     // Amount Past Due
  parts.push(fixed(status, 2));                             // Account Status
  parts.push(fixed("0", 1));                                // Payment Rating
  parts.push(reportMMDDYYYY);                               // Date of Account Information (report date)
  parts.push(normalizeDateMMDDYYYY(a.lastPaymentDate));     // Date of Last Payment
  parts.push(fixed(c.lastName, 25));                        // Surname
  parts.push(fixed(c.firstName, 20));                       // First Name
  parts.push(fixed(c.middleName ?? "", 20));               // Middle Name
  parts.push(fixed((c.ssn ?? "").replace(/\D/g, ""), 9, "R", "0")); // SSN
  parts.push(normalizeDateMMDDYYYY(c.dateOfBirth));         // Date of Birth
  parts.push(fixed(c.addressLine1, 32));                    // Address Line 1
  parts.push(fixed(c.addressLine2 ?? "", 32));             // Address Line 2
  parts.push(fixed(c.city, 20));                            // City
  parts.push(fixed(c.state, 2));                            // State
  parts.push(fixed((c.zipCode ?? "").replace(/\D/g, ""), 9)); // Zip
  return parts.join("");
}

export interface Metro2GenerateResult {
  content: string;
  recordCount: number;
}

export function generateMetro2File(
  accounts: Metro2AccountInput[],
  opts: { reportDate?: Date; reporterName?: string; programIdentifier?: string } = {},
): Metro2GenerateResult {
  const reportDate = opts.reportDate ?? new Date();
  const reporterName = opts.reporterName ?? "LENT CREDIT / LUSTER ENT INC";
  const programId = opts.programIdentifier ?? "LENTCREDIT";

  const header =
    fixed("HEADER", 6) +
    normalizeDateMMDDYYYY(reportDate) +
    fixed(programId, 10) +
    fixed(reporterName, 40) +
    fixed("METRO2", 6);

  const segments = accounts.map((a) => baseSegment(a, reportDate));

  const trailer =
    fixed("TRAILER", 7) +
    num(accounts.length, 9) +
    fixed(programId, 10);

  const content = [header, ...segments, trailer].join("\n");
  return { content, recordCount: accounts.length };
}

// Lightweight structural validation used before transmission.
export function validateMetro2File(content: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const lines = content.split("\n");
  if (lines.length < 2) errors.push("File must contain at least a header and trailer.");
  if (!lines[0]?.startsWith("HEADER")) errors.push("Missing HEADER record.");
  if (!lines[lines.length - 1]?.startsWith("TRAILER")) errors.push("Missing TRAILER record.");
  const trailerCount = Number((lines[lines.length - 1] ?? "").replace("TRAILER", "").slice(0, 9));
  const segmentCount = lines.length - 2;
  if (!Number.isNaN(trailerCount) && trailerCount !== segmentCount) {
    errors.push(`Trailer count (${trailerCount}) does not match base segments (${segmentCount}).`);
  }
  return { valid: errors.length === 0, errors };
}
