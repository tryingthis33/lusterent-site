import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/Home";
import PartnerPortal from "@/pages/PartnerPortal";
import LentCredit from "@/pages/LentCredit";
import LentCreditDashboard from "@/pages/LentCreditDashboard";
import Legal from "@/pages/Legal";
import NotFound from "@/pages/not-found";
import { LoginPage, ForgotPasswordPage, ResetPasswordPage, VerifyEmailPage } from "@/pages/Auth";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/portal" component={PartnerPortal} />
      <Route path="/lent-credit" component={LentCredit} />
      <Route path="/lent-credit/dashboard" component={LentCreditDashboard} />
      <Route path="/privacy">{() => <Legal page="privacy" />}</Route>
      <Route path="/terms">{() => <Legal page="terms" />}</Route>
      <Route path="/refund-policy">{() => <Legal page="refund-policy" />}</Route>
      <Route path="/login" component={LoginPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/verify-email" component={VerifyEmailPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
