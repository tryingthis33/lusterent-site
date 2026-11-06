import type { BillingRail } from "@shared/schema";

// Credit-builder membership billing abstraction. Two rails:
//  - "stripe": real recurring money (requires the Stripe integration + keys).
//  - "pc":     internal $Pc / $PcPay settlement (no external dependency).
//
// The default Stripe implementation is a stub that succeeds locally so the flow
// is fully testable; wire the real Stripe SDK here (single swap-point) once the
// Stripe integration and STRIPE_SECRET_KEY are configured. Routes must never
// call the Stripe SDK directly.

export interface MembershipChargeResult {
  rail: BillingRail;
  status: "succeeded" | "pending" | "failed";
  externalRef: string;
  customerId?: string;
  subscriptionId?: string;
  currentPeriodEnd?: Date;
  notes?: string;
}

export interface MembershipBillingProvider {
  readonly name: string;
  startSubscription(input: {
    userId: string;
    email: string;
    monthlyFeeCents: number;
    rail: BillingRail;
  }): Promise<MembershipChargeResult>;
  cancelSubscription(input: { subscriptionId?: string | null; rail: BillingRail }): Promise<void>;
}

function nextMonth(from = new Date()): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + 1);
  return d;
}

class StubMembershipProvider implements MembershipBillingProvider {
  readonly name = "stub";

  async startSubscription(input: {
    userId: string;
    email: string;
    monthlyFeeCents: number;
    rail: BillingRail;
  }): Promise<MembershipChargeResult> {
    if (input.rail === "stripe") {
      const live = !!process.env.STRIPE_SECRET_KEY;
      return {
        rail: "stripe",
        status: "succeeded",
        externalRef: `stub_sub_${input.userId}_${Date.now()}`,
        customerId: `stub_cus_${input.userId}`,
        subscriptionId: `stub_sub_${input.userId}`,
        currentPeriodEnd: nextMonth(),
        notes: live
          ? "Stripe key present but live wiring not implemented in stub."
          : "Stripe not configured — simulated subscription. Add the Stripe integration to bill real money.",
      };
    }
    // $Pc rail settles internally.
    return {
      rail: "pc",
      status: "succeeded",
      externalRef: `pc_sub_${input.userId}_${Date.now()}`,
      currentPeriodEnd: nextMonth(),
      notes: "Membership fee settled on $PcPay rails.",
    };
  }

  async cancelSubscription(_input: { subscriptionId?: string | null; rail: BillingRail }): Promise<void> {
    // Stub: no-op. Real Stripe impl would cancel the subscription via the SDK.
  }
}

let provider: MembershipBillingProvider = new StubMembershipProvider();

export function getMembershipProvider(): MembershipBillingProvider {
  return provider;
}

export function setMembershipProvider(next: MembershipBillingProvider): void {
  provider = next;
}

export { StubMembershipProvider };
