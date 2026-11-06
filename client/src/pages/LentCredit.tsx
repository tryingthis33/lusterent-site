import { useState } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CreditCard,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  Lock,
} from "lucide-react";
import type { FieldPath, UseFormReturn } from "react-hook-form";
import {
  creditApplicationSubmissionSchema,
  LENT_CREDIT_TIERS,
  BUILDER_TIERS,
  formatBuilderTierRange,
  type CreditApplicationSubmission,
  type LentCreditTierId,
  type PublicCreditApplication,
} from "@shared/schema";
import { api } from "@shared/routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";

const PARTNER_BUSINESSES = [
  "Pawn Coin ($Pc)",
  "Lusters Life Changing LLC",
  "WeParlay",
  "King Engine",
  "Tradeline Listings",
  "Affiliate Found",
  "Vapp TV",
  "People On Podcast",
  "Pc Casino",
  "Other Luster Ent affiliate",
];

const STEPS = [
  { id: "personal", label: "Personal" },
  { id: "address", label: "Address" },
  { id: "employment", label: "Employment" },
  { id: "credit", label: "Credit" },
  { id: "review", label: "Review" },
] as const;

const usd = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

function ComingSoon() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="max-w-xl text-center space-y-6">
        <CreditCard className="w-12 h-12 mx-auto text-[#D4AF37]" />
        <h1 className="text-3xl font-bold text-[#D4AF37]" data-testid="text-lent-coming-soon">LENT Credit is coming soon</h1>
        <p className="text-gray-300">
          We are building LENT Credit with a licensed lending partner so that on-time payments can be reported to the credit bureaus.
          It is not open yet: we are not accepting applications and we are not collecting Social Security numbers at this time.
        </p>
        <p className="text-gray-400 text-sm">
          Want to hear when it launches? Email <a className="underline text-[#D4AF37]" href="mailto:lusterent@gmail.com">lusterent@gmail.com</a>.
        </p>
        <Link href="/" className="inline-block text-[#D4AF37] underline" data-testid="link-lent-home">Back to Luster Ent</Link>
        <p className="text-xs text-gray-500">
          <Link href="/privacy" className="underline">Privacy Policy</Link> · <Link href="/terms" className="underline">Terms of Use</Link>
        </p>
      </div>
    </div>
  );
}

export default function LentCredit() {
  const { data, isLoading } = useQuery<{ open: boolean }>({ queryKey: ["/api/lent-credit/status"] });
  if (isLoading) return <div className="min-h-screen bg-black" />;
  if (!data?.open) return <ComingSoon />;
  return <LentCreditApplication />;
}

