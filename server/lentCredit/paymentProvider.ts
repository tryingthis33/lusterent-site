import { LENT_CREDIT_TIERS, type LentCreditTierId, type CreditApplication } from "@shared/schema";

export interface ApplicationDecision {
  externalApplicationId: string;
  status: "approved" | "denied" | "pending";
  approvedTier?: LentCreditTierId;
  approvedLimitCents?: number;
  externalAccountId?: string;
  notes?: string;
}

export interface AccountStatus {
  externalAccountId: string;
  balanceCents: number;
  status: "active" | "frozen" | "closed";
}

export interface TransactionRecord {
  externalTransactionId: string;
  amountCents: number;
  rewardsEarnedPc: number;
}

export interface LentCreditProvider {
  readonly name: string;
  submitApplication(application: CreditApplication): Promise<ApplicationDecision>;
  getAccountStatus(externalAccountId: string): Promise<AccountStatus>;
  recordTransaction(
    externalAccountId: string,
    amountCents: number,
    merchantName: string,
  ): Promise<TransactionRecord>;
  recordPayment(
    externalAccountId: string,
    amountCents: number,
  ): Promise<TransactionRecord>;
  creditRewards(externalAccountId: string, rewardsPc: number): Promise<void>;
}

function tierFor(id: string) {
  return LENT_CREDIT_TIERS.find((t) => t.id === id) ?? LENT_CREDIT_TIERS[0];
}

class MockProvider implements LentCreditProvider {
  readonly name = "mock";

  async submitApplication(application: CreditApplication): Promise<ApplicationDecision> {
    const externalApplicationId = `mock_app_${application.id}_${Date.now()}`;
    const requested = tierFor(application.requestedTier);

    const eligibleTier = [...LENT_CREDIT_TIERS]
      .reverse()
      .find((t) => application.annualIncome >= t.minIncome) ?? LENT_CREDIT_TIERS[0];

    const grantedTier =
      LENT_CREDIT_TIERS.findIndex((t) => t.id === eligibleTier.id) <
      LENT_CREDIT_TIERS.findIndex((t) => t.id === requested.id)
        ? eligibleTier
        : requested;

    if (application.annualIncome <= 0 && application.employmentStatus === "unemployed") {
      return {
        externalApplicationId,
        status: "denied",
        notes: "Insufficient income for any tier (mock decision).",
      };
    }

    return {
      externalApplicationId,
      status: "approved",
      approvedTier: grantedTier.id,
      approvedLimitCents: grantedTier.limitCents,
      externalAccountId: `mock_acct_${application.id}_${Date.now()}`,
      notes: `Auto-approved by mock provider at tier ${grantedTier.name}.`,
    };
  }

  async getAccountStatus(externalAccountId: string): Promise<AccountStatus> {
    return { externalAccountId, balanceCents: 0, status: "active" };
  }

  async recordTransaction(
    externalAccountId: string,
    amountCents: number,
    _merchantName: string,
  ): Promise<TransactionRecord> {
    return {
      externalTransactionId: `mock_tx_${externalAccountId}_${Date.now()}`,
      amountCents,
      rewardsEarnedPc: 0,
    };
  }

  async recordPayment(
    externalAccountId: string,
    amountCents: number,
  ): Promise<TransactionRecord> {
    return {
      externalTransactionId: `mock_pmt_${externalAccountId}_${Date.now()}`,
      amountCents,
      rewardsEarnedPc: 0,
    };
  }

  async creditRewards(_externalAccountId: string, _rewardsPc: number): Promise<void> {
    // mock: no-op
  }
}

let provider: LentCreditProvider = new MockProvider();

export function getLentCreditProvider(): LentCreditProvider {
  return provider;
}

export function setLentCreditProvider(next: LentCreditProvider): void {
  provider = next;
}

export { MockProvider };
