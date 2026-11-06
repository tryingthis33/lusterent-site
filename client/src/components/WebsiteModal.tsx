import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, Globe, Loader2, Maximize2 } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Website } from "@shared/schema";

interface WebsiteModalProps {
  website: Website | null;
  isOpen: boolean;
  onClose: () => void;
}

export function WebsiteModal({ website, isOpen, onClose }: WebsiteModalProps) {
  const [isLoading, setIsLoading] = useState(true);

  if (!website) return null;

  const handleVisit = () => {
    window.open(website.url, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl h-[90vh] md:h-auto md:max-h-[90vh] p-0 gap-0 overflow-hidden bg-card border-primary/20 shadow-2xl shadow-black/50 flex flex-col">
        {/* Header Section */}
        <div className="p-6 md:p-8 bg-gradient-to-b from-background to-background/95 border-b border-white/5 relative z-10 shrink-0">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <DialogTitle className="text-3xl md:text-4xl font-display font-bold text-foreground mb-2">
                {website.name}
              </DialogTitle>
              {website.description && (
                <DialogDescription className="text-base text-muted-foreground max-w-2xl">
                  {website.description}
                </DialogDescription>
              )}
            </div>
            <Button
              onClick={handleVisit}
              className="shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 py-6 text-lg shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all duration-300 rounded-xl group"
            >
              Visit Website
              <ExternalLink className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
            </Button>
          </div>
        </div>

        {/* Preview Area */}
        <div className="relative flex-grow bg-black/50 min-h-[400px] w-full">
          <AnimatePresence>
            {isLoading && (
              <motion.div
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-card/50 backdrop-blur-sm"
              >
                <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                <p className="text-muted-foreground font-medium">Loading preview...</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Fallback if iframe fails to load or is blocked (some sites block embedding) */}
          <div className="absolute inset-0 flex flex-col items-center justify-center opacity-10 pointer-events-none z-0">
             <Globe className="w-64 h-64 text-muted-foreground" />
          </div>

          <iframe
            src={website.url}
            title={`${website.name} Preview`}
            className="w-full h-full border-0 relative z-1 bg-white"
            onLoad={() => setIsLoading(false)}
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          />
          
          <div className="absolute bottom-4 right-4 z-20">
             <Button 
               variant="outline" 
               size="sm" 
               onClick={handleVisit}
               className="bg-black/80 backdrop-blur text-white border-white/20 hover:bg-black hover:text-primary"
             >
               <Maximize2 className="mr-2 w-4 h-4" /> Full Screen
             </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