function LentCreditApplication() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [showApply, setShowApply] = useState(false);
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState<{ status: string; tier?: string } | null>(null);

  const form = useForm<CreditApplicationSubmission>({
    resolver: zodResolver(creditApplicationSubmissionSchema),
    mode: "onTouched",
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      dateOfBirth: "",
      ssn: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      zipCode: "",
      employmentStatus: "employed",
      employerName: "",
      jobTitle: "",
      annualIncome: 0,
      requestedTier: "starter",
      requestedLimitCents: LENT_CREDIT_TIERS[0].limitCents,
      primarySpendingBusiness: PARTNER_BUSINESSES[0],
      consentSignature: "",
      consentAccepted: false as unknown as true,
    },
  });

  const submitMutation = useMutation<PublicCreditApplication, Error, CreditApplicationSubmission>({
    mutationFn: async (data) => {
      const res = await apiRequest("POST", api.lentCredit.submitApplication.path, data);
      return (await res.json()) as PublicCreditApplication;
    },
    onSuccess: (data) => {
      toast({
        title: "Application Submitted",
        description: `Status: ${data.status?.toUpperCase() ?? "PENDING"}`,
      });
      setSubmitted({ status: data.status, tier: data.requestedTier });
      queryClient.invalidateQueries({ queryKey: [api.lentCredit.myApplication.path] });
      queryClient.invalidateQueries({ queryKey: [api.lentCredit.myAccount.path] });
    },
    onError: (err) => {
      toast({
        title: "Submission Failed",
        description: err?.message ?? "Please review your information and try again.",
        variant: "destructive",
      });
    },
  });

  const fieldsByStep: Record<number, FieldPath<CreditApplicationSubmission>[]> = {
    0: ["firstName", "lastName", "email", "phone", "dateOfBirth", "ssn"],
    1: ["addressLine1", "addressLine2", "city", "state", "zipCode"],
    2: ["employmentStatus", "employerName", "jobTitle", "annualIncome"],
    3: ["requestedTier", "requestedLimitCents", "primarySpendingBusiness"],
    4: ["consentSignature", "consentAccepted"],
  };

  const next = async () => {
    const valid = await form.trigger(fieldsByStep[step]);
    if (valid) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const onSubmit = (data: CreditApplicationSubmission) => submitMutation.mutate(data);

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <nav className="fixed top-0 w-full z-50 bg-black/90 backdrop-blur-xl border-b border-[#D4AF37]/20">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-[#D4AF37]/60 hover:text-[#D4AF37] transition-all"
            data-testid="link-home"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-[10px] font-bold tracking-[0.3em] uppercase">Luster Ent</span>
          </Link>
          <div className="flex items-center gap-4">
            {isAuthenticated && (
              <Button
                asChild
                variant="outline"
                className="border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/10 text-[9px] font-bold tracking-widest h-8 px-4 rounded-full"
              >
                <Link href="/lent-credit/dashboard" data-testid="link-dashboard">My Dashboard</Link>
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="pt-40 pb-20 px-6 text-center max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="inline-flex items-center gap-3 mb-8 bg-[#D4AF37]/10 border border-[#D4AF37]/20 rounded-full px-5 py-2">
            <CreditCard className="w-4 h-4 text-[#D4AF37]" />
            <span className="text-[10px] tracking-[0.3em] uppercase text-[#D4AF37] font-bold">
              A Luster Ent Inc. Brand
            </span>
          </div>
          <h1 className="text-5xl md:text-8xl font-serif text-gold-shiny leading-tight mb-6">
            LENT Credit
          </h1>
          <p className="text-[#D4AF37]/60 text-xl md:text-2xl font-light leading-relaxed max-w-3xl mx-auto mb-10">
            Revolving USD credit lines spendable across the Luster Ent portfolio.
            Earn <span className="text-[#D4AF37] font-medium">$Pc cashback</span> on every purchase.
            Build credit with bureau-reported activity.
          </p>
          <Button
            onClick={() => {
              setShowApply(true);
              setSubmitted(null);
              setStep(0);
              setTimeout(() => document.getElementById("apply")?.scrollIntoView({ behavior: "smooth" }), 50);
            }}
            className="bg-[#D4AF37] text-black hover:bg-[#B8860B] h-14 px-12 rounded-full font-bold uppercase tracking-widest text-sm"
            data-testid="button-apply-now"
          >
            Apply Now <ArrowRight className="w-4 h-4 ml-3" />
          </Button>
        </motion.div>
      </header>

      {/* Tier cards */}
      <section className="max-w-7xl mx-auto px-6 py-16 border-t border-[#D4AF37]/10">
        <div className="text-center mb-16">
          <h2 className="text-[#D4AF37] uppercase text-[10px] tracking-[0.5em] font-bold mb-4">
            Credit Tiers
          </h2>
          <h3 className="text-4xl md:text-6xl font-serif text-gold-shiny">Five Tiers. One Brand.</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
          {LENT_CREDIT_TIERS.map((t) => (
            <div
              key={t.id}
              className="bg-[#050505] border border-[#D4AF37]/15 rounded-3xl p-6 hover:border-[#D4AF37]/40 transition-all gold-shadow"
              data-testid={`card-tier-${t.id}`}
            >
              <div className="text-[#D4AF37]/60 text-[9px] font-bold tracking-[0.3em] uppercase mb-3">
                {t.name}
              </div>
              <div className="text-3xl font-serif text-gold-shiny mb-3">
                {t.limitCents >= 200000000 ? `Up to ${usd(t.limitCents)}+` : usd(t.limitCents)}
              </div>
              <div className="text-[#888] text-xs mb-4">
                {t.id === "starter"
                  ? "Build from day one"
                  : t.id === "platinum"
                  ? "Multi-million credit lines"
                  : `Limit up to ${usd(t.limitCents)}`}
              </div>
              <div className="flex items-center gap-2 text-[#D4AF37] text-sm">
                <Sparkles className="w-3.5 h-3.5" />
                <span className="font-bold">{t.rewardsRate}% $Pc cashback</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Credit-builder membership ladder */}
      <section className="max-w-7xl mx-auto px-6 py-16 border-t border-[#D4AF37]/10">
        <div className="text-center mb-16">
          <h2 className="text-[#D4AF37] uppercase text-[10px] tracking-[0.5em] font-bold mb-4">
            Credit-Builder Membership
          </h2>
          <h3 className="text-4xl md:text-6xl font-serif text-gold-shiny">Build Credit. Six Tiers.</h3>
          <p className="text-[#888] text-sm max-w-2xl mx-auto mt-6 leading-relaxed">
            Not approved for a spendable line? Choose a builder tier and we open a reporting-only
            tradeline at that limit — reported to Equifax, Experian, and TransUnion every month you
            pay on time. No spending power, just steady credit history.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          {BUILDER_TIERS.map((t) => (
            <div
              key={t.id}
              className="bg-[#050505] border border-[#D4AF37]/15 rounded-3xl p-6 hover:border-[#D4AF37]/40 transition-all gold-shadow"
              data-testid={`card-builder-tier-${t.id}`}
            >
              <div className="text-[#D4AF37]/60 text-[9px] font-bold tracking-[0.3em] uppercase mb-3">
                {t.name}
              </div>
              <div className="text-2xl font-serif text-gold-shiny mb-2">
                ${(t.monthlyFeeCents / 100).toFixed(2)}
                <span className="text-sm text-[#888]">/mo</span>
              </div>
              <div className="text-[#888] text-xs">
                Reported limit {formatBuilderTierRange(t)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* $Pc + $PcPay rewards explanation */}
      <section className="max-w-5xl mx-auto px-6 py-20 text-center border-t border-[#D4AF37]/10">
        <h3 className="text-3xl md:text-5xl font-serif text-gold-shiny mb-6">
          $Pc Cashback. $PcPay Settlement.
        </h3>
        <p className="text-[#888] text-lg leading-relaxed max-w-3xl mx-auto mb-10">
          Every dollar charged to a LENT Credit line earns <span className="text-[#D4AF37]">$Pc</span>{" "}
          cashback at your tier rate. Spend across affiliates settles on the{" "}
          <span className="text-[#D4AF37]">$PcPay Gateway</span>, the same rails powering Pawn Coin
          and the wider Luster Ent portfolio.
        </p>
        <div className="flex items-center justify-center gap-3 text-[#D4AF37]/40 text-[10px] tracking-[0.3em] uppercase font-bold">
          <ShieldCheck className="w-4 h-4" /> FCRA · ECOA Compliant · Subject to Approval
        </div>
      </section>

      {/* Application Form */}
      <section
        id="apply"
        className="max-w-3xl mx-auto px-6 py-20 border-t border-[#D4AF37]/10"
      >
        {!showApply && (
          <div className="text-center">
            <Button
              onClick={() => {
                setShowApply(true);
                setSubmitted(null);
                setStep(0);
              }}
              className="bg-[#D4AF37] text-black hover:bg-[#B8860B] h-14 px-12 rounded-full font-bold uppercase tracking-widest"
              data-testid="button-start-application"
            >
              Start Application
            </Button>
          </div>
        )}

        {showApply && submitted && (
          <div className="bg-[#050505] border border-[#D4AF37]/20 rounded-3xl p-10 text-center gold-shadow">
            <CheckCircle2 className="w-12 h-12 text-[#D4AF37] mx-auto mb-6" />
            <h3 className="text-3xl font-serif text-gold-shiny mb-3">
              Application {submitted.status === "approved" ? "Approved" : "Received"}
            </h3>
            <p className="text-[#888] mb-6" data-testid="text-submission-status">
              {submitted.status === "approved"
                ? "Your LENT Credit account has been provisioned. View your dashboard for details."
                : submitted.status === "denied"
                ? "We were unable to approve your application at this time."
                : "Your application is under review. You'll be contacted by email."}
            </p>
            {isAuthenticated && (
              <Button
                asChild
                className="bg-[#D4AF37] text-black hover:bg-[#B8860B] h-12 px-8 rounded-full font-bold uppercase tracking-widest"
              >
                <Link href="/lent-credit/dashboard" data-testid="link-go-to-dashboard">Go to Dashboard</Link>
              </Button>
            )}
            {!isAuthenticated && (
              <p className="text-[#666] text-xs mt-6 flex items-center justify-center gap-2">
                <Lock className="w-3 h-3" /> Sign in with a partner account to access your dashboard.
              </p>
            )}
          </div>
        )}

        {showApply && !submitted && (
          <div className="bg-[#050505] border border-[#D4AF37]/20 rounded-3xl p-8 md:p-10 gold-shadow">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-serif text-gold-shiny">
                Step {step + 1} of {STEPS.length}: {STEPS[step].label}
              </h3>
              <div className="flex gap-1.5">
                {STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 w-8 rounded-full ${
                      i <= step ? "bg-[#D4AF37]" : "bg-[#D4AF37]/15"
                    }`}
                  />
                ))}
              </div>
            </div>

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit, (errors) => {
                  toast({
                    title: "Please review highlighted fields",
                    description: `${Object.keys(errors).length} field(s) need attention.`,
                    variant: "destructive",
                  });
                })}
                className="space-y-5"
              >
                {step === 0 && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name</FormLabel>
                            <FormControl>
                              <Input data-testid="input-firstName" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last Name</FormLabel>
                            <FormControl>
                              <Input data-testid="input-lastName" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" data-testid="input-email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input data-testid="input-phone" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="dateOfBirth"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Date of Birth</FormLabel>
                            <FormControl>
                              <Input type="date" data-testid="input-dateOfBirth" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="ssn"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SSN</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="123-45-6789"
                                autoComplete="off"
                                data-testid="input-ssn"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <p className="text-[#666] text-[10px] flex items-center gap-2">
                      <Lock className="w-3 h-3" /> Your SSN is transmitted securely and never shown again.
                    </p>
                  </>
                )}

                {step === 1 && (
                  <>
                    <FormField
                      control={form.control}
                      name="addressLine1"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address Line 1</FormLabel>
                          <FormControl>
                            <Input data-testid="input-addressLine1" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="addressLine2"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address Line 2 (optional)</FormLabel>
                          <FormControl>
                            <Input
                              data-testid="input-addressLine2"
                              {...field}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>City</FormLabel>
                            <FormControl>
                              <Input data-testid="input-city" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="state"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>State</FormLabel>
                            <FormControl>
                              <Input maxLength={2} data-testid="input-state" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="zipCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>ZIP</FormLabel>
                            <FormControl>
                              <Input data-testid="input-zipCode" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </>
                )}

                {step === 2 && (
                  <>
                    <FormField
                      control={form.control}
                      name="employmentStatus"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Employment Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-employmentStatus">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="employed">Employed</SelectItem>
                              <SelectItem value="self-employed">Self-employed</SelectItem>
                              <SelectItem value="unemployed">Unemployed</SelectItem>
                              <SelectItem value="retired">Retired</SelectItem>
                              <SelectItem value="student">Student</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="employerName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Employer Name (optional)</FormLabel>
                          <FormControl>
                            <Input
                              data-testid="input-employerName"
                              {...field}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="jobTitle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Job Title (optional)</FormLabel>
                          <FormControl>
                            <Input
                              data-testid="input-jobTitle"
                              {...field}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="annualIncome"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Annual Income (USD)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              data-testid="input-annualIncome"
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                {step === 3 && (
                  <>
                    <FormField
                      control={form.control}
                      name="requestedTier"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Requested Tier</FormLabel>
                          <Select
                            onValueChange={(v) => {
                              field.onChange(v);
                              const t = LENT_CREDIT_TIERS.find((x) => x.id === (v as LentCreditTierId));
                              if (t) form.setValue("requestedLimitCents", t.limitCents);
                            }}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-requestedTier">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {LENT_CREDIT_TIERS.map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                  {t.name} — up to {usd(t.limitCents)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="requestedLimitCents"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Requested Limit (USD)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={20}
                              step={1}
                              value={Math.floor((field.value ?? 0) / 100)}
                              onChange={(e) =>
                                field.onChange(Math.round(Number(e.target.value) * 100))
                              }
                              data-testid="input-requestedLimit"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="primarySpendingBusiness"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Primary Spending Business</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value ?? PARTNER_BUSINESSES[0]}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-spendingBusiness">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {PARTNER_BUSINESSES.map((b) => (
                                <SelectItem key={b} value={b}>
                                  {b}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                {step === 4 && (
                  <div className="space-y-4 text-sm">
                    <Summary form={form} />
                    <div className="bg-black/40 border border-[#D4AF37]/15 rounded-2xl p-5 text-[#888] text-xs leading-relaxed space-y-2">
                      <p className="text-[#D4AF37] font-bold tracking-widest uppercase text-[10px]">
                        Agreements &amp; Authorizations
                      </p>
                      <p>
                        By signing below you agree to the LENT Credit Cardholder Agreement and
                        Truth-in-Lending terms, consent to electronic records and signatures under
                        the E-SIGN Act, and authorize LENT Credit and its banking-as-a-service
                        partner to verify your identity and obtain your consumer credit report from
                        Equifax, Experian, and TransUnion. We comply with the Fair Credit Reporting
                        Act (FCRA) and the Equal Credit Opportunity Act (ECOA). If we cannot approve
                        a spendable line, you may qualify for our credit-builder membership.
                      </p>
                    </div>

                    <FormField
                      control={form.control}
                      name="consentSignature"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[#D4AF37] text-xs tracking-widest uppercase">
                            Electronic Signature (type your full legal name)
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Jane A. Doe"
                              className="bg-black/40 border-[#D4AF37]/30 text-white"
                              data-testid="input-consent-signature"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="consentAccepted"
                      render={({ field }) => (
                        <FormItem className="flex items-start gap-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value === true}
                              onCheckedChange={(c) => field.onChange(c === true)}
                              className="mt-1 border-[#D4AF37]/40 data-[state=checked]:bg-[#D4AF37] data-[state=checked]:text-black"
                              data-testid="checkbox-consent"
                            />
                          </FormControl>
                          <div className="space-y-1">
                            <FormLabel className="text-[#ccc] text-xs leading-relaxed font-normal">
                              I have read and agree to the agreements above, and I certify the
                              information I provided is accurate.
                            </FormLabel>
                            <FormMessage />
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                <div className="flex justify-between pt-6 border-t border-[#D4AF37]/10">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={step === 0}
                    onClick={() => setStep((s) => Math.max(0, s - 1))}
                    className="border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/10 rounded-full"
                    data-testid="button-back"
                  >
                    Back
                  </Button>
                  {step < STEPS.length - 1 ? (
                    <Button
                      type="button"
                      onClick={next}
                      className="bg-[#D4AF37] text-black hover:bg-[#B8860B] rounded-full font-bold uppercase tracking-widest"
                      data-testid="button-next"
                    >
                      Continue <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      disabled={submitMutation.isPending}
                      className="bg-[#D4AF37] text-black hover:bg-[#B8860B] rounded-full font-bold uppercase tracking-widest"
                      data-testid="button-submit-application"
                    >
                      {submitMutation.isPending ? "Submitting..." : "Submit Application"}
                    </Button>
                  )}
                </div>
              </form>
            </Form>
          </div>
        )}
      </section>

      <footer className="border-t border-[#D4AF37]/10 py-12 text-center text-[#666] text-xs">
        © {new Date().getFullYear()} LENT Credit · A Luster Ent Inc. brand · Credit subject to approval.
      </footer>
    </div>
  );
}

function Summary({ form }: { form: UseFormReturn<CreditApplicationSubmission> }) {
  const v = form.getValues();
  const tier = LENT_CREDIT_TIERS.find((t) => t.id === v.requestedTier);
  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between border-b border-[#D4AF37]/10 py-2">
      <span className="text-[#666]">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
  return (
    <div className="space-y-1">
      <Row label="Name" value={`${v.firstName} ${v.lastName}`} />
      <Row label="Email" value={v.email} />
      <Row label="Phone" value={v.phone} />
      <Row label="Address" value={`${v.addressLine1}, ${v.city}, ${v.state} ${v.zipCode}`} />
      <Row label="Employment" value={`${v.employmentStatus}${v.employerName ? ` @ ${v.employerName}` : ""}`} />
      <Row label="Annual Income" value={`$${Number(v.annualIncome).toLocaleString("en-US")}`} />
      <Row label="Requested Tier" value={tier?.name ?? v.requestedTier} />
      <Row label="Requested Limit" value={usd(v.requestedLimitCents)} />
      <Row label="Primary Spending" value={v.primarySpendingBusiness ?? "—"} />
    </div>
  );
}
