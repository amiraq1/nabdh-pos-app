import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useLocation } from "wouter";

interface PageHeaderProps {
  /** Page title in Arabic */
  title: string;
  /** Subtitle / description */
  subtitle?: string;
  /** Lucide icon component */
  icon?: React.ElementType;
  /** Icon color class, e.g. "text-primary" or "text-rose-500" */
  iconColor?: string;
  /** Right-side actions (buttons, dialogs, etc.) */
  actions?: React.ReactNode;
  /** Override back navigation target. Default = "/" */
  backTo?: string;
}

/**
 * Shared page header with back button, title, icon, and actions area.
 * Replaces the identical header pattern repeated across 6+ pages.
 */
export default function PageHeader({
  title,
  subtitle,
  icon: Icon,
  iconColor = "text-primary",
  actions,
  backTo = "/",
}: PageHeaderProps) {
  const [, navigate] = useLocation();

  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 glass-panel p-6 rounded-[32px] border-white/5 shadow-2xl shadow-primary/5">
      <div className="flex items-center gap-5">
        <Button
          variant="outline"
          size="icon"
          className="rounded-2xl w-12 h-12 shadow-sm border-border/40 hover:bg-muted flex-shrink-0"
          onClick={() => navigate(backTo)}
          aria-label="العودة للرئيسية"
        >
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-display font-black tracking-tight text-foreground flex items-center gap-3">
            {Icon && <Icon className={`w-8 h-8 ${iconColor}`} />}
            {title}
          </h1>
          {subtitle && (
            <p className="text-muted-foreground font-medium mt-1">{subtitle}</p>
          )}
        </div>
      </div>

      {actions && <div className="flex gap-3">{actions}</div>}
    </div>
  );
}
