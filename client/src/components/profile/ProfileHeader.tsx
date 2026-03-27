import { motion } from "framer-motion";
import { ArrowLeft, BadgeCheck, Shield, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getRoleDescription, getRoleLabel } from "@shared/permissions";
import { AuthenticatedUser, CapabilityCard } from "./types";

interface ProfileHeaderProps {
  user: AuthenticatedUser | null;
  role: string;
  permissionsCount: number;
  availableCapabilities: CapabilityCard[];
  onBack: () => void;
  formatDateTime: (value?: string | Date | null) => string;
}

export function ProfileHeader({
  user,
  role,
  permissionsCount,
  availableCapabilities,
  onBack,
  formatDateTime,
}: ProfileHeaderProps) {
  return (
    <div className="relative overflow-hidden border-b border-border/50 bg-accent/5 pt-12 pb-8">
      <div className="pointer-events-none absolute top-0 right-0 -mt-20 -mr-20 h-64 w-64 rounded-full bg-accent/10 blur-[80px]" />
      <div className="pointer-events-none absolute bottom-0 left-0 -mb-20 -ml-20 h-64 w-64 rounded-full bg-primary/10 blur-[80px]" />

      <div className="container relative z-10 mx-auto px-4 sm:px-6 text-right">
        <Button
          variant="ghost"
          size="icon"
          className="mb-6 h-10 w-10 rounded-full border border-border/20 backdrop-blur-md hover:bg-background/50"
          onClick={onBack}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", duration: 0.5 }}
          className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"
        >
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start lg:flex-row-reverse">
            <div className="relative">
              <div className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-gradient-to-br from-accent to-primary shadow-2xl shadow-accent/20 sm:h-28 sm:w-28">
                <span className="text-4xl font-black text-white sm:text-5xl">
                  {user?.name?.charAt(0).toUpperCase() || "م"}
                </span>
              </div>
              <div className="absolute -right-2 -bottom-2 rounded-full border-4 border-background bg-emerald-500 px-2 py-1 text-[10px] font-black text-white">
                نشط
              </div>
            </div>

            <div className="text-center sm:text-right">
              <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">
                {user?.name || "مستخدم النظام"}
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-7 text-muted-foreground">
                {getRoleDescription(role)}
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:justify-start lg:flex-row-reverse">
                <Badge className="rounded-full px-3 py-1 text-sm">
                  <Shield className="h-4 w-4" />
                  {getRoleLabel(role)}
                </Badge>
                <Badge variant="outline" className="rounded-full px-3 py-1 text-sm">
                  <BadgeCheck className="h-4 w-4 text-emerald-500" />
                  {permissionsCount} صلاحية فعّالة
                </Badge>
                <Badge variant="outline" className="rounded-full px-3 py-1 text-sm">
                  <User className="h-4 w-4" />
                  {user?.loginMethod || "PIN"}
                </Badge>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:min-w-[320px]">
            <div className="rounded-[24px] border border-border/40 bg-background/70 p-4 text-right">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                آخر دخول
              </p>
              <p className="mt-2 text-sm font-bold text-foreground">
                {formatDateTime(user?.lastSignedIn)}
              </p>
            </div>
            <div className="rounded-[24px] border border-border/40 bg-background/70 p-4 text-right">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                الوصول الحالي
              </p>
              <p className="mt-2 text-sm font-bold text-foreground">
                {availableCapabilities.length} وحدة تشغيل
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
