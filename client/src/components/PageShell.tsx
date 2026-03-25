import React from "react";

interface PageShellProps {
  children: React.ReactNode;
  /** Ambient light color class, e.g. "bg-primary/5" or "bg-rose-500/5" */
  ambientColor?: string;
  /** Position: "top-right" | "top-left" — default "top-right" */
  ambientPosition?: "top-right" | "top-left";
  className?: string;
}

/**
 * Shared page wrapper with ambient background lighting and consistent spacing.
 * Eliminates repetitive boilerplate across all pages.
 */
export default function PageShell({
  children,
  ambientColor = "bg-primary/5",
  ambientPosition = "top-right",
  className = "",
}: PageShellProps) {
  const positionClass =
    ambientPosition === "top-right"
      ? "-translate-y-1/2 translate-x-1/2 top-0 right-0"
      : "-translate-y-1/2 -translate-x-1/2 top-0 left-0";

  return (
    <div className={`min-h-screen bg-background relative overflow-hidden pb-24 lg:pb-12 ${className}`}>
      {/* Ambient Background Light */}
      <div
        className={`absolute w-[500px] h-[500px] ${ambientColor} rounded-full blur-[100px] pointer-events-none ${positionClass}`}
      />

      <div className="container py-6 space-y-8 relative z-10">
        {children}
      </div>
    </div>
  );
}
