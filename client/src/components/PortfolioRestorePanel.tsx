import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Eye, Loader2, ShieldAlert } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

const RESTORATION_PATH = "/api/admin/portfolio-restoration";

type RestorationChange = {
  key: string;
  name: string;
  action: "insert" | "update" | "noop" | "conflict";
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  changedFields: string[];
  reason?: string;
};

type RestorationPreview = {
  previewToken: string;
  changes: RestorationChange[];
  warnings: string[];
  canApply: boolean;
};

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "not set";
  return String(value);
}

function changeBadge(action: RestorationChange["action"]) {
  if (action === "insert") {
    return <Badge className="bg-blue-500/10 text-blue-300 border-blue-500/30">INSERT</Badge>;
  }
  if (action === "update") {
    return <Badge className="bg-amber-500/10 text-amber-300 border-amber-500/30">UPDATE</Badge>;
  }
  if (action === "conflict") {
    return <Badge className="bg-red-500/10 text-red-300 border-red-500/30">CONFLICT</Badge>;
  }
  return <Badge variant="outline" className="text-[#999] border-white/20">NO CHANGE</Badge>;
}

function changeSummary(change: RestorationChange): JSX.Element {
  if (change.action === "conflict") {
    return <p className="text-red-300 text-xs">{change.reason}</p>;
  }
  if (change.action === "noop") {
    return <p className="text-[#777] text-xs">The approved fields already match.</p>;
  }
  if (change.action === "insert") {
    return (
      <div className="space-y-1">
        {change.changedFields.map(field => (
          <p key={field} className="text-[#bbb] text-xs">
            <span className="text-[#D4AF37]">{field}</span>: {displayValue(change.after?.[field])}
          </p>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-1">
      {change.changedFields.map((field) => (
        <p key={field} className="text-[#bbb] text-xs">
          <span className="text-[#D4AF37]">{field}</span>:{" "}
          {displayValue(change.before?.[field])} → {displayValue(change.after?.[field])}
        </p>
      ))}
    </div>
  );
}

export default function PortfolioRestorePanel() {
  const [confirmed, setConfirmed] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const preview = useQuery<RestorationPreview>({
    queryKey: [RESTORATION_PATH],
  });
  useEffect(() => {
    setConfirmed(false);
  }, [preview.data?.previewToken]);

  const apply = useMutation({
    mutationFn: async () => {
      if (!preview.data) throw new Error("The restoration preview is not ready.");
      const response = await apiRequest("POST", RESTORATION_PATH, {
        confirmed: true,
        previewToken: preview.data.previewToken,
      });
      return (await response.json()) as { applied: boolean; preview: RestorationPreview };
    },
    onSuccess: () => {
      setSuccess("Portfolio restoration applied. The refreshed preview is now authoritative.");
      setConfirmed(false);
      queryClient.invalidateQueries({ queryKey: [RESTORATION_PATH] });
      queryClient.invalidateQueries({ queryKey: ["/api/websites"] });
    },
    onError: (error: Error) => {
      setSuccess(null);
      setConfirmed(false);
      // The API error is intentionally shown rather than turning a failed
      // or stale confirmation into a false success state.
      void error;
      void preview.refetch();
    },
  });

  const error = preview.error ?? apply.error;
  if (preview.isLoading) {
    return (
      <Card className="bg-[#050505] border-[#D4AF37]/20 rounded-[32px]" data-testid="portfolio-restore-loading">
        <CardContent className="p-8 flex items-center gap-3 text-[#D4AF37]/70 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading the read-only restoration preview...
        </CardContent>
      </Card>
    );
  }

  if (preview.isError || !preview.data) {
    return (
      <Card className="bg-[#050505] border-red-500/30 rounded-[32px]" data-testid="portfolio-restore-error">
        <CardContent className="p-8">
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Restoration preview unavailable</AlertTitle>
            <AlertDescription className="flex items-center justify-between gap-4">
              <span>{error instanceof Error ? error.message : "The admin preview could not be loaded."}</span>
              <Button variant="outline" size="sm" onClick={() => preview.refetch()}>Retry</Button>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const data = preview.data;
  const hagenz = data.changes.find((change) => change.key === "hagenz");
  const hagenzLogoPending = Boolean(hagenz && !hagenz.after?.imageUrl);
  const hasConflicts = data.changes.some((change) => change.action === "conflict");

  return (
    <Card className="bg-[#050505] border-[#D4AF37]/20 rounded-[32px] gold-shadow" data-testid="portfolio-restore-panel">
      <CardHeader className="p-8 pb-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <Eye className="w-5 h-5 text-[#D4AF37]" />
              <span className="text-[10px] uppercase tracking-[0.35em] text-[#D4AF37]/60 font-bold">Admin only</span>
            </div>
            <CardTitle className="text-2xl font-serif text-white">Portfolio restoration</CardTitle>
            <p className="text-[#999] text-sm mt-2">
              Review the narrow approved diff. Loading this panel never writes to the portfolio.
            </p>
          </div>
          {hasConflicts ? (
            <Badge className="bg-red-500/10 text-red-300 border-red-500/30">BLOCKED</Badge>
          ) : (
            <Badge className="bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/30">PREVIEW</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-8 pt-2 space-y-6">
        {data.warnings.length > 0 && (
          <Alert className="border-amber-500/30 bg-amber-500/5 text-amber-100">
            <AlertTriangle className="h-4 w-4 text-amber-300" />
            <AlertTitle>Review before confirming</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-5 space-y-1">
                {data.warnings.map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {hagenzLogoPending && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-200" data-testid="hagenz-logo-pending">
            Hagenz logo pending: no logo will be added until an approved original is supplied. Any saved logo remains untouched.
          </div>
        )}

        <div className="space-y-3">
          {data.changes.map((change) => (
            <div key={change.key} className="rounded-xl border border-white/10 bg-white/[0.02] p-4" data-testid={`portfolio-restore-${change.key}`}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-white font-medium">{change.name}</span>
                  {changeBadge(change.action)}
                </div>
                {change.changedFields.length > 0 && (
                  <span className="text-[10px] uppercase tracking-widest text-[#777]">
                    {change.changedFields.length} approved field{change.changedFields.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>
              {changeSummary(change)}
              {typeof change.after?.imageUrl === "string" && (
                <img src={change.after.imageUrl} alt={`${change.name} proposed logo`}
                  className="mt-3 h-24 w-32 object-contain rounded bg-black" />
              )}
            </div>
          ))}
        </div>

        {apply.isError && (
          <Alert variant="destructive" data-testid="portfolio-restore-apply-error">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Restoration was not applied</AlertTitle>
            <AlertDescription>
              {apply.error instanceof Error ? apply.error.message : "The confirmation failed; refresh and review the preview again."}
            </AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="border-green-500/30 bg-green-500/5 text-green-100" data-testid="portfolio-restore-success">
            <CheckCircle2 className="h-4 w-4 text-green-400" />
            <AlertTitle>Approved changes applied</AlertTitle>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-white/10 pt-5">
          <label className="flex items-start gap-3 text-xs text-[#bbb] cursor-pointer">
            <Checkbox
              checked={confirmed}
              onCheckedChange={(checked) => setConfirmed(checked === true)}
              disabled={hasConflicts || apply.isPending}
              aria-label="I reviewed the portfolio restoration preview"
              data-testid="checkbox-portfolio-restore"
            />
            <span>I reviewed every before/after change and approve this exact preview.</span>
          </label>
          <Button
            onClick={() => apply.mutate()}
            disabled={!confirmed || !data.canApply || apply.isPending}
            className="bg-[#D4AF37] text-black hover:bg-[#B8860B] font-bold"
            data-testid="button-confirm-portfolio-restoration"
          >
            {apply.isPending ? <><Loader2 className="animate-spin" /> Applying...</> : "Confirm restoration"}
          </Button>
        </div>
        {hasConflicts && (
          <p className="text-red-300 text-xs">
            Resolve the reported conflict(s), then refresh this preview. No partial restoration is available.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
