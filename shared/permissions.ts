export type AppRole = "admin" | "cashier" | "user";

export type AppPermission =
  | "dashboard.view"
  | "profile.view"
  | "profile.editSelf"
  | "profile.changePin"
  | "settings.api"
  | "pos.use"
  | "products.view"
  | "products.manage"
  | "categories.view"
  | "categories.manage"
  | "inventory.view"
  | "inventory.adjust"
  | "reports.view"
  | "expenses.view"
  | "expenses.manage";

export type PermissionDefinition = {
  key: AppPermission;
  label: string;
  description: string;
  group: "الحساب" | "المبيعات" | "المخزون" | "التحليلات" | "الإدارة";
};

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  {
    key: "dashboard.view",
    label: "عرض اللوحة الرئيسية",
    description: "الوصول إلى لوحة التحكم والتنقل بين الوحدات المسموح بها",
    group: "الحساب",
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
    description: "تغيير عنوان API عند تبدل الشبكة أو بيئة العمل",
    group: "الإدارة",
  },
  {
    key: "pos.use",
    label: "استخدام نقطة البيع",
    description: "فتح الكاشير وإتمام الفواتير والطباعة",
    group: "المبيعات",
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
    key: "categories.view",
    label: "عرض التصنيفات",
    description: "الوصول إلى بنية التصنيفات داخل النظام",
    group: "المخزون",
  },
  {
    key: "categories.manage",
    label: "إدارة التصنيفات",
    description: "إنشاء التصنيفات وتعديلها وحذفها",
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
    key: "reports.view",
    label: "عرض التقارير",
    description: "الوصول إلى تقارير الأداء والمبيعات",
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
];

export const ROLE_PERMISSIONS: Record<AppRole, AppPermission[]> = {
  admin: PERMISSION_DEFINITIONS.map(permission => permission.key),
  cashier: [
    "dashboard.view",
    "profile.view",
    "profile.editSelf",
    "profile.changePin",
    "pos.use",
    "products.view",
    "categories.view",
    "inventory.view",
    "reports.view",
  ],
  user: [
    "dashboard.view",
    "profile.view",
    "profile.editSelf",
    "profile.changePin",
  ],
};

export function normalizeRole(role?: string | null): AppRole {
  if (role === "admin" || role === "cashier" || role === "user") {
    return role;
  }

  return "user";
}

export function getPermissionsForRole(role?: string | null) {
  return ROLE_PERMISSIONS[normalizeRole(role)];
}

export function hasPermission(role: string | null | undefined, permission: AppPermission) {
  return getPermissionsForRole(role).includes(permission);
}

export function getRoleLabel(role?: string | null) {
  switch (normalizeRole(role)) {
    case "admin":
      return "مدير النظام";
    case "cashier":
      return "كاشير";
    default:
      return "مستخدم";
  }
}

export function getRoleDescription(role?: string | null) {
  switch (normalizeRole(role)) {
    case "admin":
      return "صلاحية كاملة لإدارة المتجر والإعدادات والحسابات التشغيلية.";
    case "cashier":
      return "صلاحية تشغيل نقطة البيع ومراجعة البيانات التشغيلية اليومية.";
    default:
      return "وصول محدود للحساب الشخصي والبيانات الأساسية فقط.";
  }
}
