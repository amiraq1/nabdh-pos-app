import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { getStoredApiUrl, getBaseUrl, clearStoredApiUrl } from "@/lib/api-config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { 
  User, 
  KeyRound, 
  Database, 
  LogOut, 
  Settings, 
  Shield, 
  Bell, 
  Moon, 
  Sun,
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  Receipt,
  RotateCcw,
  Zap,
  Server,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  getPermissionsForRole,
  getRoleDescription,
  getRoleLabel,
  hasPermission,
  normalizeRole,
  PERMISSION_DEFINITIONS,
  type AppPermission,
} from "@shared/permissions";

import { AuthenticatedUser, ManagedUser, CapabilityCard } from "@/components/profile/types";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { shouldTrackEdgeSwipe } from "@/lib/swipe-utils";
import { ManagedUsersSection } from "@/components/profile/ManagedUsersSection";

const capabilityCards: CapabilityCard[] = [
  { title: "نقطة البيع", description: "فتح الكاشير وإتمام الفواتير والطباعة", permission: "pos.use", icon: ShoppingCart },
  { title: "إدارة المنتجات", description: "إضافة المنتجات وتحديثها وحذفها", permission: "products.manage", icon: Package },
  { title: "المخزون", description: "مراجعة الرصيد وضبط حركات الجرد", permission: "inventory.view", icon: Boxes },
  { title: "المصاريف", description: "الوصول إلى السجل المالي التشغيلي", permission: "expenses.view", icon: Receipt },
];

type ManagedUserRole = "admin" | "cashier" | "user";

type ManagedUserFormState = {
  id: number | null;
  name: string;
  role: ManagedUserRole;
  pin: string;
  email: string;
};

const INITIAL_MANAGED_USER_FORM: ManagedUserFormState = {
  id: null,
  name: "",
  role: "cashier",
  pin: "",
  email: "",
};

