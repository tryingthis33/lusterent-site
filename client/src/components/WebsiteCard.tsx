import { motion } from "framer-motion";
import { ExternalLink, Globe } from "lucide-react";
import type { Website } from "@shared/schema";

interface WebsiteCardProps {
  website: Website;
  onClick: () => void;
}

export function WebsiteCard({ website, onClick }: WebsiteCardProps) {
  return (
    <motion.div
      whileHover={{ y: -8, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      onClick={onClick}
      className="group relative cursor-pointer rounded-2xl bg-card border border-border/50 overflow-hidden shadow-lg hover:shadow-primary/20 hover:border-primary/50 transition-all duration-300 flex flex-col h-full"
    >
      {/* Image Preview Area */}
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        {website.imageUrl ? (
          <img
            src={website.imageUrl}
            alt={website.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-secondary/50">
            <Globe className="h-16 w-16 text-muted-foreground/30" />
          </div>
        )}
        
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-sm">
          <span className="text-white font-medium px-6 py-2 border border-white/30 rounded-full bg-white/10 backdrop-blur-md flex items-center gap-2">
            View Details <ExternalLink className="w-4 h-4" />
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 flex flex-col flex-grow">
        <h3 className="text-xl font-bold text-foreground font-display mb-2 group-hover:text-primary transition-colors">
          {website.name}
        </h3>
        {website.description && (
          <p className="text-muted-foreground text-sm line-clamp-2">
            {website.description}
          </p>
        )}
        
        {/* Decorative bottom line */}
        <div className="mt-auto pt-4">
          <div className="h-0.5 w-12 bg-primary/30 group-hover:w-full group-hover:bg-primary transition-all duration-500 rounded-full" />
        </div>
      </div>
    </motion.div>
  );
}
