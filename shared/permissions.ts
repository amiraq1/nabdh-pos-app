export type AppRole = "admin" | "cashier" | "user";

/**
 * مجموعات الصلاحيات لتنظيم العرض في واجهة الإدارة
 */
export const PERMISSION_GROUPS = [
  "الحساب",
  "التشغيل",
  "المبيعات",
  "المخزون",
  "التحليلات",
  "الإدارة",
] as const;

export type PermissionGroup = typeof PERMISSION_GROUPS[number];

/**
 * تعريفات الصلاحيات (Single Source of Truth)
 * يتم استخراج نوع AppPermission من مفاتيح (keys) هذه المصفوفة تلقائياً.
 */
export const PERMISSION_DEFINITIONS = [
  {
    key: "dashboard.view",
    label: "عرض اللوحة الرئيسية",
    description: "الوصول إلى لوحة التحكم والتنقل بين الوحدات",
    group: "التشغيل",
  },
  {
    key: "profile.view",
    label: "عرض الملف الشخصي",
    description: "فتح صفحة الحساب ومراجعة الحالة الحالية للجلسة",
    group: "الحساب",
  },
  {
    key: "profile.editSelf",
    label: "تعديل الاسم الشخصي",
    description: "تحديث اسم المستخدم الظاهر داخل النظام",
    group: "الحساب",
  },
  {
    key: "profile.changePin",
    label: "تغيير رمز الدخول",
    description: "تعديل رمز PIN الخاص بالحساب الحالي",
    group: "الحساب",
  },
  {
    key: "settings.api",
    label: "ضبط عنوان الخادم",
    description: "تغيير عنوان API عند تبدل الشبكة",
    group: "الإدارة",
  },
  {
    key: "pos.use",
    label: "استخدام نقطة البيع",
    description: "فتح الكاشير وإتمام الفواتير والطباعة",
    group: "التشغيل",
  },
  {
    key: "products.view",
    label: "عرض المنتجات",
    description: "استعراض المنتجات والبحث والاطلاع على بياناتها",
    group: "المخزون",
  },
  {
    key: "products.manage",
    label: "إدارة المنتجات",
    description: "إضافة المنتجات وتعديلها وحذفها",
    group: "المخزون",
  },
  {
    key: "inventory.view",
    label: "عرض المخزون",
    description: "مراجعة الرصيد وحركة الأصناف والتنبيهات",
    group: "المخزون",
  },
  {
    key: "inventory.adjust",
    label: "تعديل المخزون",
    description: "إضافة حركات جرد وتسويات على الأصناف",
    group: "المخزون",
  },
  {
    key: "reports.view.all",
    label: "عرض كافة التقارير",
    description: "الوصول الشامل لتقارير الأداء والأرباح والمبيعات للكل",
    group: "التحليلات",
  },
  {
    key: "reports.view.own",
    label: "عرض تقاريري الشخصية",
    description: "الوصول إلى تقارير المبيعات والأداء الخاصة بهذا الحساب فقط",
    group: "التحليلات",
  },
  {
    key: "expenses.view",
    label: "عرض المصاريف",
    description: "فتح سجل المصروفات والاطلاع عليه",
    group: "الإدارة",
  },
  {
    key: "expenses.manage",
    label: "إدارة المصاريف",
    description: "إضافة المصروفات أو حذفها",
    group: "الإدارة",
  },
] as const;

export type AppPermission = typeof PERMISSION_DEFINITIONS[number]["key"];

/**
 * مصفوفة الصلاحيات لكل دور (Role Matrix)
 */
export const ROLE_PERMISSIONS: Readonly<Record<AppRole, ReadonlyArray<AppPermission>>> = {
  admin: PERMISSION_DEFINITIONS.map(p => p.key),
  cashier: [
    "dashboard.view",
    "profile.view",
    "profile.editSelf",
    "profile.changePin",
    "pos.use",
    "products.view",
    "inventory.view",
    "reports.view.own",
  ],
  user: [
    "dashboard.view",
    "profile.view",
    "profile.editSelf",
    "profile.changePin",
  ],
};

/**
 * تطبيع نوع الدور لضمان الأمان
 */
export function normalizeRole(role?: string | null): AppRole {
  if (role === "admin" || role === "cashier" || role === "user") {
    return role;
  }
  return "user";
}

/**
 * استرجاع صلاحيات دور معين (يعيد نسخة لمنع التعديل العرضي)
 */
export function getPermissionsForRole(role?: string | null): AppPermission[] {
  return [...ROLE_PERMISSIONS[normalizeRole(role)]];
}

/**
 * التحقق من امتلاك صلاحية معينة
 * يدعم التحقق المتعدد أو المخصص للمستقبل
 */
export function hasPermission(role: string | null | undefined, permission: AppPermission): boolean {
  const permissions = ROLE_PERMISSIONS[normalizeRole(role)];
  return (permissions as ReadonlyArray<string>).includes(permission);
}

/**
 * المسميات العربية للأدوار
 */
export function getRoleLabel(role?: string | null): string {
  switch (normalizeRole(role)) {
    case "admin":
      return "مدير النظام";
    case "cashier":
      return "كاشير";
    default:
      return "مستخدم";
  }
}

/**
 * وصف الأدوار
 */
export function getRoleDescription(role?: string | null): string {
  switch (normalizeRole(role)) {
    case "admin":
      return "صلاحية كاملة لإدارة المتجر والإعدادات والحسابات التشغيلية.";
    case "cashier":
      return "صلاحية تشغيل نقطة البيع ومراجعة البيانات التشغيلية اليومية.";
    default:
      return "وصول محدود للحساب الشخصي والبيانات الأساسية فقط.";
  }
}

/**
 * الحصول على صلاحية بناءً على المفتاح
 */
export function getPermissionDefinition(key: AppPermission) {
  return PERMISSION_DEFINITIONS.find(p => p.key === key);
}

/**
 * تجميع الصلاحيات حسب المجموعات (مفيد لواجهات الإعدادات)
 */
export function getPermissionsGrouped() {
  const groups: Record<PermissionGroup, typeof PERMISSION_DEFINITIONS[number][]> = {} as any;
  PERMISSION_GROUPS.forEach(g => {
    groups[g as PermissionGroup] = PERMISSION_DEFINITIONS.filter(p => p.group === g);
  });
  return groups;
}