function formatDateTime(value?: string | Date | null) {
  if (!value) return "غير متاح";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "غير متاح";
  return new Intl.DateTimeFormat("ar-IQ", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function ProfilePage() {
  const [, navigate] = useLocation();
  const { user, logout } = useAuth() as any;
  const utils = trpc.useUtils();
  const { theme, setTheme } = useTheme();

  const [storedApiUrl] = useState(() => getStoredApiUrl());
  const [effectiveApiUrl] = useState(() => getBaseUrl());
  const [apiUrl, setApiUrl] = useState(() => storedApiUrl || effectiveApiUrl);
  const [profileName, setProfileName] = useState(user?.name ?? "");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  
  const [stockAlertsEnabled, setStockAlertsEnabled] = useState(() => {
    return localStorage.getItem("nabdh_stock_alerts_enabled") !== "false";
  });

  const toggleStockAlerts = (val: boolean) => {
    setStockAlertsEnabled(val);
    localStorage.setItem("nabdh_stock_alerts_enabled", String(val));
    toast.success(val ? "تنبيهات المخزون مفعّلة" : "تنبيهات المخزون معطلة");
  };

  const [isManagedUserDialogOpen, setIsManagedUserDialogOpen] = useState(false);
  const [managedUserForm, setManagedUserForm] = useState<ManagedUserFormState>(INITIAL_MANAGED_USER_FORM);

  const updateProfileMutation = trpc.auth.updateProfile.useMutation({
    onSuccess: updatedUser => { utils.auth.me.setData(undefined, updatedUser); },
  });
  const changePinMutation = trpc.auth.changePin.useMutation();

  const role = normalizeRole(user?.role);
  const { data: managedUsers, isLoading: managedUsersLoading, refetch: refetchManagedUsers } = 
    trpc.auth.listUsers.useQuery(undefined, { enabled: role === "admin" }) as { data: ManagedUser[] | undefined, isLoading: boolean, refetch: any };

  const createManagedUserMutation = trpc.auth.createManagedUser.useMutation();
  const updateManagedUserMutation = trpc.auth.updateManagedUser.useMutation();
  
  const permissions = useMemo(() => getPermissionsForRole(role), [role]);
  
  const permissionGroups = useMemo(() => {
    return PERMISSION_DEFINITIONS.reduce<Record<string, typeof PERMISSION_DEFINITIONS[number][]>>(
      (groups, permission) => {
        groups[permission.group] = [...(groups[permission.group] ?? []), permission];
        return groups;
      },
      {} as Record<string, typeof PERMISSION_DEFINITIONS[number][]>
    );
  }, []);

  const availableCapabilities = capabilityCards.filter(card => hasPermission(role, card.permission));
  const userSummary = useMemo(() => ({
    total: managedUsers?.length ?? 0,
    admins: managedUsers?.filter(item => item.role === "admin").length ?? 0,
    cashiers: managedUsers?.filter(item => item.role === "cashier").length ?? 0,
    users: managedUsers?.filter(item => item.role === "user").length ?? 0,
  }), [managedUsers]);

  const handleTouchStart = (event: React.TouchEvent) => {
    const x = event.targetTouches[0].clientX;
    if (!shouldTrackEdgeSwipe(event.target, x)) return;
    navigate("/");
  };

  const handleSaveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (profileName.trim().length < 2) return toast.error("أدخل اسماً صالحاً");
    try {
      await updateProfileMutation.mutateAsync({ name: profileName.trim() });
      toast.success("تم التحديث بنجاح");
    } catch (err: any) { toast.error(err?.message || "فشل التحديث"); }
  };

  const handleManagedUserSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const isEditing = !!managedUserForm.id;
    try {
      if (isEditing && managedUserForm.id !== null) {
        await updateManagedUserMutation.mutateAsync({ 
          id: managedUserForm.id, 
          name: managedUserForm.name,
          role: managedUserForm.role,
          email: managedUserForm.email || undefined,
          pin: managedUserForm.pin || undefined 
        });
        toast.success("تم تحديث المستخدم");
      } else {
        await createManagedUserMutation.mutateAsync({ 
          name: managedUserForm.name,
          role: managedUserForm.role,
          email: managedUserForm.email || undefined,
          pin: managedUserForm.pin
        });
        toast.success("تم إنشاء المستخدم");
      }
      setIsManagedUserDialogOpen(false);
      refetchManagedUsers();
    } catch (err: any) { toast.error(err?.message || "تعذر الحفظ"); }
  };

  return (
    <div className="min-h-screen bg-background pb-20 lg:pb-8" onTouchStart={handleTouchStart}>
      <ProfileHeader
        user={user as AuthenticatedUser} role={role} permissionsCount={permissions.length}
        availableCapabilities={availableCapabilities} onBack={() => navigate("/")} formatDateTime={formatDateTime}
      />

      <div className="container relative z-20 mx-auto -mt-4 px-4 sm:px-6">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2 space-y-6">
            <Card className="border-border/40 shadow-sm text-right">
              <CardHeader>
                <CardTitle className="flex items-center justify-end gap-2 text-lg">بيانات الحساب <User className="h-5 w-5 text-accent" /></CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2"><Label>الاسم الظاهر</Label><Input value={profileName} onChange={e => setProfileName(e.target.value)} className="h-12 rounded-xl text-right"/></div>
                    <div className="space-y-2"><Label>الدور</Label><div className="h-12 flex items-center justify-end border rounded-xl px-4 bg-muted/20">{getRoleLabel(role)}</div></div>
                  </div>
                  <Button type="submit" className="h-12 rounded-xl" disabled={updateProfileMutation.isPending}>حفظ التغييرات</Button>
                </form>
              </CardContent>
            </Card>

            {role === "admin" && (
              <ManagedUsersSection
                managedUsers={managedUsers} isLoading={managedUsersLoading} currentUser={user as AuthenticatedUser}
                onEdit={u => { 
                  setManagedUserForm({ 
                    id: u.id, 
                    name: u.name, 
                    role: normalizeRole(u.role) as ManagedUserRole, 
                    pin: "", 
                    email: u.email || "" 
                  }); 
                  setIsManagedUserDialogOpen(true); 
                }}
                onCreate={() => { setManagedUserForm(INITIAL_MANAGED_USER_FORM); setIsManagedUserDialogOpen(true); }}
                formatDateTime={formatDateTime} userSummary={userSummary}
              />
            )}
          </div>

          <div className="space-y-6">
            <Card className="border-border/40 text-right">
              <CardHeader><CardTitle className="flex items-center justify-end gap-2 text-lg">حماية الحساب <KeyRound className="h-5 w-5 text-accent" /></CardTitle></CardHeader>
              <CardContent>
                <form className="space-y-4">
                  <Input type="password" placeholder="رمز PIN الحالي" className="h-12 rounded-xl text-center" />
                  <Button className="w-full h-12 rounded-xl">تحديث رمز الدخول</Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-border/40 text-right">
              <CardHeader><CardTitle className="flex items-center justify-end gap-2 text-lg">اتصال السيرفر <Server className="h-5 w-5 text-accent" /></CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-muted/20 rounded-xl text-xs font-mono break-all">{apiUrl}</div>
                <Button variant="outline" className="w-full" onClick={() => { clearStoredApiUrl(); window.location.reload(); }}>إعادة ضبط الاتصال <RotateCcw className="h-4 w-4 mr-2" /></Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={isManagedUserDialogOpen} onOpenChange={setIsManagedUserDialogOpen}>
        <DialogContent className="rounded-3xl max-w-md p-8 text-right">
          <DialogHeader><DialogTitle className="text-xl font-bold font-display">{managedUserForm.id ? "تعديل مستخدم" : "مستخدم جديد"}</DialogTitle></DialogHeader>
          <form onSubmit={handleManagedUserSubmit} className="space-y-5 mt-4">
            <div className="space-y-2"><Label>الاسم</Label><Input value={managedUserForm.name} onChange={e => setManagedUserForm(p => ({ ...p, name: e.target.value }))} className="text-right h-12 rounded-xl" placeholder="اسم الموظف" /></div>
            <div className="space-y-2"><Label>الدور</Label>
              <select value={managedUserForm.role} onChange={e => setManagedUserForm(p => ({ ...p, role: e.target.value as ManagedUserRole }))} className="w-full h-12 rounded-xl border border-input bg-background px-3 py-2 text-right">
                <option value="cashier">كاشير</option>
                <option value="user">مستودع</option>
                <option value="admin">مدير</option>
              </select>
            </div>
            <div className="space-y-2"><Label>رمز الـ PIN</Label><Input type="password" value={managedUserForm.pin} onChange={e => setManagedUserForm(p => ({ ...p, pin: e.target.value }))} className="text-center h-12 rounded-xl" placeholder={managedUserForm.id ? "اتركه فارغاً للحفاظ على الرمز الحالي" : "رمز الدخول"} /></div>
            <Button type="submit" className="w-full h-12 rounded-3xl text-lg font-bold mt-4" disabled={createManagedUserMutation.isPending || updateManagedUserMutation.isPending}>{managedUserForm.id ? "تحديث البيانات" : "إضافة الموظف الآن"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
