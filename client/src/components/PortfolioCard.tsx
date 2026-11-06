import { useState } from "react";
import { Website } from "@shared/schema";
import { motion } from "framer-motion";
import { TrendingUp, DollarSign, BarChart3, Globe, ExternalLink, Share2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface PortfolioCardProps {
  site: Website;
  onClick: () => void;
  onShare: (platform?: 'twitter' | 'facebook' | 'linkedin') => void;
}

export function PortfolioCard({ site, onClick, onShare }: PortfolioCardProps) {
  const name = site.name.toLowerCase();
  const isWide = name.includes("ai assist");
  const isBigger = name.includes("hagenz") || name.includes("travel") || name.includes("casino");
  const isCircle = name.includes("lent credit") || name.includes("casino");
  const sizeClass = isWide
    ? "w-full max-w-[260px] h-auto"
    : isBigger
      ? "w-36 h-36"
      : "w-24 h-24";
  const imgClass = [
    sizeClass,
    "object-contain filter drop-shadow-[0_0_15px_rgba(212,175,55,0.3)] group-hover:scale-110 transition-transform duration-700",
    isCircle ? "rounded-full bg-black border border-[#D4AF37]/20" : "",
  ].join(" ");
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="group"
      data-testid={`card-portfolio-${site.id}`}
    >
      <Card className="bg-[#050505] border-[#D4AF37]/10 rounded-[40px] overflow-hidden hover:border-[#D4AF37]/30 transition-all duration-500 gold-shadow h-full flex flex-col">
        <div className="relative aspect-[4/3] overflow-hidden bg-black flex items-center justify-center p-12">
          <div className="absolute inset-0 bg-gradient-to-br from-[#D4AF37]/5 to-transparent opacity-50" />
          <img
            src={site.imageUrl || ""}
            alt={site.name}
            className={imgClass}
          />
          <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
             <Button
              size="icon"
              variant="ghost"
              onClick={(e) => { e.stopPropagation(); onShare(); }}
              className="rounded-full bg-black/60 border border-[#D4AF37]/20 text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black"
            >
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <CardContent className="p-8 flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <Badge variant="outline" className="border-[#D4AF37]/20 text-[#D4AF37] text-[10px] font-bold tracking-widest uppercase rounded-full">
              {site.category}
            </Badge>
            <div className="flex items-center gap-1.5 text-green-500 font-bold text-xs">
              <TrendingUp className="w-3.5 h-3.5" />
              {site.growth || "+0%"}
            </div>
          </div>

          <h4 className="text-2xl font-serif text-gold-shiny mb-3">{site.name}</h4>
          <p className="text-[#888] text-sm leading-relaxed mb-8 flex-1">
            {site.description}
          </p>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
              <div className="flex items-center gap-2 text-[#666] text-[10px] uppercase tracking-wider mb-1">
                <BarChart3 className="w-3 h-3" /> Market Cap
              </div>
              <div className="text-[#D4AF37] font-bold">{site.marketCap || "N/A"}</div>
            </div>
            <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
              <div className="flex items-center gap-2 text-[#666] text-[10px] uppercase tracking-wider mb-1">
                <DollarSign className="w-3 h-3" /> Revenue
              </div>
              <div className="text-[#D4AF37] font-bold">{site.revenue || "N/A"}</div>
            </div>
          </div>

          {/* $PcPay Badge */}
          <a
            href="https://pawncoinpc.com"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl border border-[#D4AF37]/15 bg-[#D4AF37]/5 hover:bg-[#D4AF37]/10 hover:border-[#D4AF37]/30 transition-all group"
            data-testid={`link-pcpay-card-${site.id}`}
          >
            <img src="/logos/pcpay.png" alt="$PcPay" className="h-4 object-contain opacity-70 group-hover:opacity-100 transition-opacity" />
            <span className="text-[#D4AF37]/50 text-[9px] font-bold tracking-[0.25em] uppercase group-hover:text-[#D4AF37]/80 transition-colors">$Pc Accepted · $PcPay Gateway</span>
          </a>

          <div className="flex items-center gap-3">
            <Button
              onClick={onClick}
              className="flex-1 bg-gradient-to-r from-[#B8860B] via-[#FFD700] to-[#B8860B] text-black font-bold text-[10px] tracking-widest uppercase h-12 rounded-xl hover:opacity-90 transition-all shadow-[0_5px_15px_rgba(212,175,55,0.15)]"
              data-testid={`button-details-${site.id}`}
            >
              View Analysis
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="border-[#D4AF37]/20 text-[#D4AF37] h-12 w-12 rounded-xl hover:bg-[#D4AF37]/10"
              asChild
            >
              <a href={site.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
