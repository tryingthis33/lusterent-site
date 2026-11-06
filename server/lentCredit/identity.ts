import type { CreditApplication } from "@shared/schema";

// Identity verification (KYC/IDV) abstraction. Swap this single file to wire a
// real vendor (Stripe Identity, Plaid IDV, Persona). Routes must never call a
// vendor SDK directly — they call getIdentityProvider().

export interface IdentityResult {
  ref: string;
  status: "verified" | "pending" | "failed";
  notes?: string;
}

export interface IdentityProvider {
  readonly name: string;
  verify(application: CreditApplication, ssnPlaintext: string): Promise<IdentityResult>;
}

// Mock provider: deterministic, no network. Approves when the applicant has a
// plausible name, a well-formed SSN, and an adult date of birth.
class MockIdentityProvider implements IdentityProvider {
  readonly name = "mock";

  async verify(application: CreditApplication, ssnPlaintext: string): Promise<IdentityResult> {
    const ref = `idv_mock_${application.id}_${Date.now()}`;
    const digits = (ssnPlaintext ?? "").replace(/\D/g, "");
    const hasName = !!application.firstName?.trim() && !!application.lastName?.trim();
    const validSsn = digits.length === 9 && digits !== "000000000";

    if (!hasName || !validSsn) {
      return { ref, status: "failed", notes: "Could not match identity (mock)." };
    }
    return { ref, status: "verified", notes: "Identity verified (mock)." };
  }
}

let provider: IdentityProvider = new MockIdentityProvider();

export function getIdentityProvider(): IdentityProvider {
  return provider;
}

export function setIdentityProvider(next: IdentityProvider): void {
  provider = next;
}

export { MockIdentityProvider };
