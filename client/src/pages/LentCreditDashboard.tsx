import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  CreditCard,
  Wallet,
  Sparkles,
  Building2,
  Lock,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  DollarSign,
} from "lucide-react";
import {
  type CreditAccount,
  type CreditTransaction,
  type CreditApplication,
  type CreditMembership,
  type CreditStatement,
  type EnrollBuilderInput,
  LENT_CREDIT_TIERS,
  BUILDER_TIERS,
  formatBuilderTierRange,
  getBuilderTier,
  type BuilderTierId,
} from "@shared/schema";
import { api } from "@shared/routes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

const PARTNER_BUSINESSES = [
  "Pawn Coin ($Pc)",
  "Lusters Life Changing LLC",
  "WeParlay",
  "King Engine",
  "Tradeline Listings",
  "Vapp TV",
  "Pc Casino",
];

const usd = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function LentCreditDashboard() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [merchant, setMerchant] = useState(PARTNER_BUSINESSES[0]);
  const [amount, setAmount] = useState("25.00");
  const [paymentAmount, setPaymentAmount] = useState("25.00");

  const { data: account, isLoading: accountLoading } = useQuery<CreditAccount | null>({
    queryKey: [api.lentCredit.myAccount.path],
    enabled: isAuthenticated,
  });
  const { data: application } = useQuery<CreditApplication | null>({
    queryKey: [api.lentCredit.myApplication.path],
    enabled: isAuthenticated,
  });
  const { data: txs } = useQuery<CreditTransaction[]>({
    queryKey: [api.lentCredit.myTransactions.path],
    enabled: isAuthenticated && !!account,
  });
  const { data: membership } = useQuery<CreditMembership | null>({
    queryKey: [api.lentCredit.myMembership.path],
    enabled: isAuthenticated,
  });
  const { data: statements } = useQuery<CreditStatement[]>({
    queryKey: [api.lentCredit.myStatements.path],
    enabled: isAuthenticated && !!account,
  });

  const [billingRail, setBillingRail] = useState<"stripe" | "pc">("stripe");
  const [builderTier, setBuilderTier] = useState<BuilderTierId>("starter");
  const [enrollSignature, setEnrollSignature] = useState("");
  const [enrollAccepted, setEnrollAccepted] = useState(false);

  const enroll = useMutation<CreditMembership, Error, void>({
    mutationFn: async () => {
      const payload: EnrollBuilderInput = {
        builderTier,
        billingRail,
        consentSignature: enrollSignature,
        consentAccepted: true,
      };
      const res = await apiRequest("POST", api.lentCredit.enrollBuilder.path, payload);
      return (await res.json()) as CreditMembership;
    },
    onSuccess: () => {
      toast({ title: "Membership Active", description: "Your credit-builder membership is now active." });
      queryClient.invalidateQueries({ queryKey: [api.lentCredit.myMembership.path] });
      queryClient.invalidateQueries({ queryKey: [api.lentCredit.myAccount.path] });
      queryClient.invalidateQueries({ queryKey: [api.lentCredit.myStatements.path] });
    },
    onError: (err) => {
      toast({ title: "Enrollment Failed", description: err?.message ?? "Unable to enroll", variant: "destructive" });
    },
  });

  const spend = useMutation<CreditTransaction, Error, void>({
    mutationFn: async () => {
      const cents = Math.round(Number(amount) * 100);
      const res = await apiRequest("POST", api.lentCredit.simulateSpending.path, {
        merchantName: merchant,
        amountCents: cents,
      });
      return (await res.json()) as CreditTransaction;
    },
    onSuccess: () => {
      toast({ title: "Charge Recorded", description: `${usd(Math.round(Number(amount) * 100))} at ${merchant}` });
      queryClient.invalidateQueries({ queryKey: [api.lentCredit.myAccount.path] });
      queryClient.invalidateQueries({ queryKey: [api.lentCredit.myTransactions.path] });
    },
    onError: (err) => {
      toast({ title: "Charge Failed", description: err?.message ?? "Unable to record charge", variant: "destructive" });
    },
  });

  const payment = useMutation<CreditTransaction, Error, void>({
    mutationFn: async () => {
      const cents = Math.round(Number(paymentAmount) * 100);
      const res = await apiRequest("POST", api.lentCredit.makePayment.path, {
        amountCents: cents,
      });
      return (await res.json()) as CreditTransaction;
    },
    onSuccess: () => {
      toast({ title: "Payment Received", description: `${usd(Math.round(Number(paymentAmount) * 100))} applied to your balance` });
      queryClient.invalidateQueries({ queryKey: [api.lentCredit.myAccount.path] });
      queryClient.invalidateQueries({ queryKey: [api.lentCredit.myTransactions.path] });
    },
    onError: (err) => {
      toast({ title: "Payment Failed", description: err?.message ?? "Unable to process payment", variant: "destructive" });
    },
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-pulse text-[#D4AF37] font-serif text-2xl">Authenticating...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
        <Lock className="w-16 h-16 text-[#D4AF37] mb-8 opacity-30" />
        <h1 className="text-4xl md:text-6xl font-serif text-gold-shiny mb-6">Sign In Required</h1>
        <p className="text-[#D4AF37]/40 text-lg max-w-md mx-auto mb-10">
          Sign in to access your LENT Credit dashboard.
        </p>
        <Button asChild className="bg-[#D4AF37] text-black hover:bg-[#B8860B] h-14 px-10 rounded-full font-bold uppercase tracking-widest">
          <a href="/api/login">Sign In</a>
        </Button>
      </div>
    );
  }

  const tier = account ? LENT_CREDIT_TIERS.find((t) => t.id === account.tier) : null;
  const available = account ? account.limitCents - account.balanceCents : 0;
  const isBuilder = account?.accountModel === "builder";
  const hasActiveMembership = membership?.status === "active";
  const selectedBuilderTier = getBuilderTier(builderTier) ?? BUILDER_TIERS[0];
  const builderFee = `$${(selectedBuilderTier.monthlyFeeCents / 100).toFixed(2)}`;
  const membershipTier = membership ? getBuilderTier((membership as CreditMembership & { tier?: string }).tier ?? "") : null;

  const enrollSection = (
    <Card className="bg-[#050505] border-[#D4AF37]/20 rounded-3xl p-8 gold-shadow mt-8" data-testid="card-enroll-builder">
      <CardHeader className="p-0 mb-6">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-[#D4AF37]" />
          <CardTitle className="text-xl font-serif text-white">Credit-Builder Membership</CardTitle>
        </div>
        <p className="text-[#888] text-sm mt-3 leading-relaxed">
          No spendable line yet? Build your credit instead. Pick a tier below — we open a reporting
          tradeline at that limit and report your on-time membership to Equifax, Experian, and
          TransUnion every month. No spending — just steady, positive credit history.
        </p>
      </CardHeader>
      <CardContent className="p-0 space-y-5">
        <div>
          <label className="text-[10px] text-[#888] tracking-widest uppercase mb-2 block">Choose your tier</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {BUILDER_TIERS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setBuilderTier(t.id)}
                className={`text-left rounded-2xl border p-4 transition-all ${
                  builderTier === t.id
                    ? "border-[#D4AF37] bg-[#D4AF37]/10"
                    : "border-[#D4AF37]/15 hover:border-[#D4AF37]/40"
                }`}
                data-testid={`button-builder-tier-${t.id}`}
              >
                <div className="text-white font-bold text-sm uppercase tracking-widest">{t.name}</div>
                <div className="text-[#888] text-xs mt-1">Reported limit {formatBuilderTierRange(t)}</div>
                <div className="text-[#D4AF37] font-semibold text-sm mt-2">
                  ${(t.monthlyFeeCents / 100).toFixed(2)}<span className="text-[#888] font-normal">/mo</span>
                </div>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[10px] text-[#888] tracking-widest uppercase mb-2 block">How would you like to pay the membership?</label>
          <Select value={billingRail} onValueChange={(v) => setBillingRail(v as "stripe" | "pc")}>
            <SelectTrigger data-testid="select-billing-rail"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="stripe">Card / Bank (Stripe)</SelectItem>
              <SelectItem value="pc">Pay with $Pc (Pawn Coin)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[10px] text-[#888] tracking-widest uppercase mb-2 block">Electronic Signature (type your full legal name)</label>
          <Input
            value={enrollSignature}
            onChange={(e) => setEnrollSignature(e.target.value)}
            placeholder="Jane A. Doe"
            data-testid="input-enroll-signature"
          />
        </div>
        <div className="flex items-start gap-3">
          <Checkbox
            id="enroll-consent"
            checked={enrollAccepted}
            onCheckedChange={(c) => setEnrollAccepted(c === true)}
            className="mt-1 border-[#D4AF37]/40 data-[state=checked]:bg-[#D4AF37] data-[state=checked]:text-black"
            data-testid="checkbox-enroll-consent"
          />
          <label htmlFor="enroll-consent" className="text-[#ccc] text-xs leading-relaxed">
            I authorize the recurring {builderFee}/month membership fee, consent to electronic
            records and signatures, and authorize LENT Credit to report this tradeline to the
            credit bureaus.
          </label>
        </div>
        <Button
          onClick={() => enroll.mutate()}
          disabled={enroll.isPending || enrollSignature.trim().length < 2 || !enrollAccepted}
          className="w-full bg-[#D4AF37] text-black hover:bg-[#B8860B] rounded-full font-bold uppercase tracking-widest"
          data-testid="button-enroll-builder"
        >
          {enroll.isPending ? "Processing..." : `Start Membership — ${builderFee}/mo`}
        </Button>
      </CardContent>
    </Card>
  );

  const statementsCard = (
    <Card className="bg-[#050505] border-[#D4AF37]/20 rounded-3xl p-8 gold-shadow" data-testid="card-statements">
      <CardHeader className="p-0 mb-6">
        <CardTitle className="text-xl font-serif text-white">Monthly Statements</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {(!statements || statements.length === 0) && (
          <p className="text-[#666] text-sm">No statements generated yet. Statements appear after your first reporting cycle.</p>
        )}
        <div className="divide-y divide-[#D4AF37]/10">
          {statements?.map((s) => (
            <div key={s.id} className="flex items-center justify-between py-4" data-testid={`row-statement-${s.id}`}>
              <div>
                <div className="text-white font-medium">
                  {new Date(s.periodStart).toLocaleDateString()} – {new Date(s.periodEnd).toLocaleDateString()}
                </div>
                <div className="text-[#666] text-xs">
                  Due {new Date(s.dueDate).toLocaleDateString()}
                  {s.daysPastDue > 0 && (
                    <span className="text-red-400 ml-2">{s.daysPastDue} days past due</span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-white font-bold">{usd(s.closingBalanceCents)}</div>
                <div className="text-[#666] text-xs">Min due {usd(s.minimumDueCents)}</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <nav className="border-b border-[#D4AF37]/10 bg-black/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link
            href="/lent-credit"
            className="flex items-center gap-2 text-[#D4AF37]/60 hover:text-[#D4AF37] transition-all"
            data-testid="link-back"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-[10px] font-bold tracking-[0.3em] uppercase">LENT Credit</span>
          </Link>
          <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-[#D4AF37]/60" data-testid="text-username">
            {user?.firstName ?? user?.email ?? "Cardholder"}
          </span>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-16">
        <header className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <CreditCard className="w-7 h-7 text-[#D4AF37]" />
            <h2 className="text-[#D4AF37] uppercase text-[10px] tracking-[0.5em] font-bold">Your LENT Credit</h2>
          </div>
          <h1 className="text-4xl md:text-6xl font-serif text-gold-shiny" data-testid="heading-dashboard">Dashboard</h1>
        </header>

        {accountLoading && (
          <div className="text-[#D4AF37]/60 animate-pulse">Loading your account...</div>
        )}

        {!accountLoading && !account && (
          <>
            <Card className="bg-[#050505] border-[#D4AF37]/20 rounded-3xl p-10 text-center gold-shadow">
              <Lock className="w-12 h-12 text-[#D4AF37] mx-auto mb-6 opacity-50" />
              <h3 className="text-3xl font-serif text-gold-shiny mb-3">No Active Account</h3>
              <p className="text-[#888] mb-8 max-w-lg mx-auto">
                {application
                  ? `Your application is currently ${application.status}. ${application.decisionNotes ?? ""}`
                  : "You haven't applied for LENT Credit yet."}
              </p>
              <Button asChild className="bg-[#D4AF37] text-black hover:bg-[#B8860B] h-12 px-8 rounded-full font-bold uppercase tracking-widest">
                <Link href="/lent-credit" data-testid="link-apply">Apply Now</Link>
              </Button>
            </Card>
            {!hasActiveMembership && enrollSection}
          </>
        )}

        {account && isBuilder && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
            >
              <Card className="bg-[#050505] border-[#D4AF37]/20 rounded-3xl p-6 gold-shadow">
                <CardHeader className="p-0 mb-4 flex flex-row items-center justify-between">
                  <TrendingUp className="w-5 h-5 text-[#D4AF37]" />
                  <Badge
                    className={`uppercase text-[9px] tracking-widest border ${
                      hasActiveMembership
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : "bg-red-500/10 text-red-400 border-red-500/20"
                    }`}
                    data-testid="badge-membership-status"
                  >
                    {membership?.status ?? "inactive"}
                  </Badge>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="text-[10px] text-[#888] tracking-widest uppercase mb-1">
                    Credit-Builder Plan{membershipTier ? ` — ${membershipTier.name}` : ""}
                  </div>
                  <div className="text-3xl font-serif text-gold-shiny" data-testid="text-membership-fee">
                    {membership ? `$${(membership.monthlyFeeCents / 100).toFixed(2)}` : builderFee}
                    <span className="text-base text-[#888]">/mo</span>
                  </div>
                  <div className="text-[#888] text-xs mt-2" data-testid="text-reported-limit">
                    Reported limit {usd(account.limitCents)}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[#050505] border-[#D4AF37]/20 rounded-3xl p-6 gold-shadow">
                <CardHeader className="p-0 mb-4">
                  <Wallet className="w-5 h-5 text-[#D4AF37]" />
                </CardHeader>
                <CardContent className="p-0">
                  <div className="text-[10px] text-[#888] tracking-widest uppercase mb-1">Billing Method</div>
                  <div className="text-2xl font-serif text-gold-shiny" data-testid="text-billing-method">
                    {membership?.billingRail === "pc" ? "$Pc (Pawn Coin)" : "Card / Bank"}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[#050505] border-[#D4AF37]/20 rounded-3xl p-6 gold-shadow">
                <CardHeader className="p-0 mb-4">
                  <CreditCard className="w-5 h-5 text-[#D4AF37]" />
                </CardHeader>
                <CardContent className="p-0">
                  <div className="text-[10px] text-[#888] tracking-widest uppercase mb-1">Reporting To</div>
                  <div className="text-base font-serif text-gold-shiny leading-tight" data-testid="text-reporting-bureaus">
                    Equifax · Experian · TransUnion
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <Card className="bg-[#050505] border-[#D4AF37]/15 rounded-3xl p-6 mb-8 gold-shadow">
              <p className="text-[#888] text-sm leading-relaxed">
                Your credit-builder membership opens a reporting-only tradeline. There is no
                spending on this account — we report your on-time membership payments to the
                bureaus each month to help build positive credit history.
              </p>
            </Card>

            {statementsCard}

            {!hasActiveMembership && enrollSection}
          </>
        )}

        {account && !isBuilder && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12"
            >
              <Card className="bg-[#050505] border-[#D4AF37]/20 rounded-3xl p-6 gold-shadow">
                <CardHeader className="p-0 mb-4 flex flex-row items-center justify-between">
                  <Wallet className="w-5 h-5 text-[#D4AF37]" />
                  <Badge className="bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/20 uppercase text-[9px] tracking-widest" data-testid="badge-tier">
                    {tier?.name ?? account.tier}
                  </Badge>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="text-[10px] text-[#888] tracking-widest uppercase mb-1">Approved Limit</div>
                  <div className="text-3xl font-serif text-gold-shiny" data-testid="text-limit">{usd(account.limitCents)}</div>
                </CardContent>
              </Card>

              <Card className="bg-[#050505] border-[#D4AF37]/20 rounded-3xl p-6 gold-shadow">
                <CardHeader className="p-0 mb-4">
                  <TrendingUp className="w-5 h-5 text-[#D4AF37]" />
                </CardHeader>
                <CardContent className="p-0">
                  <div className="text-[10px] text-[#888] tracking-widest uppercase mb-1">Available</div>
                  <div className="text-3xl font-serif text-gold-shiny" data-testid="text-available">{usd(available)}</div>
                </CardContent>
              </Card>

              <Card className="bg-[#050505] border-[#D4AF37]/20 rounded-3xl p-6 gold-shadow">
                <CardHeader className="p-0 mb-4">
                  <CreditCard className="w-5 h-5 text-[#D4AF37]" />
                </CardHeader>
                <CardContent className="p-0">
                  <div className="text-[10px] text-[#888] tracking-widest uppercase mb-1">Current Balance</div>
                  <div className="text-3xl font-serif text-gold-shiny" data-testid="text-balance">{usd(account.balanceCents)}</div>
                </CardContent>
              </Card>

              <Card className="bg-[#050505] border-[#D4AF37]/20 rounded-3xl p-6 gold-shadow">
                <CardHeader className="p-0 mb-4">
                  <Sparkles className="w-5 h-5 text-[#D4AF37]" />
                </CardHeader>
                <CardContent className="p-0">
                  <div className="text-[10px] text-[#888] tracking-widest uppercase mb-1">$Pc Rewards Earned</div>
                  <div className="text-3xl font-serif text-gold-shiny" data-testid="text-rewards">
                    {account.rewardsPc.toLocaleString("en-US")} $Pc
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <Card className="bg-[#050505] border-[#D4AF37]/20 rounded-3xl p-8 gold-shadow">
                <CardHeader className="p-0 mb-6">
                  <div className="flex items-center gap-3">
                    <Building2 className="w-5 h-5 text-[#D4AF37]" />
                    <CardTitle className="text-xl font-serif text-white">Spend at Partner</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0 space-y-4">
                  <div>
                    <label className="text-[10px] text-[#888] tracking-widest uppercase mb-2 block">Partner Business</label>
                    <Select value={merchant} onValueChange={setMerchant}>
                      <SelectTrigger data-testid="select-partner"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PARTNER_BUSINESSES.map((b) => (
                          <SelectItem key={b} value={b}>{b}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[10px] text-[#888] tracking-widest uppercase mb-2 block">Amount (USD)</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      data-testid="input-amount"
                    />
                  </div>
                  <Button
                    onClick={() => spend.mutate()}
                    disabled={spend.isPending || !amount}
                    className="w-full bg-[#D4AF37] text-black hover:bg-[#B8860B] rounded-full font-bold uppercase tracking-widest"
                    data-testid="button-charge"
                  >
                    {spend.isPending ? "Processing..." : "Charge Card"}
                  </Button>
                  {tier && (
                    <p className="text-[#666] text-[11px] text-center">
                      Earns {tier.rewardsRate}% $Pc cashback at your tier
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-[#050505] border-[#D4AF37]/20 rounded-3xl p-8 gold-shadow">
                <CardHeader className="p-0 mb-6">
                  <div className="flex items-center gap-3">
                    <DollarSign className="w-5 h-5 text-emerald-400" />
                    <CardTitle className="text-xl font-serif text-white">Make a Payment</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0 space-y-4">
                  <div>
                    <label className="text-[10px] text-[#888] tracking-widest uppercase mb-2 block">Current Balance</label>
                    <div className="text-2xl font-serif text-gold-shiny" data-testid="text-payment-balance">{usd(account.balanceCents)}</div>
                  </div>
                  <div>
                    <label className="text-[10px] text-[#888] tracking-widest uppercase mb-2 block">Quick Pay</label>
                    {(() => {
                      const balance = account.balanceCents;
                      const statementCents = balance;
                      const minDueCents = balance === 0
                        ? 0
                        : Math.min(balance, Math.max(2500, Math.ceil(balance * 0.01)));
                      const fillCents = (cents: number) =>
                        setPaymentAmount((cents / 100).toFixed(2));
                      const disabled = balance === 0 || payment.isPending;
                      const btnClass = "border-[#D4AF37]/30 bg-transparent text-[#D4AF37] hover:bg-[#D4AF37]/10 hover:text-[#D4AF37] rounded-full text-[10px] tracking-widest uppercase font-bold h-auto py-2 px-2 flex flex-col gap-0.5 leading-tight";
                      return (
                        <div className="grid grid-cols-3 gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            disabled={disabled}
                            onClick={() => fillCents(minDueCents)}
                            className={btnClass}
                            data-testid="button-quickpay-minimum"
                          >
                            <span>Min Due</span>
                            <span className="text-white/90 normal-case tracking-normal text-xs font-serif">{usd(minDueCents)}</span>
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={disabled}
                            onClick={() => fillCents(statementCents)}
                            className={btnClass}
                            data-testid="button-quickpay-statement"
                          >
                            <span>Statement</span>
                            <span className="text-white/90 normal-case tracking-normal text-xs font-serif">{usd(statementCents)}</span>
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={disabled}
                            onClick={() => fillCents(balance)}
                            className={btnClass}
                            data-testid="button-quickpay-full"
                          >
                            <span>Pay in Full</span>
                            <span className="text-white/90 normal-case tracking-normal text-xs font-serif">{usd(balance)}</span>
                          </Button>
                        </div>
                      );
                    })()}
                  </div>
                  <div>
                    <label className="text-[10px] text-[#888] tracking-widest uppercase mb-2 block">Payment Amount (USD)</label>
                    <Input
                      type="number"
                      min="0.01"
                      max={(account.balanceCents / 100).toFixed(2)}
                      step="0.01"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      data-testid="input-payment-amount"
                    />
                    {Number(paymentAmount) > 0 && Math.round(Number(paymentAmount) * 100) > account.balanceCents && (
                      <p className="text-red-400 text-[11px] mt-1">Amount exceeds your current balance</p>
                    )}
                  </div>
                  <Button
                    onClick={() => payment.mutate()}
                    disabled={payment.isPending || !paymentAmount || Number(paymentAmount) <= 0 || Math.round(Number(paymentAmount) * 100) > account.balanceCents || account.balanceCents === 0}
                    className="w-full bg-emerald-600 text-white hover:bg-emerald-700 rounded-full font-bold uppercase tracking-widest"
                    data-testid="button-payment"
                  >
                    {payment.isPending ? "Processing..." : "Submit Payment"}
                  </Button>
                  <p className="text-[#666] text-[11px] text-center">
                    {account.balanceCents === 0
                      ? "No balance due — you're all caught up!"
                      : "Payments reduce your balance immediately"}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-[#050505] border-[#D4AF37]/20 rounded-3xl p-8 gold-shadow">
              <CardHeader className="p-0 mb-6">
                <CardTitle className="text-xl font-serif text-white">Recent Transactions</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {(!txs || txs.length === 0) && (
                  <p className="text-[#666] text-sm">No transactions yet — try a partner charge to see activity.</p>
                )}
                <div className="divide-y divide-[#D4AF37]/10">
                  {txs?.map((t) => {
                    const isPayment = t.type === "payment";
                    return (
                      <div
                        key={t.id}
                        className="flex items-center justify-between py-4"
                        data-testid={`row-transaction-${t.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isPayment ? "bg-emerald-500/10" : "bg-[#D4AF37]/10"}`}>
                            {isPayment
                              ? <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
                              : <ArrowUpRight className="w-4 h-4 text-[#D4AF37]" />}
                          </div>
                          <div>
                            <div className="text-white font-medium" data-testid={`text-merchant-${t.id}`}>{t.merchantName}</div>
                            <div className="flex items-center gap-2">
                              <Badge
                                className={`text-[9px] tracking-widest uppercase border ${isPayment ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/20"}`}
                                data-testid={`badge-type-${t.id}`}
                              >
                                {isPayment ? "Payment" : "Charge"}
                              </Badge>
                              <span className="text-[#666] text-xs">
                                {t.createdAt ? new Date(t.createdAt).toLocaleString() : ""}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div
                            className={`font-bold ${isPayment ? "text-emerald-400" : "text-white"}`}
                            data-testid={`text-amount-${t.id}`}
                          >
                            {isPayment ? "-" : "+"}{usd(t.amountCents)}
                          </div>
                          {t.rewardsEarnedPc > 0 && (
                            <div className="text-[#D4AF37] text-xs">+{t.rewardsEarnedPc} $Pc</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <div className="mt-8">{statementsCard}</div>
          </>
        )}
      </main>
    </div>
  );
}
