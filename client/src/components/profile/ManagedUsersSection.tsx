import { Edit2, Loader2, Users, Plus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getPermissionsForRole, getRoleLabel, normalizeRole } from "@shared/permissions";
import { ManagedUser, AuthenticatedUser } from "./types";

interface ManagedUsersSectionProps {
  managedUsers: ManagedUser[] | undefined;
  isLoading: boolean;
  currentUser: AuthenticatedUser | null;
  onEdit: (user: ManagedUser) => void;
  onCreate: () => void;
  formatDateTime: (value?: string | Date | null) => string;
  userSummary: {
    total: number;
    admins: number;
    cashiers: number;
    users: number;
  };
}

export function ManagedUsersSection({
  managedUsers,
  isLoading,
  currentUser,
  onEdit,
  onCreate,
  formatDateTime,
  userSummary,
}: ManagedUsersSectionProps) {
  return (
    <Card className="border-border/40 shadow-sm">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between text-right">
        <div className="flex-1">
          <CardTitle className="flex items-center justify-end gap-2 text-lg">
            إدارة المستخدمين والصلاحيات
            <Users className="h-5 w-5 text-accent" />
          </CardTitle>
          <CardDescription>
            إنشاء حسابات PIN جديدة وتعديل الدور أو البريد أو رمز الدخول لكل مستخدم.
          </CardDescription>
        </div>
        <Button className="h-12 rounded-xl font-bold" onClick={onCreate}>
          <Plus className="h-4 w-4" />
          مستخدم جديد
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            { label: "إجمالي الحسابات", value: userSummary.total },
            { label: "المدراء", value: userSummary.admins },
            { label: "الكاشير", value: userSummary.cashiers },
            { label: "مستخدمون آخرون", value: userSummary.users },
          ].map(stat => (
            <div key={stat.label} className="rounded-[22px] border border-border/40 bg-background/70 p-4 text-right">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                {stat.label}
              </p>
              <p className="mt-2 font-display text-3xl font-black">{stat.value}</p>
            </div>
          ))}
        </div>

        {isLoading ? (
          <div className="flex min-h-[180px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
          </div>
        ) : managedUsers && managedUsers.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {managedUsers.map(user => {
              const managedRole = normalizeRole(user.role as any);
              const permissionCount = getPermissionsForRole(managedRole).length;
              const isCurrentUser = user.id === currentUser?.id;

              return (
                <div key={user.id} className="rounded-[24px] border border-border/40 bg-background/70 p-5 text-right">
                  <div className="flex items-start justify-between gap-3">
                    <Button variant="outline" className="h-10 rounded-xl px-4" onClick={() => onEdit(user)}>
                      <Edit2 className="h-4 w-4" />
                      تعديل
                    </Button>
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {isCurrentUser && <Badge variant="secondary" className="rounded-full px-3 py-1">الحساب الحالي</Badge>}
                        <Badge variant={managedRole === "admin" ? "default" : "outline"} className="rounded-full px-3 py-1">
                          {getRoleLabel(managedRole)}
                        </Badge>
                        <p className="font-display text-lg font-black">{user.name || "بدون اسم"}</p>
                      </div>
                      <p className="text-sm text-muted-foreground">{user.email || user.openId || "بدون بريد"}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {[
                      { label: "الصلاحيات", value: permissionCount },
                      { label: "أسلوب الدخول", value: user.loginMethod || "PIN" },
                      { label: "آخر دخول", value: formatDateTime(user.lastSignedIn) },
                    ].map(item => (
                      <div key={item.label} className="rounded-[18px] border border-border/30 bg-muted/20 p-3">
                        <p className="text-[11px] font-bold text-muted-foreground">{item.label}</p>
                        <p className="mt-1 text-sm font-bold truncate">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-[24px] border border-dashed border-border/40 bg-muted/20 p-8 text-center text-sm text-muted-foreground font-display">
            لا توجد حسابات مُدارة بعد. أنشئ أول مستخدم يعمل عبر PIN من هنا.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
