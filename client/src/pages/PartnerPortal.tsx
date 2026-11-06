import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Website } from "@shared/schema";
import { api } from "@shared/routes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lock, FileText, BarChart, ShieldCheck, LogOut, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import LentCreditAdmin from "@/components/admin/LentCreditAdmin";
import PortfolioRestorePanel from "@/components/PortfolioRestorePanel";

export default function PartnerPortal() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const { data: websites } = useQuery<Website[]>({
    queryKey: [api.websites.list.path],
    enabled: isAuthenticated,
  });

  const { data: adminStatus } = useQuery<{ isAdmin: boolean }>({
    queryKey: [api.admin.me.path],
    enabled: isAuthenticated,
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-pulse text-[#D4AF37] font-serif text-2xl">Authenticating Executive...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
        <Lock className="w-16 h-16 text-[#D4AF37] mb-8 opacity-20" />
        <h1 className="text-4xl md:text-6xl font-serif text-gold-shiny mb-6">Restricted Access</h1>
        <p className="text-[#D4AF37]/40 text-xl max-w-md mx-auto mb-12 font-light">
          This portal is reserved for LUSTER ENT verified partners and executive stakeholders.
        </p>
        <Button 
          className="bg-[#D4AF37] text-black hover:bg-[#B8860B] h-14 px-10 rounded-full font-bold uppercase tracking-widest"
          asChild
        >
          <a href="/api/login">Authenticate Identity</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-[#D4AF37]/30">
      <nav className="border-b border-[#D4AF37]/10 bg-black/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/">
            <a className="flex items-center gap-2 text-[#D4AF37]/60 hover:text-[#D4AF37] transition-all">
              <ArrowLeft className="w-4 h-4" /> 
              <span className="text-[10px] font-bold tracking-[0.3em] uppercase">Back to Public</span>
            </a>
          </Link>
          <div className="flex items-center gap-6">
            <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-[#D4AF37]/40">
              Executive: {user?.firstName} {user?.lastName}
            </span>
            <Button variant="ghost" size="sm" className="text-red-500/60 hover:text-red-500 text-[10px] uppercase font-bold tracking-widest" asChild>
              <a href="/api/logout">Logout <LogOut className="w-3 h-3 ml-2" /></a>
            </Button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-20 px-6">
        <header className="mb-20">
          <div className="flex items-center gap-4 mb-6">
            <ShieldCheck className="text-[#D4AF37] w-8 h-8" />
            <h2 className="text-[#D4AF37] uppercase text-[10px] tracking-[0.5em] font-bold">Partner Environment</h2>
          </div>
          <h1 className="text-5xl md:text-8xl font-serif text-gold-shiny leading-none mb-8">Executive Intelligence</h1>
          <p className="text-[#D4AF37]/40 text-xl max-w-2xl font-light">
            Real-time performance metrics and sensitive venture documentation for authorized partners.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 mb-20">
          <Card className="bg-[#050505] border-[#D4AF37]/20 rounded-[40px] p-8 gold-shadow">
            <CardHeader className="p-0 mb-8">
              <div className="flex items-center justify-between mb-4">
                <BarChart className="text-[#D4AF37] w-6 h-6" />
                <Badge className="bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/20">LIVE</Badge>
              </div>
              <CardTitle className="text-2xl font-serif text-white">Portfolio Value</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="text-5xl font-serif text-gold-shiny mb-2">$432.5M</div>
              <div className="text-green-500 text-sm font-bold tracking-wider">+18.4% YTD</div>
            </CardContent>
          </Card>

          <Card className="bg-[#050505] border-[#D4AF37]/20 rounded-[40px] p-8 gold-shadow">
            <CardHeader className="p-0 mb-8">
              <div className="flex items-center justify-between mb-4">
                <FileText className="text-[#D4AF37] w-6 h-6" />
                <Badge className="bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/20">NEW</Badge>
              </div>
              <CardTitle className="text-2xl font-serif text-white">Active Briefs</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="text-5xl font-serif text-gold-shiny mb-2">12</div>
              <div className="text-[#666] text-sm tracking-wider">Unread Intelligence</div>
            </CardContent>
          </Card>

          <Card className="bg-[#050505] border-[#D4AF37]/20 rounded-[40px] p-8 gold-shadow">
            <CardHeader className="p-0 mb-8">
              <div className="flex items-center justify-between mb-4">
                <ShieldCheck className="text-[#D4AF37] w-6 h-6" />
                <Badge className="bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/20">VERIFIED</Badge>
              </div>
              <CardTitle className="text-2xl font-serif text-white">Security Tier</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="text-5xl font-serif text-gold-shiny mb-2">BLACK</div>
              <div className="text-[#666] text-sm tracking-wider">Full Clearance Access</div>
            </CardContent>
          </Card>
        </div>

        {adminStatus?.isAdmin && (
          <section className="mb-20" data-testid="section-admin">
            <LentCreditAdmin />
            <div className="mt-12">
              <PortfolioRestorePanel />
            </div>
          </section>
        )}

        <section className="mb-20">
          <div className="flex items-center justify-between mb-12">
            <h3 className="text-3xl font-serif text-white">Venture Performance</h3>
            <Button variant="outline" className="border-[#D4AF37]/20 text-[#D4AF37] hover:bg-[#D4AF37]/10 rounded-full text-[10px] font-bold uppercase tracking-widest h-10 px-6">
              Export Analysis
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {websites?.map((site) => (
              <Card key={site.id} className="bg-black border-[#D4AF37]/10 rounded-3xl p-6 hover:border-[#D4AF37]/30 transition-all">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center">
                    <img src={site.imageUrl || ""} className="w-6 h-6 object-contain" alt={site.name} />
                  </div>
                  <div>
                    <h4 className="font-serif text-lg text-white">{site.name}</h4>
                    <span className="text-[9px] text-[#D4AF37]/60 font-bold uppercase tracking-widest">{site.category}</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-[#666] uppercase tracking-wider">Market Cap</span>
                    <span className="text-white font-bold">{site.marketCap}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-[#666] uppercase tracking-wider">Growth</span>
                    <span className="text-green-500 font-bold">{site.growth}</span>
                  </div>
                  <div className="flex justify-between items-center pt-4 border-t border-white/5">
                    <span className="text-[10px] text-[#666] uppercase tracking-wider">Status</span>
                    <Badge variant="outline" className="text-green-500 border-green-500/20 bg-green-500/5 text-[8px] tracking-widest uppercase">STABLE</Badge>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
