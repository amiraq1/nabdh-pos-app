import { useEffect, useMemo, useState } from "react";
import { motion, type Variants } from "framer-motion";
import {
  ArrowLeft,
  BadgeCheck,
  Bell,
  Boxes,
  Edit2,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  Moon,
  Package,
  Plus,
  Receipt,
  RotateCcw,
  Save,
  Server,
  Shield,
  ShoppingCart,
  Sun,
  User,
  Users,
  WalletCards,
  WifiOff,
} from "lucide-react";
import { useLocation } from "wouter";

import { native } from "@/_core/native";
import { useAuth } from "@/_core/hooks/useAuth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/contexts/ThemeContext";
import {
  clearStoredApiUrl,
  getApiConnectionHint,
  getBaseUrl,
  getStoredApiUrl,
  isUsingEmulatorFallback,
  normalizeApiUrl,
  setStoredApiUrl,
} from "@/lib/api-config";
import { trpc } from "@/lib/trpc";
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

const capabilityCards: Array<{
  title: string;
  description: string;
  permission: AppPermission;
  icon: typeof ShoppingCart;
}> = [
  {
    title: "نقطة البيع",
    description: "فتح الكاشير وإتمام الفواتير والطباعة",
    permission: "pos.use",
    icon: ShoppingCart,
  },
  {
    title: "إدارة المنتجات",
    description: "إضافة المنتجات وتحديثها وحذفها",
    permission: "products.manage",
    icon: Package,
  },
  {
    title: "المخزون",
    description: "مراجعة الرصيد وضبط حركات الجرد",
    permission: "inventory.view",
    icon: Boxes,
  },
  {
    title: "المصاريف",
    description: "الوصول إلى السجل المالي التشغيلي",
    permission: "expenses.view",
    icon: Receipt,
  },
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
  if (!value) {
    return "غير متاح";
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "غير متاح";
  }

  return new Intl.DateTimeFormat("ar-IQ", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function ProfilePage() {
  const [, navigate] = useLocation();
  const { user, logout } = useAuth();
  const utils = trpc.useUtils();
  const { theme, setTheme } = useTheme();

  const storedApiUrl = getStoredApiUrl();
  const effectiveApiUrl = getBaseUrl();
  const [touchStartPos, setTouchStartPos] = useState<{ x: number; y: number } | null>(null);
  const [apiUrl, setApiUrl] = useState(() => storedApiUrl || effectiveApiUrl);
  const [profileName, setProfileName] = useState(user?.name ?? "");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [stockAlertsEnabled, setStockAlertsEnabled] = useState(true);
  const [isManagedUserDialogOpen, setIsManagedUserDialogOpen] = useState(false);
  const [managedUserForm, setManagedUserForm] = useState<ManagedUserFormState>(
    INITIAL_MANAGED_USER_FORM
  );

  const updateProfileMutation = trpc.auth.updateProfile.useMutation({
    onSuccess: updatedUser => {
      utils.auth.me.setData(undefined, updatedUser);
    },
  });
  const changePinMutation = trpc.auth.changePin.useMutation();

  const role = normalizeRole((user as any)?.role);
  const {
    data: managedUsers,
    isLoading: managedUsersLoading,
    refetch: refetchManagedUsers,
  } = trpc.auth.listUsers.useQuery(undefined, {
    enabled: role === "admin",
  });
  const createManagedUserMutation = trpc.auth.createManagedUser.useMutation();
  const updateManagedUserMutation = trpc.auth.updateManagedUser.useMutation();
  const permissions = useMemo(() => getPermissionsForRole(role), [role]);
  const permissionGroups = useMemo(() => {
    return PERMISSION_DEFINITIONS.reduce<Record<string, typeof PERMISSION_DEFINITIONS>>(
      (groups, permission) => {
        groups[permission.group] = [...(groups[permission.group] ?? []), permission];
        return groups;
      },
      {}
    );
  }, []);

  const availableCapabilities = capabilityCards.filter(card =>
    hasPermission(role, card.permission)
  );
  const userSummary = useMemo(
    () => ({
      total: managedUsers?.length ?? 0,
      admins: managedUsers?.filter(item => item.role === "admin").length ?? 0,
      cashiers: managedUsers?.filter(item => item.role === "cashier").length ?? 0,
      users: managedUsers?.filter(item => item.role === "user").length ?? 0,
    }),
    [managedUsers]
  );

  const isEmulatorFallbackActive = native.isNative && isUsingEmulatorFallback();
  const apiHint = getApiConnectionHint();

  useEffect(() => {
    setProfileName(user?.name ?? "");
  }, [user?.name]);

  const resetManagedUserForm = () => {
    setManagedUserForm(INITIAL_MANAGED_USER_FORM);
  };

  const openCreateManagedUser = () => {
    resetManagedUserForm();
    setIsManagedUserDialogOpen(true);
  };

  const openEditManagedUser = (managedUser: any) => {
    setManagedUserForm({
      id: managedUser.id,
      name: managedUser.name ?? "",
      role: normalizeRole(managedUser.role),
      pin: "",
      email: managedUser.email ?? "",
    });
    setIsManagedUserDialogOpen(true);
  };

  const handleTouchStart = (event: React.TouchEvent) => {
    setTouchStartPos({
      x: event.targetTouches[0].clientX,
      y: event.targetTouches[0].clientY,
    });
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (!touchStartPos) {
      return;
    }

    const deltaX = touchStartPos.x - event.changedTouches[0].clientX;
    const deltaY = Math.abs(touchStartPos.y - event.changedTouches[0].clientY);

    if (Math.abs(deltaX) > 100 && deltaY < 50) {
      if (touchStartPos.x > window.innerWidth - 50 || touchStartPos.x < 50) {
        native.vibrate();
        navigate("/");
      }
    }

    setTouchStartPos(null);
  };

  const handleSaveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = profileName.trim();
    if (trimmedName.length < 2) {
      toast.error("اكتب اسمًا واضحًا للحساب");
      return;
    }

    try {
      await updateProfileMutation.mutateAsync({ name: trimmedName });
      native.vibrate();
      toast.success("تم تحديث بيانات الملف الشخصي");
    } catch (error: any) {
      toast.error(error?.message || "تعذر تحديث الملف الشخصي");
    }
  };

  const handleChangePin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (currentPin.length !== 4 || newPin.length !== 4 || confirmPin.length !== 4) {
      toast.error("أدخل 4 أرقام لكل حقل");
      return;
    }

    if (newPin !== confirmPin) {
      toast.error("تأكيد الرمز الجديد غير مطابق");
      return;
    }

    try {
      await changePinMutation.mutateAsync({
        currentPin,
        newPin,
      });
      native.vibrate();
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      toast.success("تم تحديث رمز الدخول بنجاح");
    } catch (error: any) {
      toast.error(error?.message || "تعذر تحديث رمز الدخول");
    }
  };

  const handleSaveApiUrl = () => {
    const rawValue = apiUrl.trim();

    if (!rawValue) {
      toast.error("أدخل عنوان الخادم أولًا");
      return;
    }

    const candidate = rawValue.includes("://") ? rawValue : `http://${rawValue}`;

    try {
      const parsed = new URL(candidate);

      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error("INVALID_PROTOCOL");
      }

      setStoredApiUrl(normalizeApiUrl(parsed.toString()));
      native.vibrate();
      toast.success("تم حفظ عنوان الخادم. سيُعاد تحميل التطبيق الآن.");
      window.setTimeout(() => window.location.reload(), 350);
    } catch {
      toast.error("استخدم عنوانًا صحيحًا مثل 192.168.1.50:3000");
    }
  };

  const handleResetApiUrl = () => {
    clearStoredApiUrl();
    native.vibrate();
    toast.success("تمت إزالة إعدادات الخادم المخصصة");
    window.setTimeout(() => window.location.reload(), 350);
  };

  const handleManagedUserSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const name = managedUserForm.name.trim();
    const pin = managedUserForm.pin.replace(/\D+/g, "").slice(0, 4);
    const email = managedUserForm.email.trim();

    if (name.length < 2) {
      toast.error("اكتب اسمًا صالحًا للمستخدم");
      return;
    }

    if (!managedUserForm.id && pin.length !== 4) {
      toast.error("حدد رمز دخول من 4 أرقام للمستخدم الجديد");
      return;
    }

    if (managedUserForm.id === (user as any)?.id && managedUserForm.role !== role) {
      toast.error("لا يمكن تغيير دور الحساب الحالي من هذه الشاشة");
      return;
    }

    try {
      if (managedUserForm.id) {
        await updateManagedUserMutation.mutateAsync({
          id: managedUserForm.id,
          name,
          role: managedUserForm.role,
          pin: pin || undefined,
          email: email || undefined,
        });
        toast.success("تم تحديث صلاحيات وبيانات المستخدم");
      } else {
        await createManagedUserMutation.mutateAsync({
          name,
          role: managedUserForm.role,
          pin,
          email: email || undefined,
        });
        toast.success("تم إنشاء المستخدم الجديد");
      }

      native.vibrate();
      setIsManagedUserDialogOpen(false);
      resetManagedUserForm();
      await refetchManagedUsers();
    } catch (error: any) {
      toast.error(error?.message || "تعذر حفظ بيانات المستخدم");
    }
  };

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 18 },
    show: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", stiffness: 280, damping: 22 },
    },
  };

  return (
    <div
      className="min-h-screen bg-background pb-20 lg:pb-8"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="relative overflow-hidden border-b border-border/50 bg-accent/5 pt-12 pb-8">
        <div className="pointer-events-none absolute top-0 right-0 -mt-20 -mr-20 h-64 w-64 rounded-full bg-accent/10 blur-[80px]" />
        <div className="pointer-events-none absolute bottom-0 left-0 -mb-20 -ml-20 h-64 w-64 rounded-full bg-primary/10 blur-[80px]" />

        <div className="container relative z-10 mx-auto px-4 sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="mb-6 h-10 w-10 rounded-full border border-border/20 backdrop-blur-md hover:bg-background/50"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"
          >
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
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
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <Badge className="rounded-full px-3 py-1 text-sm">
                    <Shield className="h-4 w-4" />
                    {getRoleLabel(role)}
                  </Badge>
                  <Badge variant="outline" className="rounded-full px-3 py-1 text-sm">
                    <BadgeCheck className="h-4 w-4 text-emerald-500" />
                    {permissions.length} صلاحية فعّالة
                  </Badge>
                  <Badge variant="outline" className="rounded-full px-3 py-1 text-sm">
                    <User className="h-4 w-4" />
                    {(user as any)?.loginMethod || "PIN"}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:min-w-[320px]">
              <div className="rounded-[24px] border border-border/40 bg-background/70 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  آخر دخول
                </p>
                <p className="mt-2 text-sm font-bold text-foreground">
                  {formatDateTime((user as any)?.lastSignedIn)}
                </p>
              </div>
              <div className="rounded-[24px] border border-border/40 bg-background/70 p-4">
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

      <div className="container relative z-20 mx-auto -mt-4 px-4 sm:px-6">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 gap-6 xl:grid-cols-3"
        >
          <motion.div variants={itemVariants} className="xl:col-span-2">
            <Card className="border-border/40 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <User className="h-5 w-5 text-accent" />
                  بيانات الحساب
                </CardTitle>
                <CardDescription>
                  تعديل الاسم الظاهر ومراجعة هوية الحساب الحالية.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <form onSubmit={handleSaveProfile} className="space-y-5">
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="profile-name">الاسم الظاهر</Label>
                      <Input
                        id="profile-name"
                        value={profileName}
                        onChange={event => setProfileName(event.target.value)}
                        className="h-12 rounded-xl"
                        placeholder="اسم المستخدم داخل النظام"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>الدور الحالي</Label>
                      <div className="flex h-12 items-center rounded-xl border border-border/50 bg-muted/30 px-4 text-sm font-bold">
                        {getRoleLabel(role)}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>البريد أو المعرف</Label>
                      <div className="flex h-12 items-center rounded-xl border border-border/50 bg-muted/30 px-4 text-sm text-muted-foreground">
                        {(user as any)?.email || (user as any)?.openId || "غير متاح"}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>أسلوب الدخول</Label>
                      <div className="flex h-12 items-center rounded-xl border border-border/50 bg-muted/30 px-4 text-sm text-muted-foreground">
                        {(user as any)?.loginMethod || "PIN"}
                      </div>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="h-12 rounded-xl px-6 font-bold"
                    disabled={updateProfileMutation.isPending}
                  >
                    {updateProfileMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    حفظ بيانات الحساب
                  </Button>
                </form>

                <Separator />

                <div className="grid gap-3 sm:grid-cols-2">
                  {availableCapabilities.map(capability => (
                    <div
                      key={capability.title}
                      className="rounded-[22px] border border-border/40 bg-background/70 p-4"
                    >
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <capability.icon className="h-5 w-5" />
                      </div>
                      <p className="font-display text-base font-black">{capability.title}</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {capability.description}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {role === "admin" && (
            <motion.div variants={itemVariants} className="xl:col-span-3">
              <Card className="border-border/40 shadow-sm">
                <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Users className="h-5 w-5 text-accent" />
                      إدارة المستخدمين والصلاحيات
                    </CardTitle>
                    <CardDescription>
                      إنشاء حسابات PIN جديدة وتعديل الدور أو البريد أو رمز الدخول لكل مستخدم.
                    </CardDescription>
                  </div>
                  <Button className="h-12 rounded-xl font-bold" onClick={openCreateManagedUser}>
                    <Plus className="h-4 w-4" />
                    مستخدم جديد
                  </Button>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-3 sm:grid-cols-4">
                    <div className="rounded-[22px] border border-border/40 bg-background/70 p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                        إجمالي الحسابات
                      </p>
                      <p className="mt-2 font-display text-3xl font-black">{userSummary.total}</p>
                    </div>
                    <div className="rounded-[22px] border border-border/40 bg-background/70 p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                        المدراء
                      </p>
                      <p className="mt-2 font-display text-3xl font-black">{userSummary.admins}</p>
                    </div>
                    <div className="rounded-[22px] border border-border/40 bg-background/70 p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                        الكاشير
                      </p>
                      <p className="mt-2 font-display text-3xl font-black">{userSummary.cashiers}</p>
                    </div>
                    <div className="rounded-[22px] border border-border/40 bg-background/70 p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                        مستخدمون آخرون
                      </p>
                      <p className="mt-2 font-display text-3xl font-black">{userSummary.users}</p>
                    </div>
                  </div>

                  {managedUsersLoading ? (
                    <div className="flex min-h-[180px] items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
                    </div>
                  ) : managedUsers && managedUsers.length > 0 ? (
                    <div className="grid gap-4 lg:grid-cols-2">
                      {managedUsers.map(managedUser => {
                        const managedRole = normalizeRole(managedUser.role);
                        const permissionCount = getPermissionsForRole(managedRole).length;
                        const isCurrentUser = managedUser.id === (user as any)?.id;

                        return (
                          <div
                            key={managedUser.id}
                            className="rounded-[24px] border border-border/40 bg-background/70 p-5"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-display text-lg font-black">
                                    {managedUser.name || "بدون اسم"}
                                  </p>
                                  <Badge
                                    variant={managedRole === "admin" ? "default" : "outline"}
                                    className="rounded-full px-3 py-1"
                                  >
                                    {getRoleLabel(managedRole)}
                                  </Badge>
                                  {isCurrentUser && (
                                    <Badge variant="secondary" className="rounded-full px-3 py-1">
                                      الحساب الحالي
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {(managedUser.email || managedUser.openId) ?? "بدون بريد"}
                                </p>
                              </div>

                              <Button
                                variant="outline"
                                className="h-10 rounded-xl px-4"
                                onClick={() => openEditManagedUser(managedUser)}
                              >
                                <Edit2 className="h-4 w-4" />
                                تعديل
                              </Button>
                            </div>

                            <div className="mt-4 grid gap-3 sm:grid-cols-3">
                              <div className="rounded-[18px] border border-border/30 bg-muted/20 p-3">
                                <p className="text-[11px] font-bold text-muted-foreground">
                                  الصلاحيات
                                </p>
                                <p className="mt-1 font-display text-lg font-black">
                                  {permissionCount}
                                </p>
                              </div>
                              <div className="rounded-[18px] border border-border/30 bg-muted/20 p-3">
                                <p className="text-[11px] font-bold text-muted-foreground">
                                  أسلوب الدخول
                                </p>
                                <p className="mt-1 text-sm font-bold">
                                  {managedUser.loginMethod || "PIN"}
                                </p>
                              </div>
                              <div className="rounded-[18px] border border-border/30 bg-muted/20 p-3">
                                <p className="text-[11px] font-bold text-muted-foreground">
                                  آخر دخول
                                </p>
                                <p className="mt-1 text-sm font-bold">
                                  {formatDateTime(managedUser.lastSignedIn)}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-border/40 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                      لا توجد حسابات مُدارة بعد. أنشئ أول مستخدم يعمل عبر PIN من هنا.
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          <motion.div variants={itemVariants}>
            <Card className="border-border/40 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <KeyRound className="h-5 w-5 text-accent" />
                  حماية الحساب
                </CardTitle>
                <CardDescription>
                  تغيير رمز PIN من خلال التحقق بالرمز الحالي.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleChangePin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="current-pin">الرمز الحالي</Label>
                    <Input
                      id="current-pin"
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      value={currentPin}
                      onChange={event => setCurrentPin(event.target.value.replace(/\D+/g, "").slice(0, 4))}
                      className="h-12 rounded-xl text-center font-mono tracking-[0.7em]"
                      placeholder="0000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-pin">الرمز الجديد</Label>
                    <Input
                      id="new-pin"
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      value={newPin}
                      onChange={event => setNewPin(event.target.value.replace(/\D+/g, "").slice(0, 4))}
                      className="h-12 rounded-xl text-center font-mono tracking-[0.7em]"
                      placeholder="0000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-pin">تأكيد الرمز الجديد</Label>
                    <Input
                      id="confirm-pin"
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      value={confirmPin}
                      onChange={event => setConfirmPin(event.target.value.replace(/\D+/g, "").slice(0, 4))}
                      className="h-12 rounded-xl text-center font-mono tracking-[0.7em]"
                      placeholder="0000"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="h-12 w-full rounded-xl bg-foreground font-bold text-background hover:bg-foreground/90"
                    disabled={changePinMutation.isPending}
                  >
                    {changePinMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <KeyRound className="h-4 w-4" />
                    )}
                    تحديث رمز الدخول
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants} className="xl:col-span-2">
            <Card className="border-border/40 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Shield className="h-5 w-5 text-accent" />
                  مصفوفة الصلاحيات
                </CardTitle>
                <CardDescription>
                  الصلاحيات المعروضة هنا مشتقة مباشرة من دور الحساب الحالي.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {role !== "admin" && (
                  <Alert className="border-amber-500/40 bg-amber-500/5">
                    <Shield className="h-4 w-4 text-amber-600" />
                    <AlertTitle>وصول محدود بحسب الدور</AlertTitle>
                    <AlertDescription>
                      هذا الحساب لا يملك صلاحيات الإدارة الكاملة، وبعض الوحدات أو إجراءات الحذف
                      والتعديل محجوبة عنه من الواجهة والخادم.
                    </AlertDescription>
                  </Alert>
                )}

                {Object.entries(permissionGroups).map(([group, groupPermissions]) => (
                  <div key={group} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-lg font-black">{group}</h3>
                      <Badge variant="outline" className="rounded-full px-3 py-1">
                        {
                          groupPermissions.filter(permission =>
                            hasPermission(role, permission.key)
                          ).length
                        }{" "}
                        / {groupPermissions.length}
                      </Badge>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      {groupPermissions.map(permission => {
                        const allowed = hasPermission(role, permission.key);

                        return (
                          <div
                            key={permission.key}
                            className={`rounded-[22px] border p-4 transition-colors ${
                              allowed
                                ? "border-emerald-500/30 bg-emerald-500/5"
                                : "border-border/40 bg-muted/20"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-display text-base font-black">
                                  {permission.label}
                                </p>
                                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                  {permission.description}
                                </p>
                              </div>
                              <Badge
                                variant={allowed ? "default" : "outline"}
                                className="rounded-full px-3 py-1"
                              >
                                {allowed ? "مسموح" : "محجوب"}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className="border-border/40 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <WalletCards className="h-5 w-5 text-accent" />
                  التجربة والجلسة
                </CardTitle>
                <CardDescription>
                  إعدادات العرض والتنبيهات والخروج الآمن.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/50 p-1">
                  <Button
                    variant={theme === "light" ? "default" : "ghost"}
                    className="h-12 rounded-lg"
                    onClick={() => setTheme("light")}
                  >
                    <Sun className="h-4 w-4" />
                    فاتح
                  </Button>
                  <Button
                    variant={theme === "dark" ? "default" : "ghost"}
                    className="h-12 rounded-lg"
                    onClick={() => setTheme("dark")}
                  >
                    <Moon className="h-4 w-4" />
                    داكن
                  </Button>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border/40 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
                      <Bell className="h-4 w-4 text-accent" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">تنبيهات المخزون</p>
                      <p className="text-xs text-muted-foreground">
                        تفعيل الإشعارات المحلية للمنتجات منخفضة المخزون
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={stockAlertsEnabled}
                    onCheckedChange={checked => setStockAlertsEnabled(checked)}
                  />
                </div>

                <Button
                  variant="destructive"
                  className="h-12 w-full rounded-xl bg-destructive/10 font-bold text-destructive hover:bg-destructive hover:text-white"
                  onClick={() => void logout()}
                >
                  <LogOut className="h-4 w-4" />
                  تسجيل الخروج
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants} className="xl:col-span-3">
            <Card className="border-border/40 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Server className="h-5 w-5 text-accent" />
                  اتصال الخادم
                </CardTitle>
                <CardDescription>
                  ضبط عنوان API يدويًا عند تغيّر الشبكة أو بيئة العمل.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!hasPermission(role, "settings.api") && (
                  <Alert className="border-border/40">
                    <Shield className="h-4 w-4" />
                    <AlertTitle>صلاحية مشاهدة فقط</AlertTitle>
                    <AlertDescription>
                      هذا الحساب لا يملك تعديل عنوان الخادم، لكنه يستطيع مراجعة الإعداد الحالي.
                    </AlertDescription>
                  </Alert>
                )}

                {isEmulatorFallbackActive && (
                  <Alert variant="destructive" className="border-destructive/40">
                    <WifiOff className="h-4 w-4" />
                    <AlertTitle>عنوان المحاكي مفعّل</AlertTitle>
                    <AlertDescription>
                      10.0.2.2 يعمل داخل Android Emulator فقط. إذا كنت على هاتف حقيقي، أدخل IP
                      الجهاز الذي يشغّل الخادم.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
                  <div className="space-y-2">
                    <Label htmlFor="api-url">عنوان الخادم</Label>
                    <Input
                      id="api-url"
                      dir="ltr"
                      inputMode="url"
                      autoCapitalize="none"
                      autoCorrect="off"
                      placeholder="192.168.1.50:3000"
                      value={apiUrl}
                      onChange={event => setApiUrl(event.target.value)}
                      className="h-12 rounded-xl font-mono text-left"
                      disabled={!hasPermission(role, "settings.api")}
                    />
                    <p className="text-xs leading-6 text-muted-foreground">{apiHint}</p>
                  </div>

                  <div className="rounded-2xl border border-border/50 bg-muted/30 p-4">
                    <p className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                      العنوان المستخدم الآن
                    </p>
                    <p dir="ltr" className="break-all font-mono text-sm text-foreground">
                      {effectiveApiUrl || "/api/trpc"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    className="h-12 flex-1 rounded-xl font-bold"
                    onClick={handleSaveApiUrl}
                    disabled={!hasPermission(role, "settings.api")}
                  >
                    <Save className="h-4 w-4" />
                    حفظ وإعادة الاتصال
                  </Button>
                  <Button
                    variant="outline"
                    className="h-12 rounded-xl"
                    onClick={handleResetApiUrl}
                    disabled={!storedApiUrl || !hasPermission(role, "settings.api")}
                  >
                    <RotateCcw className="h-4 w-4" />
                    إزالة التخصيص
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {role === "admin" && (
            <Dialog
              open={isManagedUserDialogOpen}
              onOpenChange={open => {
                setIsManagedUserDialogOpen(open);
                if (!open) {
                  resetManagedUserForm();
                }
              }}
            >
              <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle className="font-display text-2xl font-black">
                    {managedUserForm.id ? "تعديل المستخدم" : "إنشاء مستخدم جديد"}
                  </DialogTitle>
                  <DialogDescription>
                    {managedUserForm.id
                      ? "حدّث الدور أو الاسم أو رمز الدخول لهذا الحساب."
                      : "أنشئ حساب PIN جديدًا وحدد دوره التشغيلي داخل المتجر."}
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleManagedUserSubmit} className="space-y-5">
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="managed-user-name">اسم المستخدم</Label>
                      <Input
                        id="managed-user-name"
                        value={managedUserForm.name}
                        onChange={event =>
                          setManagedUserForm(previous => ({
                            ...previous,
                            name: event.target.value,
                          }))
                        }
                        className="h-12 rounded-xl"
                        placeholder="مثال: كاشير الفرع الصباحي"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>الدور</Label>
                      <Select
                        value={managedUserForm.role}
                        onValueChange={value =>
                          setManagedUserForm(previous => ({
                            ...previous,
                            role: value as ManagedUserRole,
                          }))
                        }
                        disabled={managedUserForm.id === (user as any)?.id}
                      >
                        <SelectTrigger className="h-12 rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">مدير النظام</SelectItem>
                          <SelectItem value="cashier">كاشير</SelectItem>
                          <SelectItem value="user">مستخدم</SelectItem>
                        </SelectContent>
                      </Select>
                      {managedUserForm.id === (user as any)?.id && (
                        <p className="text-xs text-muted-foreground">
                          لا يمكن تغيير دور الحساب الحالي من هذه الشاشة.
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="managed-user-pin">
                        {managedUserForm.id ? "رمز جديد اختياري" : "رمز الدخول"}
                      </Label>
                      <Input
                        id="managed-user-pin"
                        type="password"
                        inputMode="numeric"
                        maxLength={4}
                        value={managedUserForm.pin}
                        onChange={event =>
                          setManagedUserForm(previous => ({
                            ...previous,
                            pin: event.target.value.replace(/\D+/g, "").slice(0, 4),
                          }))
                        }
                        className="h-12 rounded-xl text-center font-mono tracking-[0.7em]"
                        placeholder="0000"
                      />
                      {managedUserForm.id && (
                        <p className="text-xs text-muted-foreground">
                          اتركه فارغًا إذا لم ترد تغيير رمز الدخول.
                        </p>
                      )}
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="managed-user-email">البريد الإلكتروني</Label>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="managed-user-email"
                          dir="ltr"
                          inputMode="email"
                          value={managedUserForm.email}
                          onChange={event =>
                            setManagedUserForm(previous => ({
                              ...previous,
                              email: event.target.value,
                            }))
                          }
                          className="h-12 rounded-xl pr-11"
                          placeholder="cashier@example.com"
                        />
                      </div>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="h-12 w-full rounded-xl font-bold"
                    disabled={
                      createManagedUserMutation.isPending || updateManagedUserMutation.isPending
                    }
                  >
                    {createManagedUserMutation.isPending || updateManagedUserMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {managedUserForm.id ? "حفظ المستخدم" : "إنشاء المستخدم"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </motion.div>
      </div>
    </div>
  );
}
