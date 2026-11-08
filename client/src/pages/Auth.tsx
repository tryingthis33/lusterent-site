import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Result = { ok: boolean; message: string; needsVerification?: boolean };

async function post(url: string, body: unknown): Promise<Result> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, message: data.message ?? (res.ok ? "Done." : "Something went wrong."), needsVerification: data.needsVerification };
  } catch {
    return { ok: false, message: "Network error. Please try again." };
  }
}

function Shell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-primary/30">
        <CardHeader>
          <Link href="/" className="text-xs uppercase tracking-widest text-primary mb-2">Luster Entertainment Inc.</Link>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}

function Notice({ result }: { result: Result | null }) {
  if (!result) return null;
  return (
    <p role="status" className={`text-sm rounded border p-3 ${result.ok ? "border-primary/40 text-primary" : "border-destructive/50 text-destructive"}`}>
      {result.message}
    </p>
  );
}

function returnTarget(): string {
  const to = new URLSearchParams(window.location.search).get("returnTo") ?? "/";
  return to.startsWith("/") && !to.startsWith("//") ? to : "/";
}

function GoogleButton() {
  const [on, setOn] = useState(false);
  useEffect(() => { fetch("/api/auth/google/enabled").then((r) => (r.ok ? r.json() : { google: false })).then((d) => setOn(!!d.google)).catch(() => {}); }, []);
  if (!on) return null;
  return (
    <a href="/api/auth/google" className="mb-4 block w-full rounded-md border bg-white px-4 py-2 text-center text-sm font-medium text-black hover:bg-gray-100" data-testid="google-sign-in">
      Continue with Google
    </a>
  );
}

export function LoginPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    if (mode === "login") {
      const r = await post("/api/auth/login", { email, password });
      if (r.ok) {
        await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        navigate(returnTarget());
        return;
      }
      setResult(r);
    } else {
      setResult(await post("/api/auth/register", { email, password, firstName, lastName }));
    }
    setBusy(false);
  }

  return (
    <Shell
      title={mode === "login" ? "Sign in" : "Create your account"}
      description={mode === "login" ? "Access your Luster Entertainment portal." : "We'll email you a link to verify your address."}
    >
      <GoogleButton />
      <form onSubmit={submit} className="space-y-4" data-testid="auth-form">
        {mode === "register" && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
            </div>
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" data-testid="input-email" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password" type="password" required minLength={mode === "register" ? 10 : 1} value={password}
            onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"}
            data-testid="input-password"
          />
          {mode === "register" && <p className="text-xs text-muted-foreground">At least 10 characters.</p>}
          {mode === "register" && (
            <p className="text-xs text-muted-foreground">
              By creating an account you agree to our <a className="underline" href="/terms" target="_blank" rel="noopener">Terms of Use</a> and{" "}
              <a className="underline" href="/privacy" target="_blank" rel="noopener">Privacy Policy</a>.
            </p>
          )}
        </div>
        <Notice result={result} />
        {result?.needsVerification && (
          <Button type="button" variant="outline" className="w-full" onClick={async () => setResult(await post("/api/auth/resend-verification", { email }).then((r) => ({ ...r, ok: true })))}>
            Resend verification email
          </Button>
        )}
        <Button type="submit" className="w-full" disabled={busy} data-testid="button-submit">
          {busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
        </Button>
      </form>
      <div className="mt-4 flex justify-between text-sm">
        <button type="button" className="text-primary hover:underline" onClick={() => { setMode(mode === "login" ? "register" : "login"); setResult(null); }}>
          {mode === "login" ? "Create an account" : "I already have an account"}
        </button>
        <Link href="/forgot-password" className="text-primary hover:underline">Forgot password?</Link>
      </div>
    </Shell>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(await post("/api/auth/forgot-password", { email }));
    setBusy(false);
  }

  return (
    <Shell title="Reset your password" description="Enter your email and we'll send you a reset link. Accounts created before the new sign-in can set their password here too.">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" data-testid="input-email" />
        </div>
        <Notice result={result} />
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Sending..." : "Send reset link"}</Button>
      </form>
      <p className="mt-4 text-sm"><Link href="/login" className="text-primary hover:underline">Back to sign in</Link></p>
    </Shell>
  );
}

export function ResetPasswordPage() {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(await post("/api/auth/reset-password", { token, password }));
    setBusy(false);
  }

  return (
    <Shell title="Choose a new password" description="Use at least 10 characters.">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="password">New password</Label>
          <Input id="password" type="password" required minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" data-testid="input-password" />
        </div>
        <Notice result={result} />
        {result?.ok ? (
          <Link href="/login"><Button type="button" className="w-full">Go to sign in</Button></Link>
        ) : (
          <Button type="submit" className="w-full" disabled={busy || !token}>{busy ? "Saving..." : "Save password"}</Button>
        )}
      </form>
    </Shell>
  );
}

export function VerifyEmailPage() {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    post("/api/auth/verify-email", { token }).then(setResult);
  }, [token]);

  return (
    <Shell title="Verify your email" description="Confirming your email address...">
      {result ? <Notice result={result} /> : <p className="text-sm text-muted-foreground">Checking your link...</p>}
      {result?.ok && <Link href="/login"><Button className="w-full mt-4">Sign in</Button></Link>}
    </Shell>
  );
}
