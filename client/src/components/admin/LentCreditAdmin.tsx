import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { api, buildUrl } from "@shared/routes";
import type {
  AdminCreditApplication,
  CreditAccount,
  CreditTransaction,
  CreditMembership,
  Metro2Report,
  CreditAuditLogEntry,
  CreditDispute,
} from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert, Snowflake, Sun, FileText, Send, ScrollText, AlertTriangle, Users, UserCog } from "lucide-react";
import UsersAdmin from "./UsersAdmin";

const usd = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
    approved: "bg-green-500/10 text-green-400 border-green-500/30",
    denied: "bg-red-500/10 text-red-400 border-red-500/30",
    active: "bg-green-500/10 text-green-400 border-green-500/30",
    frozen: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    closed: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
  };
  return (
    <Badge className={`${map[status] ?? "bg-zinc-500/10 text-zinc-400"} text-[9px] tracking-widest uppercase`} data-testid={`status-${status}`}>
      {status}
    </Badge>
  );
};

function ApplicationsTable() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<AdminCreditApplication[]>({
    queryKey: [api.lentCredit.adminListApplications.path],
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: "pending" | "approved" | "denied" }) => {
      const url = buildUrl(api.lentCredit.adminUpdateApplication.path, { id });
      const res = await apiRequest("PATCH", url, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.lentCredit.adminListApplications.path] });
      queryClient.invalidateQueries({ queryKey: [api.lentCredit.adminListAccounts.path] });
      toast({ title: "Application updated" });
    },
    onError: (e: Error) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="text-[#D4AF37]/50 text-sm">Loading applications...</div>;
  if (!data?.length) return <div className="text-[#666] text-sm">No applications submitted yet.</div>;

  return (
    <div className="overflow-x-auto" data-testid="table-applications">
      <Table>
        <TableHeader>
          <TableRow className="border-[#D4AF37]/10">
            <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">ID</TableHead>
            <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">Applicant</TableHead>
            <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">SSN</TableHead>
            <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">Tier</TableHead>
            <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">Limit</TableHead>
            <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">Income</TableHead>
            <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">Location</TableHead>
            <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">Status</TableHead>
            <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">Decision</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((app) => (
            <TableRow key={app.id} className="border-[#D4AF37]/5" data-testid={`row-application-${app.id}`}>
              <TableCell className="text-[#D4AF37]/80 font-mono text-xs">#{app.id}</TableCell>
              <TableCell className="text-white text-sm">
                <div data-testid={`text-applicant-name-${app.id}`}>{app.firstName} {app.lastName}</div>
                <div className="text-[#666] text-xs">{app.email}</div>
                <div className="text-[#666] text-xs">{app.phone}</div>
              </TableCell>
              <TableCell className="text-[#D4AF37]/70 font-mono text-xs" data-testid={`text-ssn-${app.id}`}>
                •••-••-{app.ssnLast4}
              </TableCell>
              <TableCell className="text-white text-sm uppercase">{app.requestedTier}</TableCell>
              <TableCell className="text-white text-sm">{usd(app.requestedLimitCents)}</TableCell>
              <TableCell className="text-white text-sm">${app.annualIncome.toLocaleString()}</TableCell>
              <TableCell className="text-[#999] text-xs">{app.city}, {app.state}</TableCell>
              <TableCell>{statusBadge(app.status)}</TableCell>
              <TableCell>
                <Select
                  value={app.status}
                  onValueChange={(v) => updateStatus.mutate({ id: app.id, status: v as "pending" | "approved" | "denied" })}
                >
                  <SelectTrigger className="w-32 h-8 bg-black border-[#D4AF37]/20 text-white text-xs" data-testid={`select-status-${app.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approve</SelectItem>
                    <SelectItem value="denied">Deny</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function AccountsTable() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<CreditAccount[]>({
    queryKey: [api.lentCredit.adminListAccounts.path],
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: "active" | "frozen" | "closed" }) => {
      const url = buildUrl(api.lentCredit.adminUpdateAccount.path, { id });
      const res = await apiRequest("PATCH", url, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.lentCredit.adminListAccounts.path] });
      toast({ title: "Account updated" });
    },
    onError: (e: Error) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="text-[#D4AF37]/50 text-sm">Loading accounts...</div>;
  if (!data?.length) return <div className="text-[#666] text-sm">No active credit accounts yet.</div>;

  return (
    <div className="overflow-x-auto" data-testid="table-accounts">
      <Table>
        <TableHeader>
          <TableRow className="border-[#D4AF37]/10">
            <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">ID</TableHead>
            <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">User</TableHead>
            <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">Tier</TableHead>
            <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">Limit</TableHead>
            <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">Balance</TableHead>
            <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">Rewards</TableHead>
            <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">Status</TableHead>
            <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((acct) => (
            <TableRow key={acct.id} className="border-[#D4AF37]/5" data-testid={`row-account-${acct.id}`}>
              <TableCell className="text-[#D4AF37]/80 font-mono text-xs">#{acct.id}</TableCell>
              <TableCell className="text-[#999] font-mono text-xs">{acct.userId.slice(0, 12)}...</TableCell>
              <TableCell className="text-white text-sm uppercase">{acct.tier}</TableCell>
              <TableCell className="text-white text-sm">{usd(acct.limitCents)}</TableCell>
              <TableCell className="text-white text-sm">{usd(acct.balanceCents)}</TableCell>
              <TableCell className="text-[#D4AF37] text-sm">{acct.rewardsPc.toLocaleString()} $Pc</TableCell>
              <TableCell>{statusBadge(acct.status)}</TableCell>
              <TableCell>
                {acct.status === "frozen" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-green-500/30 text-green-400 hover:bg-green-500/10 h-8 text-xs"
                    onClick={() => updateStatus.mutate({ id: acct.id, status: "active" })}
                    data-testid={`button-unfreeze-${acct.id}`}
                  >
                    <Sun className="w-3 h-3 mr-1" /> Unfreeze
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 h-8 text-xs"
                    onClick={() => updateStatus.mutate({ id: acct.id, status: "frozen" })}
                    data-testid={`button-freeze-${acct.id}`}
                    disabled={acct.status === "closed"}
                  >
                    <Snowflake className="w-3 h-3 mr-1" /> Freeze
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function TransactionsTable() {
  const { data, isLoading } = useQuery<CreditTransaction[]>({
    queryKey: [api.lentCredit.adminListTransactions.path],
  });

  if (isLoading) return <div className="text-[#D4AF37]/50 text-sm">Loading transactions...</div>;
  if (!data?.length) return <div className="text-[#666] text-sm">No recent transactions.</div>;

  return (
    <div className="overflow-x-auto" data-testid="table-transactions">
      <Table>
        <TableHeader>
          <TableRow className="border-[#D4AF37]/10">
            <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">ID</TableHead>
            <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">Account</TableHead>
            <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">Merchant</TableHead>
            <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">Amount</TableHead>
            <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">Rewards</TableHead>
            <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">When</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((tx) => (
            <TableRow key={tx.id} className="border-[#D4AF37]/5" data-testid={`row-transaction-${tx.id}`}>
              <TableCell className="text-[#D4AF37]/80 font-mono text-xs">#{tx.id}</TableCell>
              <TableCell className="text-[#999] font-mono text-xs">#{tx.accountId}</TableCell>
              <TableCell className="text-white text-sm">{tx.merchantName}</TableCell>
              <TableCell className="text-white text-sm">{usd(tx.amountCents)}</TableCell>
              <TableCell className="text-[#D4AF37] text-sm">+{tx.rewardsEarnedPc} $Pc</TableCell>
              <TableCell className="text-[#666] text-xs">
                {tx.createdAt ? new Date(tx.createdAt).toLocaleString() : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function MembershipsTable() {
  const { data, isLoading } = useQuery<CreditMembership[]>({
    queryKey: [api.lentCredit.adminListMemberships.path],
  });

  if (isLoading) return <div className="text-[#D4AF37]/50 text-sm">Loading memberships...</div>;
  if (!data?.length) return <div className="text-[#666] text-sm">No active memberships yet.</div>;

  return (
    <div className="overflow-x-auto" data-testid="table-memberships">
      <Table>
        <TableHeader>
          <TableRow className="border-[#D4AF37]/10">
            <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">ID</TableHead>
            <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">User</TableHead>
            <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">Plan</TableHead>
            <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">Tier</TableHead>
            <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">Billing</TableHead>
            <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">Fee</TableHead>
            <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">Status</TableHead>
            <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">Period End</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((m) => (
            <TableRow key={m.id} className="border-[#D4AF37]/5" data-testid={`row-membership-${m.id}`}>
              <TableCell className="text-[#D4AF37]/80 font-mono text-xs">#{m.id}</TableCell>
              <TableCell className="text-[#999] font-mono text-xs">{m.userId.slice(0, 12)}...</TableCell>
              <TableCell className="text-white text-sm uppercase">{m.plan}</TableCell>
              <TableCell className="text-white text-sm uppercase">{(m as CreditMembership & { tier?: string }).tier ?? "—"}</TableCell>
              <TableCell className="text-white text-sm">{m.billingRail}</TableCell>
              <TableCell className="text-white text-sm">{usd(m.monthlyFeeCents)}</TableCell>
              <TableCell>{statusBadge(m.status)}</TableCell>
              <TableCell className="text-[#666] text-xs">
                {m.currentPeriodEnd ? new Date(m.currentPeriodEnd).toLocaleDateString() : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function Metro2Table() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<Metro2Report[]>({
    queryKey: [api.lentCredit.adminListMetro2.path],
  });
  const [periodKey, setPeriodKey] = useState("");

  const generate = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", api.lentCredit.adminGenerateMetro2.path, periodKey ? { periodKey } : {});
      return (await res.json()) as Metro2Report;
    },
    onSuccess: () => {
      toast({ title: "Metro 2 file generated" });
      queryClient.invalidateQueries({ queryKey: [api.lentCredit.adminListMetro2.path] });
    },
    onError: (e: Error) => toast({ title: "Generation failed", description: e.message, variant: "destructive" }),
  });

  const transmit = useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.lentCredit.adminTransmitMetro2.path, { id });
      const res = await apiRequest("POST", url);
      return (await res.json()) as Metro2Report;
    },
    onSuccess: () => {
      toast({ title: "Metro 2 file transmitted" });
      queryClient.invalidateQueries({ queryKey: [api.lentCredit.adminListMetro2.path] });
    },
    onError: (e: Error) => toast({ title: "Transmission failed", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="text-[#D4AF37]/50 text-sm">Loading Metro 2 reports...</div>;

  return (
    <div className="space-y-4" data-testid="table-metro2">
      <div className="flex items-center gap-3">
        <Input
          placeholder="YYYY-MM (optional, default current month)"
          value={periodKey}
          onChange={(e) => setPeriodKey(e.target.value)}
          className="bg-black border-[#D4AF37]/20 text-white text-xs w-72"
          data-testid="input-period-key"
        />
        <Button
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
          className="bg-[#D4AF37] text-black hover:bg-[#B8860B] rounded-full font-bold uppercase tracking-widest text-xs"
          data-testid="button-generate-metro2"
        >
          <FileText className="w-3 h-3 mr-1" /> Generate
        </Button>
      </div>

      {!data?.length && <div className="text-[#666] text-sm">No Metro 2 files generated yet.</div>}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-[#D4AF37]/10">
              <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">ID</TableHead>
              <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">Period</TableHead>
              <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">Bureau</TableHead>
              <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">Records</TableHead>
              <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">Status</TableHead>
              <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.map((r) => (
              <TableRow key={r.id} className="border-[#D4AF37]/5" data-testid={`row-metro2-${r.id}`}>
                <TableCell className="text-[#D4AF37]/80 font-mono text-xs">#{r.id}</TableCell>
                <TableCell className="text-white text-sm">{r.periodKey}</TableCell>
                <TableCell className="text-white text-sm">{r.bureau}</TableCell>
                <TableCell className="text-white text-sm">{r.recordCount}</TableCell>
                <TableCell>{statusBadge(r.status)}</TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/10 h-8 text-xs"
                    disabled={transmit.isPending || r.status !== "generated"}
                    onClick={() => transmit.mutate(r.id)}
                    data-testid={`button-transmit-metro2-${r.id}`}
                  >
                    <Send className="w-3 h-3 mr-1" /> Transmit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function AuditLogTable() {
  const { data, isLoading } = useQuery<CreditAuditLogEntry[]>({
    queryKey: [api.lentCredit.adminListAuditLog.path],
  });

  if (isLoading) return <div className="text-[#D4AF37]/50 text-sm">Loading audit log...</div>;
  if (!data?.length) return <div className="text-[#666] text-sm">No audit entries yet.</div>;

  return (
    <div className="overflow-x-auto" data-testid="table-audit-log">
      <Table>
        <TableHeader>
          <TableRow className="border-[#D4AF37]/10">
            <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">When</TableHead>
            <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">Actor</TableHead>
            <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">Action</TableHead>
            <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">Entity</TableHead>
            <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((entry) => (
            <TableRow key={entry.id} className="border-[#D4AF37]/5" data-testid={`row-audit-${entry.id}`}>
              <TableCell className="text-[#666] text-xs">
                {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : "—"}
              </TableCell>
              <TableCell className="text-[#999] font-mono text-xs">
                {entry.actorType} / {entry.actorId?.slice(0, 12) ?? "system"}
              </TableCell>
              <TableCell className="text-[#D4AF37] text-sm font-mono">{entry.action}</TableCell>
              <TableCell className="text-white text-sm">{entry.entityType} #{entry.entityId}</TableCell>
              <TableCell className="text-[#666] text-xs">
                {entry.metadata ? JSON.stringify(entry.metadata).slice(0, 80) : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function DisputesTable() {
  const { data, isLoading } = useQuery<CreditDispute[]>({
    queryKey: [api.lentCredit.adminListDisputes.path],
  });

  if (isLoading) return <div className="text-[#D4AF37]/50 text-sm">Loading disputes...</div>;
  if (!data?.length) return <div className="text-[#666] text-sm">No disputes filed yet.</div>;

  return (
    <div className="overflow-x-auto" data-testid="table-disputes">
      <Table>
        <TableHeader>
          <TableRow className="border-[#D4AF37]/10">
            <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">ID</TableHead>
            <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">Account</TableHead>
            <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">User</TableHead>
            <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">Channel</TableHead>
            <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">Reason</TableHead>
            <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">Status</TableHead>
            <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">FCRA Due</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((d) => (
            <TableRow key={d.id} className="border-[#D4AF37]/5" data-testid={`row-dispute-${d.id}`}>
              <TableCell className="text-[#D4AF37]/80 font-mono text-xs">#{d.id}</TableCell>
              <TableCell className="text-[#999] font-mono text-xs">#{d.accountId}</TableCell>
              <TableCell className="text-[#999] font-mono text-xs">{d.userId?.slice(0, 12) ?? "—"}</TableCell>
              <TableCell className="text-white text-sm">{d.channel}</TableCell>
              <TableCell className="text-[#ccc] text-xs">{d.reasonCode ?? d.description}</TableCell>
              <TableCell>{statusBadge(d.status)}</TableCell>
              <TableCell className="text-[#666] text-xs">
                {d.fcraDueDate ? new Date(d.fcraDueDate).toLocaleDateString() : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function LentCreditAdmin() {
  const { toast } = useToast();
  const generateStatements = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", api.lentCredit.adminGenerateStatements.path);
      return (await res.json()) as { generated: number };
    },
    onSuccess: (data) => {
      toast({ title: `Statements generated: ${data.generated}` });
    },
    onError: (e: Error) => toast({ title: "Generation failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Card className="bg-[#050505] border-[#D4AF37]/20 rounded-[40px] p-8 gold-shadow" data-testid="card-lent-credit-admin">
      <div className="flex items-center gap-3 mb-8">
        <ShieldAlert className="text-[#D4AF37] w-6 h-6" />
        <div>
          <h3 className="text-2xl font-serif text-white">LENT Credit Administration</h3>
          <p className="text-[#666] text-xs uppercase tracking-widest">Triage applications · Manage accounts · Audit activity</p>
        </div>
      </div>

      <Tabs defaultValue="applications" className="w-full">
        <TabsList className="bg-black border border-[#D4AF37]/20 mb-6 flex-wrap h-auto">
          <TabsTrigger value="applications" data-testid="tab-applications" className="data-[state=active]:bg-[#D4AF37]/10 data-[state=active]:text-[#D4AF37]">
            Applications
          </TabsTrigger>
          <TabsTrigger value="accounts" data-testid="tab-accounts" className="data-[state=active]:bg-[#D4AF37]/10 data-[state=active]:text-[#D4AF37]">
            Accounts
          </TabsTrigger>
          <TabsTrigger value="transactions" data-testid="tab-transactions" className="data-[state=active]:bg-[#D4AF37]/10 data-[state=active]:text-[#D4AF37]">
            Transactions
          </TabsTrigger>
          <TabsTrigger value="memberships" data-testid="tab-memberships" className="data-[state=active]:bg-[#D4AF37]/10 data-[state=active]:text-[#D4AF37]">
            <Users className="w-3 h-3 mr-1" /> Memberships
          </TabsTrigger>
          <TabsTrigger value="metro2" data-testid="tab-metro2" className="data-[state=active]:bg-[#D4AF37]/10 data-[state=active]:text-[#D4AF37]">
            <ScrollText className="w-3 h-3 mr-1" /> Metro 2
          </TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit" className="data-[state=active]:bg-[#D4AF37]/10 data-[state=active]:text-[#D4AF37]">
            <AlertTriangle className="w-3 h-3 mr-1" /> Audit
          </TabsTrigger>
          <TabsTrigger value="disputes" data-testid="tab-disputes" className="data-[state=active]:bg-[#D4AF37]/10 data-[state=active]:text-[#D4AF37]">
            <AlertTriangle className="w-3 h-3 mr-1" /> Disputes
          </TabsTrigger>
          <TabsTrigger value="users" data-testid="tab-users" className="data-[state=active]:bg-[#D4AF37]/10 data-[state=active]:text-[#D4AF37]">
            <UserCog className="w-3 h-3 mr-1" /> Users
          </TabsTrigger>
        </TabsList>

        <TabsContent value="applications">
          <ApplicationsTable />
        </TabsContent>
        <TabsContent value="accounts">
          <AccountsTable />
        </TabsContent>
        <TabsContent value="transactions">
          <TransactionsTable />
        </TabsContent>
        <TabsContent value="memberships">
          <MembershipsTable />
        </TabsContent>
        <TabsContent value="metro2">
          <Metro2Table />
        </TabsContent>
        <TabsContent value="audit">
          <AuditLogTable />
        </TabsContent>
        <TabsContent value="disputes">
          <DisputesTable />
        </TabsContent>
        <TabsContent value="users">
          <UsersAdmin />
        </TabsContent>
      </Tabs>
    </Card>
  );
}
