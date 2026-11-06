import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Website, InsertInvestmentInquiry, CompanySetting, BlogPost, JobOpening } from "@shared/schema";
import { api } from "@shared/routes";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertInvestmentInquirySchema } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Share2, ShieldCheck, Target, Layers, Volume2, VolumeX, Twitter, Facebook, Linkedin, Newspaper, Briefcase, MapPin, Clock, Play, Pause } from "lucide-react";
import logoPng from "@assets/luster-logo.png";
const backgroundMusic = "/audio/instrumental.mp3";

import { PortfolioCard } from "@/components/PortfolioCard";
import { useAuth } from "@/hooks/use-auth";

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [selectedSite, setSelectedSite] = useState<Website | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<BlogPost | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();
  const { scrollYProgress } = useScroll();
  
  const y1 = useTransform(scrollYProgress, [0, 1], [0, -200]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
      if (!isMuted) {
        audioRef.current.play().catch(console.error);
      }
    }
  }, [isMuted]);

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (isMuted) {
      toast({ title: "Audio Enabled", description: "Luxury instrumental playing." });
    }
  };

  const { data: websites, isLoading } = useQuery<Website[]>({
    queryKey: [api.websites.list.path],
  });

  const { data: settings } = useQuery<CompanySetting[]>({
    queryKey: [api.settings.list.path],
  });

  const { data: blogPosts, isLoading: blogLoading } = useQuery<BlogPost[]>({
    queryKey: [api.blogPosts.list.path],
  });

  const { data: jobOpenings, isLoading: jobsLoading } = useQuery<JobOpening[]>({
    queryKey: [api.jobOpenings.list.path],
  });
  // The Careers section (and its menu link) only appears when there is at least one real, active opening.
  const hasOpenings = !!jobOpenings?.some((job) => job.isActive);
  // Same for News: hide the section and its menu link until at least one post is published.
  const hasNews = blogLoading || !!blogPosts?.length;

  const [isPlaying, setIsPlaying] = useState(false);

  const getSetting = (key: string) => settings?.find(s => s.key === key)?.value || "";

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        setIsMuted(false);
        audioRef.current.muted = false;
        audioRef.current.play().catch(console.error);
        setIsPlaying(true);
        toast({ title: "Audio Enabled", description: "Luxury instrumental playing." });
      }
    }
  };

  const investmentForm = useForm<InsertInvestmentInquiry>({
    resolver: zodResolver(insertInvestmentInquirySchema),
    defaultValues: {
      name: "",
      email: "",
      amount: "",
      interest: "",
      message: "",
    },
  });

  // Bot checks: a hidden field people never see, and how long the form was open.
  const honeypotRef = useRef<HTMLInputElement>(null);
  const formOpenedAt = useRef(Date.now());

  const mutation = useMutation({
    mutationFn: async (data: InsertInvestmentInquiry) => {
      const res = await fetch(api.investments.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, website: honeypotRef.current?.value ?? "", elapsedMs: Date.now() - formOpenedAt.current }),
      });
      if (!res.ok) throw new Error("Failed to submit inquiry");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Inquiry Sent", description: "Thank you for reaching out." });
      investmentForm.reset();
      formOpenedAt.current = Date.now();
    },
  });

  const handleShare = (site: Website, platform?: 'twitter' | 'facebook' | 'linkedin') => {
    const url = site.url;
    const title = site.name;
    
    if (platform === 'twitter') {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`, '_blank');
    } else if (platform === 'facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
    } else if (platform === 'linkedin') {
      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank');
    } else if (navigator.share) {
      navigator.share({ title: title, url: url }).catch(console.error);
    } else {
      navigator.clipboard.writeText(url);
      toast({ title: "Link Copied", description: "URL copied to clipboard." });
    }
  };

  return (
    <div className="min-h-screen bg-[#000] text-white font-sans selection:bg-[#D4AF37]/30 overflow-x-hidden">
      {/* Parallax Background Elements */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <motion.div 
          style={{ y: y1 }}
          className="absolute top-[10%] left-[5%] w-[500px] h-[500px] bg-[#D4AF37]/5 blur-[120px] rounded-full"
        />
        <motion.div 
          style={{ y: y2 }}
          className="absolute bottom-[20%] right-[10%] w-[600px] h-[600px] bg-[#D4AF37]/3 blur-[150px] rounded-full"
        />
      </div>

      {/* Audio Element */}
      <audio 
        ref={audioRef} 
        src={backgroundMusic} 
        preload="none"
        loop 
        muted={isMuted}
        onLoadedData={() => {
          if (audioRef.current) {
            audioRef.current.volume = 0.25;
          }
        }}
      />

      {/* Discreet Audio Player */}
      <div className="fixed bottom-6 left-6 z-50 flex items-center gap-3 bg-black/60 backdrop-blur-xl border border-[#D4AF37]/20 rounded-full px-4 py-2 gold-shadow transition-all hover:border-[#D4AF37]/40">
        <Button
          onClick={handlePlayPause}
          size="icon"
          variant="ghost"
          aria-label={isPlaying ? "Pause background music" : "Play background music"}
          className="text-[#D4AF37] hover:bg-[#D4AF37]/10 w-10 h-10 rounded-full transition-all"
          data-testid="button-audio-play"
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </Button>
        <div className="hidden sm:flex flex-col">
          <span className="text-[#D4AF37] text-[9px] font-bold tracking-[0.2em] uppercase">
            {isPlaying ? "Now Playing" : "Background Music"}
          </span>
          <span className="text-[#D4AF37]/40 text-[8px] tracking-wider">
            Luxury Instrumental
          </span>
        </div>
        <Button
          onClick={toggleMute}
          size="icon"
          variant="ghost"
          aria-label={isMuted ? "Unmute background music" : "Mute background music"}
          className="text-[#D4AF37]/60 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10 w-8 h-8 rounded-full transition-all"
          data-testid="button-audio-mute"
        >
          {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        </Button>
      </div>

      {/* Header */}
      <nav className="fixed top-0 w-full z-50 bg-black/90 backdrop-blur-xl border-b border-[#D4AF37]/20 shadow-[0_0_20px_rgba(212,175,55,0.1)]">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="logo-shine-container">
            <img src={logoPng} alt="Luster" className="h-16 drop-shadow-[0_0_8px_rgba(212,175,55,0.4)] object-contain relative z-10" />
            <div className="logo-shine-overlay" />
          </div>
          <div className="hidden md:flex gap-8 text-[10px] font-bold tracking-[0.3em] uppercase text-[#D4AF37]/60">
            <a href="#about" className="hover:text-[#D4AF37] transition-all hover:drop-shadow-[0_0_5px_rgba(212,175,55,0.5)]" data-testid="link-about">About</a>
            <a href="#portfolio" className="hover:text-[#D4AF37] transition-all hover:drop-shadow-[0_0_5px_rgba(212,175,55,0.5)]" data-testid="link-portfolio">Portfolio</a>
            {hasNews && <a href="#news" className="hover:text-[#D4AF37] transition-all hover:drop-shadow-[0_0_5px_rgba(212,175,55,0.5)]" data-testid="link-news">News</a>}
            {hasOpenings && <a href="#careers" className="hover:text-[#D4AF37] transition-all hover:drop-shadow-[0_0_5px_rgba(212,175,55,0.5)]" data-testid="link-careers">Careers</a>}
            <a href="#invest" className="hover:text-[#D4AF37] transition-all hover:drop-shadow-[0_0_5px_rgba(212,175,55,0.5)]" data-testid="link-invest">Invest</a>
            <Link href="/lent-credit" className="hover:text-[#D4AF37] transition-all hover:drop-shadow-[0_0_5px_rgba(212,175,55,0.5)]" data-testid="link-lent-credit">LENT Credit</Link>
            {isAuthenticated ? (
              <Button 
                variant="outline" 
                className="border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/10 text-[9px] font-bold tracking-widest h-8 px-4 rounded-full"
                asChild
              >
                <Link href="/portal">Partner Portal</Link>
              </Button>
            ) : (
              <Button 
                variant="outline" 
                className="border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/10 text-[9px] font-bold tracking-widest h-8 px-4 rounded-full"
                asChild
              >
                <a href="/api/login">Partner Login</a>
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="relative pt-48 pb-20 px-6 text-center z-10">
        <motion.div
          style={{ opacity: heroOpacity }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="flex flex-col items-center"
        >
          <div className="logo-shine-container mb-16">
            <img src={logoPng} alt="Luster Ent Inc." className="w-96 drop-shadow-[0_0_25px_rgba(212,175,55,0.3)] object-contain relative z-10" />
            <div className="logo-shine-overlay" />
          </div>
          <h1 className="text-6xl md:text-9xl font-serif mb-8 tracking-tighter text-gold-shiny drop-shadow-2xl flex items-baseline justify-center">
            LUSTER ENT INC
            <span className="inline-block w-[0.12em] h-[0.12em] bg-gold-shiny ml-[0.05em] align-baseline shrink-0" />
          </h1>
          <p className="text-[#D4AF37]/40 text-xl md:text-3xl max-w-3xl mx-auto font-light leading-relaxed tracking-wide">
            Defined by Vision. Powered by Innovation.
          </p>
        </motion.div>
      </header>

      {/* About Section */}
      <section id="about" className="relative py-32 px-6 max-w-7xl mx-auto border-t border-[#D4AF37]/10 z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-[#D4AF37] uppercase text-[10px] tracking-[0.5em] font-bold mb-8">Executive Vision</h2>
            <h3 className="text-5xl md:text-7xl font-serif mb-10 leading-[1.1] text-gold-shiny">What We Do</h3>
            <p className="text-[#888] text-xl leading-relaxed mb-12 font-light">
              {getSetting("about_story") ? (
                getSetting("about_story").replace("INC.", "INC■")
                  .split("■").map((part, i, arr) => (
                    <span key={i} className="flex-inline items-baseline">
                      {part}
                      {i < arr.length - 1 && (
                        <span className="inline-block w-[0.3em] h-[0.3em] bg-current ml-[0.1em] align-baseline shrink-0" />
                      )}
                    </span>
                  ))
              ) : (
                <span className="flex-inline items-baseline">
                  LUSTER ENT INC
                  <span className="inline-block w-[0.3em] h-[0.3em] bg-current ml-[0.1em] align-baseline shrink-0" />
                  is a holding company that builds and operates digital ventures across entertainment, technology and lifestyle markets.
                </span>
              )}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="p-8 bg-gradient-to-br from-white/5 to-transparent rounded-[32px] border border-[#D4AF37]/10 gold-shadow">
                <ShieldCheck className="text-[#D4AF37] mb-6 w-8 h-8 drop-shadow-[0_0_8px_rgba(212,175,55,0.5)]" />
                <h4 className="font-bold text-[10px] uppercase tracking-[0.3em] mb-4 text-[#D4AF37]">Integrity</h4>
                <p className="text-[#666] text-xs leading-relaxed">Careful execution in every venture.</p>
              </div>
              <div className="p-8 bg-gradient-to-br from-white/5 to-transparent rounded-[32px] border border-[#D4AF37]/10 gold-shadow">
                <Target className="text-[#D4AF37] mb-6 w-8 h-8 drop-shadow-[0_0_8px_rgba(212,175,55,0.5)]" />
                <h4 className="font-bold text-[10px] uppercase tracking-[0.3em] mb-4 text-[#D4AF37]">Vision</h4>
                <p className="text-[#666] text-xs leading-relaxed">Finding opportunity in complex markets.</p>
              </div>
              <div className="p-8 bg-gradient-to-br from-white/5 to-transparent rounded-[32px] border border-[#D4AF37]/10 gold-shadow">
                <Layers className="text-[#D4AF37] mb-6 w-8 h-8 drop-shadow-[0_0_8px_rgba(212,175,55,0.5)]" />
                <h4 className="font-bold text-[10px] uppercase tracking-[0.3em] mb-4 text-[#D4AF37]">Scale</h4>
                <p className="text-[#666] text-xs leading-relaxed">Building ventures that can grow across markets.</p>
              </div>
            </div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
            className="relative aspect-square bg-[#050505] rounded-[60px] border border-[#D4AF37]/20 flex items-center justify-center p-20 group gold-shadow overflow-hidden"
          >
             <div className="absolute inset-0 bg-[#D4AF37]/5 rounded-full blur-[120px] opacity-30 group-hover:opacity-60 transition-opacity duration-1000" />
             <div className="logo-shine-container w-full max-w-[400px]">
               <img src={logoPng} alt="Luster" className="relative z-10 w-full drop-shadow-[0_0_30px_rgba(212,175,55,0.4)] transition-all duration-1000 scale-90 group-hover:scale-100 object-contain" />
               <div className="logo-shine-overlay" />
             </div>
          </motion.div>
        </div>
      </section>

      {/* $PcPay Acceptance Marquee */}
      <div className="relative w-full border-y border-[#D4AF37]/20 bg-[#050505] overflow-hidden z-10 py-4">
        <div className="animate-marquee">
          {[...Array(2)].map((_, dupIdx) => (
            <div key={dupIdx} className="flex items-center gap-0">
              {Array(8).fill(null).map((_, i) => (
                <a
                  key={i}
                  href="https://pawncoinpc.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 px-10 group shrink-0"
                  data-testid={dupIdx === 0 ? `link-pcpay-marquee-${i}` : undefined}
                >
                  <img
                    src="/logos/pcpay.png"
                    alt="$PcPay Crypto Payments"
                    className="h-7 object-contain opacity-80 group-hover:opacity-100 transition-opacity"
                  />
                  <span className="text-[#D4AF37]/60 text-[10px] font-bold tracking-[0.35em] uppercase whitespace-nowrap group-hover:text-[#D4AF37] transition-colors">
                    $Pc accepted at participating affiliates · Powered by $PcPay
                  </span>
                  <span className="text-[#D4AF37]/20 text-lg">✦</span>
                </a>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Portfolio Grid */}
      <main id="portfolio" className="relative max-w-[1400px] mx-auto py-32 px-6 border-t border-[#D4AF37]/10 z-10">
        <div className="text-center mb-24">
            <h2 className="text-[#D4AF37] uppercase text-[10px] tracking-[0.5em] font-bold mb-6">Asset Portfolio</h2>
            <h3 className="text-5xl md:text-8xl font-serif text-gold-shiny">Market Mastery</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
          {isLoading ? (
            Array(9).fill(0).map((_, i) => (
              <div key={i} className="h-[560px] bg-[#0A0A0A] rounded-[50px] animate-pulse border border-[#D4AF37]/10" />
            ))
          ) : (
            websites?.map((site) => (
              <PortfolioCard 
                key={site.id} 
                site={site} 
                onClick={() => setSelectedSite(site)} 
                onShare={(platform) => handleShare(site, platform)}
              />
            ))
          )}
        </div>
      </main>

      {/* News & Updates Section */}
      {hasNews && <section id="news" className="relative py-32 px-6 max-w-7xl mx-auto border-t border-[#D4AF37]/10 z-10">
        <div className="text-center mb-16">
          <h2 className="text-[#D4AF37] uppercase text-[10px] tracking-[0.5em] font-bold mb-6">Latest Intelligence</h2>
          <h3 className="text-5xl md:text-8xl font-serif text-gold-shiny">News & Updates</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {blogLoading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="h-[320px] bg-[#0A0A0A] rounded-[40px] animate-pulse border border-[#D4AF37]/10" />
            ))
          ) : (
            blogPosts?.map((post) => (
              <motion.article
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="group bg-[#050505] rounded-[40px] border border-[#D4AF37]/10 p-8 hover:border-[#D4AF37]/30 transition-all duration-500 gold-shadow"
                data-testid={`card-news-${post.id}`}
              >
                <div className="flex items-center gap-3 mb-6">
                  <span className="bg-[#D4AF37]/10 text-[#D4AF37] px-4 py-1.5 rounded-full text-[9px] font-bold tracking-[0.3em] border border-[#D4AF37]/20 uppercase">
                    {post.category}
                  </span>
                  <span className="text-[#666] text-xs">
                    {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                  </span>
                </div>
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-[#D4AF37]/10 flex items-center justify-center shrink-0 border border-[#D4AF37]/20">
                    <Newspaper className="w-5 h-5 text-[#D4AF37]" />
                  </div>
                  <h4 className="text-2xl font-serif text-gold-shiny leading-tight group-hover:drop-shadow-[0_0_10px_rgba(212,175,55,0.3)] transition-all">
                    {post.title}
                  </h4>
                </div>
                <p className="text-[#888] text-sm leading-relaxed mb-6">
                  {post.excerpt}
                </p>
                <Button 
                  variant="ghost" 
                  className="text-[#D4AF37] text-[10px] font-bold tracking-[0.3em] uppercase p-0 h-auto hover:bg-transparent group-hover:translate-x-2 transition-transform"
                  data-testid={`button-read-more-${post.id}`}
                  onClick={() => setSelectedArticle(post)}
                >
                  Read More <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </motion.article>
            ))
          )}
        </div>
      </section>}

      {/* Careers Section */}
      {hasOpenings && <section id="careers" className="relative py-32 px-6 bg-[#050505] border-t border-[#D4AF37]/10 z-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-[#D4AF37] uppercase text-[10px] tracking-[0.5em] font-bold mb-6">Join Our Team</h2>
            <h3 className="text-5xl md:text-8xl font-serif text-gold-shiny mb-6">Careers</h3>
            <p className="text-[#D4AF37]/40 text-xl max-w-2xl mx-auto leading-relaxed font-light">
              Be part of an elite team shaping the future of digital ventures.
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {jobsLoading ? (
              Array(4).fill(0).map((_, i) => (
                <div key={i} className="h-[200px] bg-[#0A0A0A] rounded-[32px] animate-pulse border border-[#D4AF37]/10" />
              ))
            ) : (
              jobOpenings?.filter(job => job.isActive).map((job) => (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                  className="group bg-black/60 rounded-[32px] border border-[#D4AF37]/10 p-8 hover:border-[#D4AF37]/30 transition-all duration-500 gold-shadow"
                  data-testid={`card-job-${job.id}`}
                >
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <span className="bg-[#D4AF37]/10 text-[#D4AF37] px-4 py-1.5 rounded-full text-[9px] font-bold tracking-[0.3em] border border-[#D4AF37]/20 uppercase">
                      {job.department}
                    </span>
                    <span className="bg-white/5 text-[#888] px-4 py-1.5 rounded-full text-[9px] font-bold tracking-[0.2em] border border-white/10 uppercase">
                      {job.type}
                    </span>
                  </div>
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-[#D4AF37]/10 flex items-center justify-center shrink-0 border border-[#D4AF37]/20">
                      <Briefcase className="w-6 h-6 text-[#D4AF37]" />
                    </div>
                    <div>
                      <h4 className="text-2xl font-serif text-gold-shiny leading-tight group-hover:drop-shadow-[0_0_10px_rgba(212,175,55,0.3)] transition-all">
                        {job.title}
                      </h4>
                      <div className="flex flex-wrap items-center gap-4 mt-2 text-[#666] text-xs">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {job.location}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {job.type}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-[#888] text-sm leading-relaxed mb-4">
                    {job.description}
                  </p>
                  <span 
                    className="inline-block bg-[#1a1a1a] text-[#D4AF37]/60 rounded-xl h-12 px-6 text-[9px] font-bold uppercase tracking-[0.3em] leading-[3rem] border border-[#D4AF37]/20"
                    data-testid={`text-coming-soon-${job.id}`}
                  >
                    Coming Soon
                  </span>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </section>}

      {/* Investment Section */}
      <section id="invest" className="relative bg-[#050505] py-40 px-6 border-t border-[#D4AF37]/10 z-10">
        <div className="max-w-4xl mx-auto bg-gradient-to-b from-[#0A0A0A] to-[#000] p-12 md:p-24 rounded-[60px] border border-[#D4AF37]/20 gold-shadow shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#D4AF37]/5 blur-[100px] -z-10" />
          <div className="text-center mb-20">
             <h2 className="text-[#D4AF37] uppercase text-[10px] tracking-[0.5em] font-bold mb-8">Executive Inquiry</h2>
            <h3 className="text-5xl md:text-7xl font-serif text-gold-shiny mb-8 leading-tight">PARTNER WITH LUSTER ENT Inc.</h3>
            <p className="text-[#D4AF37]/40 text-xl max-w-xl mx-auto leading-relaxed font-light">
              For prospective partners: tell us about yourself and what you have in mind.
            </p>
          </div>
          
          <Form {...investmentForm}>
            <form onSubmit={investmentForm.handleSubmit((data) => mutation.mutate(data))} className="space-y-10">
              {/* Hidden from people; bots fill it in and get dropped by the server. */}
              <input ref={honeypotRef} type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <FormField
                  control={investmentForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#D4AF37] uppercase text-[9px] tracking-[0.4em] font-bold opacity-60">Full Name</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} className="bg-black/60 border-[#D4AF37]/20 focus:border-[#D4AF37] h-16 rounded-2xl text-base gold-shadow transition-all" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={investmentForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#D4AF37] uppercase text-[9px] tracking-[0.4em] font-bold opacity-60">Email Address</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} value={field.value || ""} className="bg-black/60 border-[#D4AF37]/20 focus:border-[#D4AF37] h-16 rounded-2xl text-base gold-shadow transition-all" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={investmentForm.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[#D4AF37] uppercase text-[9px] tracking-[0.4em] font-bold opacity-60">Message</FormLabel>
                    <FormControl>
                      <Textarea {...field} value={field.value || ""} className="bg-black/60 border-[#D4AF37]/20 focus:border-[#D4AF37] min-h-[180px] rounded-2xl text-base gold-shadow transition-all resize-none" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <p className="text-[#888] text-xs leading-relaxed text-center">
                By submitting, you agree that we may contact you about your inquiry and that your information will be handled under our{" "}
                <Link href="/privacy" className="underline text-[#D4AF37]">Privacy Policy</Link> and{" "}
                <Link href="/terms" className="underline text-[#D4AF37]">Terms of Use</Link>. This form is not an offer to sell or a solicitation to buy any security or financial product.
              </p>
              <Button 
                type="submit" 
                disabled={mutation.isPending}
                className="w-full bg-gradient-to-r from-[#B8860B] via-[#FFD700] to-[#B8860B] text-black hover:opacity-90 rounded-2xl h-20 text-[10px] font-bold uppercase tracking-[0.5em] transition-all shadow-[0_10px_30px_rgba(212,175,55,0.2)] active:scale-95"
              >
                {mutation.isPending ? "TRANSMITTING..." : "SUBMIT INQUIRY"}
              </Button>
            </form>
          </Form>
        </div>
      </section>

      <footer className="relative py-20 text-center border-t border-[#D4AF37]/10 bg-black z-10">
        <img src={logoPng} alt="Logo" className="w-20 mx-auto mb-8 opacity-40 grayscale" />

        {/* $PcPay Footer Branding */}
        <div className="flex items-center justify-center mb-8">
          <a
            href="https://pawncoinpc.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-6 py-3 rounded-full border border-[#D4AF37]/15 bg-[#D4AF37]/5 hover:border-[#D4AF37]/35 hover:bg-[#D4AF37]/10 transition-all group"
            data-testid="link-pcpay-footer"
          >
            <img src="/logos/pcpay.png" alt="$PcPay Crypto Payments" className="h-6 object-contain opacity-70 group-hover:opacity-100 transition-opacity" />
            <span className="text-[#D4AF37]/50 text-[9px] font-bold tracking-[0.4em] uppercase group-hover:text-[#D4AF37]/80 transition-colors whitespace-nowrap">
              $Pc accepted at participating affiliates via $PcPay
            </span>
          </a>
        </div>

        <p className="text-[#D4AF37]/30 text-[10px] tracking-[0.6em] uppercase font-bold flex items-center justify-center">
          © 2026 LUSTER ENT INC
          <span className="inline-block w-1 h-1 bg-[#D4AF37]/30 ml-2 mr-1" />
          HOLDING COMPANY
        </p>
        <nav aria-label="Legal" className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] text-[#D4AF37]/70">
          <Link href="/privacy" className="hover:text-[#D4AF37] underline-offset-4 hover:underline" data-testid="link-privacy">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-[#D4AF37] underline-offset-4 hover:underline" data-testid="link-terms">Terms of Use</Link>
          <Link href="/refund-policy" className="hover:text-[#D4AF37] underline-offset-4 hover:underline" data-testid="link-refunds">Refunds &amp; Payments</Link>
          <a href="mailto:lusterent@gmail.com" className="hover:text-[#D4AF37] underline-offset-4 hover:underline">Contact</a>
        </nav>
        <p className="mt-6 max-w-2xl mx-auto px-6 text-[#666] text-[11px] leading-relaxed">
          Luster Ent Inc. is a holding company. Portfolio sites are operated under their own terms and policies. Nothing here is investment, legal or financial advice or an offer of securities. Some portfolio products involve digital assets, gaming or lending and are not available everywhere.
        </p>
      </footer>

      {/* Detail Dialog */}
      <Dialog open={!!selectedSite} onOpenChange={() => setSelectedSite(null)}>
        <DialogContent className="bg-black border-[#D4AF37]/30 text-white max-w-7xl rounded-[60px] p-0 overflow-hidden shadow-[0_0_100px_rgba(212,175,55,0.2)] selection:bg-[#D4AF37]/30 ring-1 ring-[#D4AF37]/10">
          <div className="relative">
            <div className="p-12 md:p-24">
              <DialogHeader className="mb-16">
                <div className="flex items-center gap-6 mb-10">
                  <span className="bg-[#D4AF37]/10 text-[#D4AF37] px-6 py-2 rounded-full text-[10px] font-bold tracking-[0.4em] border border-[#D4AF37]/30 uppercase">
                    {selectedSite?.category}
                  </span>
                </div>
                <DialogTitle className="text-6xl md:text-8xl font-serif text-gold-shiny mb-10 tracking-tight leading-none drop-shadow-2xl">{selectedSite?.name}</DialogTitle>
                <DialogDescription className="text-[#D4AF37]/40 text-2xl leading-relaxed max-w-4xl font-light italic">
                  {selectedSite?.description}
                </DialogDescription>
              </DialogHeader>
              
              <div className="aspect-video bg-[#050505] rounded-[50px] border border-[#D4AF37]/20 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] relative group gold-shadow">
                <div className="absolute inset-0 bg-[#D4AF37]/5 animate-pulse flex items-center justify-center">
                   <img src={logoPng} className="w-48 opacity-10 blur-sm" alt="Loading" />
                </div>
                <iframe 
                  src={selectedSite?.url} 
                  className="w-full h-full border-0 relative z-10 transition-all duration-1000" 
                  title={selectedSite?.name}
                />
              </div>

              {/* $PcPay Acceptance Callout */}
              <a
                href="https://pawncoinpc.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-5 mt-10 p-5 rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/5 hover:bg-[#D4AF37]/10 hover:border-[#D4AF37]/40 transition-all group"
                data-testid="link-pcpay-dialog"
              >
                <img src="/logos/pcpay.png" alt="$PcPay" className="h-8 object-contain shrink-0" />
                <div>
                  <p className="text-[#D4AF37] font-bold text-[11px] tracking-[0.3em] uppercase">$Pc Accepted · $PcPay Gateway</p>
                  <p className="text-[#666] text-xs mt-0.5">This business accepts $Pc cryptocurrency via the $PcPay Gateway — <span className="text-[#D4AF37]/60 group-hover:text-[#D4AF37] transition-colors">pawncoinpc.com</span></p>
                </div>
              </a>

              <div className="flex flex-col md:flex-row gap-8 mt-8">
                <Button 
                  className="flex-[2] bg-gradient-to-r from-[#B8860B] via-[#FFD700] to-[#B8860B] text-black hover:opacity-90 h-20 rounded-2xl text-[10px] font-bold uppercase tracking-[0.5em] transition-all shadow-[0_10px_30px_rgba(212,175,55,0.2)]"
                  onClick={() => window.open(selectedSite?.url, '_blank')}
                >
                  NAVIGATE TO ASSET <ArrowRight className="ml-3 w-5 h-5" />
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1 h-20 rounded-2xl border-[#D4AF37]/30 bg-black text-[#D4AF37] hover:bg-[#D4AF37]/10 transition-all text-[10px] font-bold tracking-[0.3em] uppercase"
                  onClick={() => handleShare(selectedSite!)}
                >
                  <Share2 className="w-5 h-5 mr-3" /> SHARE ASSET
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Article Detail Dialog */}
      <Dialog open={!!selectedArticle} onOpenChange={(open) => !open && setSelectedArticle(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-[#0A0A0A] border border-[#D4AF37]/20 rounded-[40px] p-0">
          <div className="p-8 md:p-12">
            <DialogHeader className="mb-8">
              <div className="flex items-center gap-3 mb-6">
                <span className="bg-[#D4AF37]/10 text-[#D4AF37] px-4 py-1.5 rounded-full text-[9px] font-bold tracking-[0.3em] border border-[#D4AF37]/20 uppercase" data-testid="text-article-category">
                  {selectedArticle?.category}
                </span>
                <span className="text-[#666] text-xs" data-testid="text-article-date">
                  {selectedArticle?.publishedAt ? new Date(selectedArticle.publishedAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : ''}
                </span>
              </div>
              <DialogTitle className="text-3xl md:text-4xl font-serif text-gold-shiny leading-tight" data-testid="text-article-title">
                {selectedArticle?.title}
              </DialogTitle>
              <DialogDescription className="text-[#D4AF37]/60 text-lg mt-4 leading-relaxed" data-testid="text-article-excerpt">
                {selectedArticle?.excerpt}
              </DialogDescription>
            </DialogHeader>
            
            <div className="prose prose-invert max-w-none">
              <div className="text-[#999] leading-relaxed whitespace-pre-line text-base" data-testid="text-article-content">
                {selectedArticle?.content}
              </div>
            </div>
            
            <div className="mt-10 pt-8 border-t border-[#D4AF37]/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#B8860B] flex items-center justify-center">
                    <span className="text-black font-bold text-lg">L</span>
                  </div>
                  <div>
                    <p className="text-[#D4AF37] font-semibold">Luster Entertainment Inc.</p>
                    <p className="text-[#666] text-sm">Corporate Communications</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="border-[#D4AF37]/30 text-[#D4AF37] rounded-xl"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    toast({ title: "Link Copied", description: "Article link copied to clipboard." });
                  }}
                  data-testid="button-share-article"
                >
                  <Share2 className="w-4 h-4 mr-2" /> Share
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
