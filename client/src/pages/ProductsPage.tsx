import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  Barcode,
  Camera,
  Edit2,
  Loader2,
  Minus,
  Package,
  Plus,
  Search,
  Trash2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/_core/hooks/useAuth";
import BarcodeScanner from "@/components/BarcodeScanner";
import PageHeader from "@/components/PageHeader";
import PageShell from "@/components/PageShell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/lib/utils";
import { hasPermission } from "@shared/permissions";

type ProductFormState = {
  categoryId: number;
  name: string;
  description: string;
  sku: string;
  barcode: string;
  price: string;
  costPrice: string;
  quantity: string;
  minStockLevel: string;
};

const INITIAL_FORM: ProductFormState = {
  categoryId: 0,
  name: "",
  description: "",
  sku: "",
  barcode: "",
  price: "",
  costPrice: "",
  quantity: "0",
  minStockLevel: "10",
};

const sanitizeIntegerInput = (value: string) => value.replace(/\D+/g, "");

const parseNonNegativeInteger = (value: string, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

export default function ProductsPage() {
  const { user } = useAuth();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [formData, setFormData] = useState<ProductFormState>(INITIAL_FORM);
  const [productToDelete, setProductToDelete] = useState<any | null>(null);

  const {
    data: products,
    isLoading: productsLoading,
    refetch: refetchProducts,
  } = trpc.products.list.useQuery(
    selectedCategory !== "all" ? Number.parseInt(selectedCategory, 10) : undefined
  );
  const { data: categories } = trpc.categories.list.useQuery();
  const {
    data: nextTrackingCode,
    refetch: refetchNextTrackingCode,
    isFetching: isTrackingCodeLoading,
  } = trpc.products.nextTrackingCode.useQuery(undefined, {
    enabled: true,
  });
  const createMutation = trpc.products.create.useMutation();
  const updateMutation = trpc.products.update.useMutation();
  const deleteMutation = trpc.products.delete.useMutation();
  const canManageProducts = hasPermission((user as any)?.role, "products.manage");

  const categoryNameById = useMemo<Map<number, string>>(
    () =>
      new Map(
        (categories ?? []).map((category: any): [number, string] => [category.id, category.name])
      ),
    [categories]
  );

  const filteredProducts = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    return (
      products?.filter((product: any) => {
        if (!keyword) {
          return true;
        }

        return (
          product.name.toLowerCase().includes(keyword) ||
          product.sku.toLowerCase().includes(keyword) ||
          product.barcode?.toLowerCase()?.includes(keyword)
        );
      }) ?? []
    );
  }, [products, searchTerm]);

  const barcodeBuffer = useRef("");
  const barcodeTimeout = useRef<NodeJS.Timeout | null>(null);

  const resetForm = () => {
    setFormData(INITIAL_FORM);
    setEditingId(null);
    setIsScannerOpen(false);
  };

  const updateIntegerField = (field: "quantity" | "minStockLevel", value: string) => {
    setFormData(previous => ({
      ...previous,
      [field]: sanitizeIntegerInput(value),
    }));
  };

  const normalizeIntegerField = (field: "quantity" | "minStockLevel") => {
    const fallback = field === "minStockLevel" ? 10 : 0;

    setFormData(previous => ({
      ...previous,
      [field]: String(parseNonNegativeInteger(previous[field], fallback)),
    }));
  };

  const adjustIntegerField = (field: "quantity" | "minStockLevel", amount: number) => {
    setFormData(previous => {
      const fallback = field === "minStockLevel" ? 10 : 0;
      const nextValue = Math.max(0, parseNonNegativeInteger(previous[field], fallback) + amount);

      return {
        ...previous,
        [field]: String(nextValue),
      };
    });
  };

  useEffect(() => {
    if (editingId || !nextTrackingCode) {
      return;
    }

    setFormData(previous => ({
      ...previous,
      sku: nextTrackingCode,
    }));
  }, [editingId, nextTrackingCode]);

  useEffect(() => {
    if (!isFormOpen) {
      if (barcodeTimeout.current) {
        clearTimeout(barcodeTimeout.current);
      }
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["TEXTAREA", "INPUT", "SELECT"].includes(target.tagName)) {
        return;
      }

      if (event.key === "Enter") {
        if (barcodeBuffer.current.length > 3) {
          setFormData(previous => ({ ...previous, barcode: barcodeBuffer.current }));
          toast.success(`تم التقاط الباركود: ${barcodeBuffer.current}`);
          barcodeBuffer.current = "";
        }
        return;
      }

      if (event.key.length === 1) {
        barcodeBuffer.current += event.key;
        if (barcodeTimeout.current) {
          clearTimeout(barcodeTimeout.current);
        }
        barcodeTimeout.current = setTimeout(() => {
          barcodeBuffer.current = "";
        }, 100);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (barcodeTimeout.current) {
        clearTimeout(barcodeTimeout.current);
      }
    };
  }, [isFormOpen]);

  const handleOpenCreate = async () => {
    resetForm();
    setIsFormOpen(true);

    const result = await refetchNextTrackingCode();
    if (result.data) {
      setFormData(previous => ({ ...previous, sku: result.data }));
    }
  };

  const handleEdit = (product: any) => {
    setEditingId(product.id);
    setFormData({
      categoryId: product.categoryId,
      name: product.name ?? "",
      description: product.description ?? "",
      sku: product.sku ?? "",
      barcode: product.barcode ?? "",
      price: product.price?.toString() ?? "",
      costPrice: product.costPrice?.toString() ?? "",
      quantity: String(product.quantity ?? 0),
      minStockLevel: String(product.minStockLevel ?? 10),
    });
    setIsFormOpen(true);
  };

  const handleBarcodeDetected = (barcode: string) => {
    const trimmedCode = barcode.trim();
    if (!trimmedCode) {
      return;
    }

    setFormData(previous => ({ ...previous, barcode: trimmedCode }));
    setIsScannerOpen(false);
    toast.success(`تم التقاط الباركود: ${trimmedCode}`);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formData.categoryId) {
      toast.error("اختر تصنيفًا للمنتج أولًا");
      return;
    }

    if (!formData.name.trim()) {
      toast.error("اسم المنتج مطلوب");
      return;
    }

    if (!formData.price.trim()) {
      toast.error("سعر البيع مطلوب");
      return;
    }

    const payload = {
      categoryId: formData.categoryId,
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      sku: formData.sku.trim() || undefined,
      barcode: formData.barcode.trim() || undefined,
      price: formData.price.trim(),
      costPrice: formData.costPrice.trim() || undefined,
      quantity: parseNonNegativeInteger(formData.quantity, 0),
      minStockLevel: parseNonNegativeInteger(formData.minStockLevel, 10),
    };

    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, ...payload });
        toast.success("تم تحديث المنتج بنجاح");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("تمت إضافة المنتج بنجاح");
      }

      setIsFormOpen(false);
      resetForm();
      await refetchProducts();
    } catch (error) {
      console.error("Product save error:", error);
      toast.error("تعذر حفظ بيانات المنتج");
    }
  };

  const handleDelete = async () => {
    if (!productToDelete) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(productToDelete.id);
      toast.success("تم حذف المنتج");
      setProductToDelete(null);
      await refetchProducts();
    } catch (error) {
      console.error("Product delete error:", error);
      toast.error("تعذر حذف المنتج");
    }
  };

  return (
    <PageShell>
      <Dialog
        open={isFormOpen}
        onOpenChange={open => {
          setIsFormOpen(open);
          if (!open) {
            resetForm();
          }
        }}
      >
        <PageHeader
          title="المنتجات"
          subtitle="إدارة المخزون، الأسعار، والباركود من مساحة واحدة واضحة"
          icon={Package}
          actions={
            <Button
              className="h-14 rounded-2xl px-8 font-display text-lg font-bold shadow-xl shadow-primary/20"
              onClick={() => void handleOpenCreate()}
              disabled={!canManageProducts}
            >
              <Plus className="h-5 w-5" />
              إضافة منتج
            </Button>
          }
        />

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="rounded-[32px] border-border/20 bg-background/50 p-6 shadow-xl shadow-primary/5">
            <div className="grid gap-4 md:grid-cols-[1fr_220px]">
              <div className="relative">
                <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={event => setSearchTerm(event.target.value)}
                  placeholder="ابحث بالاسم أو الباركود أو رمز التتبع"
                  className="h-14 rounded-2xl border-border/30 bg-background/60 pr-11 text-base"
                />
              </div>

              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="h-14 rounded-2xl border-border/30 bg-background/60 text-base">
                  <SelectValue placeholder="كل التصنيفات" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل التصنيفات</SelectItem>
                  {(categories ?? []).map((category: any) => (
                    <SelectItem key={category.id} value={String(category.id)}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Card>

          <Card className="rounded-[32px] border-border/20 bg-gradient-to-br from-primary/10 via-background/55 to-background/35 p-6 shadow-xl shadow-primary/10">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="font-display text-sm font-bold uppercase tracking-[0.25em] text-primary/80">
                  تدفق الإضافة
                </p>
                <h2 className="font-display text-2xl font-black text-foreground">
                  الكمية الآن مستقرة
                </h2>
                <p className="max-w-md text-sm text-muted-foreground">
                  الإدخال العددي صار مرنًا أثناء الكتابة على الهاتف، ورمز التتبع يُولد تلقائيًا حسب التسلسل.
                </p>
              </div>
              <div className="rounded-[24px] border border-primary/20 bg-background/80 p-4 text-primary shadow-lg shadow-primary/10">
                <Zap className="h-7 w-7" />
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[24px] border border-border/30 bg-background/70 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  المنتجات
                </p>
                <p className="mt-2 font-display text-3xl font-black">{filteredProducts.length}</p>
              </div>
              <div className="rounded-[24px] border border-border/30 bg-background/70 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  منخفض المخزون
                </p>
                <p className="mt-2 font-display text-3xl font-black">
                  {
                    filteredProducts.filter(
                      (product: any) =>
                        Number(product.quantity ?? 0) <= Number(product.minStockLevel ?? 0)
                    ).length
                  }
                </p>
              </div>
              <div className="rounded-[24px] border border-border/30 bg-background/70 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  التالي
                </p>
                <p className="mt-2 font-display text-xl font-black">
                  {nextTrackingCode ?? "PRD-....."}
                </p>
              </div>
            </div>
          </Card>
        </div>

        <DialogContent
          showCloseButton={false}
          className="max-h-[92vh] overflow-hidden rounded-[32px] border-0 p-0 shadow-2xl sm:max-w-4xl"
        >
          <div className="grid max-h-[92vh] gap-0 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="hidden overflow-y-auto bg-gradient-to-br from-foreground to-foreground/85 p-8 text-background lg:block">
              <DialogHeader className="space-y-4 text-right">
                <div className="inline-flex w-fit rounded-full border border-white/15 bg-white/10 px-4 py-1 text-xs font-bold uppercase tracking-[0.24em] text-white/80">
                  Product Console
                </div>
                <DialogTitle className="font-display text-3xl font-black">
                  {editingId ? "تعديل بيانات المنتج" : "إضافة منتج جديد"}
                </DialogTitle>
                <DialogDescription className="text-sm leading-7 text-white/70">
                  رمز التتبع ثابت بالتسلسل، والكمية تُدار بإدخال مرحلي واضح يمنع القفزات غير المقصودة أثناء الكتابة.
                </DialogDescription>
              </DialogHeader>

              <div className="mt-10 space-y-4">
                <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/45">
                    رمز التتبع
                  </p>
                  <p className="mt-3 font-display text-3xl font-black tracking-[0.08em]">
                    {editingId
                      ? formData.sku || "PRD-....."
                      : isTrackingCodeLoading
                        ? "جارِ التوليد..."
                        : formData.sku || nextTrackingCode || "PRD-....."}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-white/65">
                    يُنشأ تلقائيًا من الخادم حسب ترتيب الإضافة ولا يحتاج إدخالًا يدويًا.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/45">
                      الكمية الحالية
                    </p>
                    <p className="mt-2 font-display text-2xl font-black">{formData.quantity || "0"}</p>
                  </div>
                  <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/45">
                      حد التنبيه
                    </p>
                    <p className="mt-2 font-display text-2xl font-black">
                      {formData.minStockLevel || "10"}
                    </p>
                  </div>
                </div>

                <div className="rounded-[24px] border border-amber-300/15 bg-amber-300/10 p-4 text-amber-100">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <p className="text-sm leading-6">
                      تم حذف حقل رابط صورة المنتج من التدفق بالكامل لتقليل الحمل الذهني وتسريع الإضافة.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-y-auto bg-background p-6 sm:p-8">
              <div className="sticky top-0 z-20 -mx-6 mb-6 flex items-center justify-between border-b border-border/40 bg-background/95 px-6 pb-4 pt-1 backdrop-blur sm:-mx-8 sm:px-8">
                <div>
                  <p className="font-display text-xl font-black text-foreground">
                    {editingId ? "تعديل المنتج" : "إضافة منتج"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    أكمل الحقول ثم احفظ مباشرة
                  </p>
                </div>
                <DialogClose asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 rounded-2xl border-border/40"
                    aria-label="الرجوع"
                  >
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </DialogClose>
              </div>

              <div className="mb-6 rounded-[24px] border border-border/30 bg-muted/30 p-4 lg:hidden">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
                      رمز التتبع
                    </p>
                    <p className="mt-2 font-display text-xl font-black tracking-[0.08em] text-foreground">
                      {editingId
                        ? formData.sku || "PRD-....."
                        : isTrackingCodeLoading
                          ? "جارِ التوليد..."
                          : formData.sku || nextTrackingCode || "PRD-....."}
                    </p>
                  </div>
                  <div className="rounded-[20px] bg-primary/10 p-3 text-primary">
                    <Package className="h-5 w-5" />
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-display font-bold text-muted-foreground">
                      اسم المنتج
                    </label>
                    <Input
                      value={formData.name}
                      onChange={event =>
                        setFormData(previous => ({ ...previous, name: event.target.value }))
                      }
                      placeholder="مثال: شاحن سريع 20 واط"
                      className="h-14 rounded-2xl border-border/40 bg-background/60"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-display font-bold text-muted-foreground">
                      التصنيف
                    </label>
                    <Select
                      value={formData.categoryId ? String(formData.categoryId) : ""}
                      onValueChange={value =>
                        setFormData(previous => ({
                          ...previous,
                          categoryId: Number.parseInt(value, 10),
                        }))
                      }
                    >
                      <SelectTrigger className="h-14 rounded-2xl border-border/40 bg-background/60">
                        <SelectValue placeholder="اختر تصنيف المنتج" />
                      </SelectTrigger>
                      <SelectContent>
                        {(categories ?? []).map((category: any) => (
                          <SelectItem key={category.id} value={String(category.id)}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-display font-bold text-muted-foreground">
                      رمز التتبع
                    </label>
                    <Input
                      value={
                        editingId
                          ? formData.sku
                          : formData.sku || nextTrackingCode || (isTrackingCodeLoading ? "..." : "")
                      }
                      readOnly
                      className="h-14 rounded-2xl border-border/40 bg-muted/40 font-display tracking-[0.18em]"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-sm font-display font-bold text-muted-foreground">
                        الباركود
                      </label>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 rounded-xl border-border/40 px-4"
                        onClick={() => setIsScannerOpen(true)}
                      >
                        <Camera className="h-4 w-4" />
                        مسح بالكاميرا
                      </Button>
                    </div>
                    <div className="relative">
                      <Barcode className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={formData.barcode}
                        onChange={event =>
                          setFormData(previous => ({ ...previous, barcode: event.target.value }))
                        }
                        placeholder="امسح أو أدخل الباركود"
                        className="h-14 rounded-2xl border-border/40 bg-background/60 pr-11"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-display font-bold text-muted-foreground">
                      سعر البيع
                    </label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={formData.price}
                      onChange={event =>
                        setFormData(previous => ({ ...previous, price: event.target.value }))
                      }
                      placeholder="0.00"
                      className="h-14 rounded-2xl border-border/40 bg-background/60"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-display font-bold text-muted-foreground">
                      سعر التكلفة
                    </label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={formData.costPrice}
                      onChange={event =>
                        setFormData(previous => ({ ...previous, costPrice: event.target.value }))
                      }
                      placeholder="اختياري"
                      className="h-14 rounded-2xl border-border/40 bg-background/60"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-display font-bold text-muted-foreground">
                      الكمية المضافة
                    </label>
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-12 w-12 rounded-2xl border-border/40"
                        onClick={() => adjustIntegerField("quantity", -1)}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Input
                        inputMode="numeric"
                        value={formData.quantity}
                        onChange={event => updateIntegerField("quantity", event.target.value)}
                        onBlur={() => normalizeIntegerField("quantity")}
                        placeholder="0"
                        className="h-14 rounded-2xl border-border/40 bg-background/60 text-center text-lg font-bold"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-12 w-12 rounded-2xl border-border/40"
                        onClick={() => adjustIntegerField("quantity", 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-display font-bold text-muted-foreground">
                      حد التنبيه للمخزون
                    </label>
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-12 w-12 rounded-2xl border-border/40"
                        onClick={() => adjustIntegerField("minStockLevel", -1)}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Input
                        inputMode="numeric"
                        value={formData.minStockLevel}
                        onChange={event => updateIntegerField("minStockLevel", event.target.value)}
                        onBlur={() => normalizeIntegerField("minStockLevel")}
                        placeholder="10"
                        className="h-14 rounded-2xl border-border/40 bg-background/60 text-center text-lg font-bold"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-12 w-12 rounded-2xl border-border/40"
                        onClick={() => adjustIntegerField("minStockLevel", 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-display font-bold text-muted-foreground">
                      وصف مختصر
                    </label>
                    <Textarea
                      value={formData.description}
                      onChange={event =>
                        setFormData(previous => ({ ...previous, description: event.target.value }))
                      }
                      placeholder="تفاصيل تساعدك في التمييز بين النسخ أو الموردين"
                      className="min-h-[120px] rounded-[24px] border-border/40 bg-background/60"
                    />
                  </div>
                </div>

                <div className="sticky bottom-0 z-20 -mx-6 border-t border-border/40 bg-background/95 px-6 pb-1 pt-4 backdrop-blur sm:-mx-8 sm:px-8">
                  <Button
                    type="submit"
                    className="h-14 w-full rounded-2xl font-display text-lg font-bold shadow-xl shadow-primary/20"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {createMutation.isPending || updateMutation.isPending ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : editingId ? (
                      "حفظ التعديلات"
                    ) : (
                      "إضافة المنتج الآن"
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {productsLoading ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary/30" />
          <p className="text-sm text-muted-foreground">جارِ تحميل المنتجات...</p>
        </div>
      ) : filteredProducts.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filteredProducts.map((product: any) => {
              const quantity = Number(product.quantity ?? 0);
              const minStockLevel = Number(product.minStockLevel ?? 0);
              const isLowStock = quantity <= minStockLevel;

              return (
                <motion.div
                  key={product.id}
                  layout
                  initial={{ opacity: 0, y: 18, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 18, scale: 0.98 }}
                >
                  <Card className="group h-full overflow-hidden rounded-[32px] border-border/20 bg-background/55 p-6 shadow-lg shadow-primary/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/10">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-[24px] bg-primary/10 text-primary">
                          <Package className="h-7 w-7" />
                        </div>
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-display text-xl font-black text-foreground">
                              {product.name}
                            </h3>
                            {isLowStock && (
                              <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-600">
                                مخزون منخفض
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {categoryNameById.get(product.categoryId) ?? "بدون تصنيف"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-10 w-10 rounded-2xl border-border/40"
                          onClick={() => handleEdit(product)}
                          disabled={!canManageProducts}
                        >
                          <Edit2 className="h-4 w-4 text-primary" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-10 w-10 rounded-2xl border-destructive/20 text-destructive hover:bg-destructive/10"
                          onClick={() => setProductToDelete(product)}
                          disabled={!canManageProducts}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[24px] border border-border/30 bg-muted/30 p-4">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                          رمز التتبع
                        </p>
                        <p className="mt-2 font-display text-base font-black tracking-[0.18em]">
                          {product.sku}
                        </p>
                      </div>
                      <div className="rounded-[24px] border border-border/30 bg-muted/30 p-4">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                          الباركود
                        </p>
                        <p className="mt-2 text-sm font-bold">
                          {product.barcode || "غير محدد"}
                        </p>
                      </div>
                    </div>

                    {product.description && (
                      <p className="mt-5 line-clamp-2 text-sm leading-7 text-muted-foreground">
                        {product.description}
                      </p>
                    )}

                    <div className="mt-6 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-[24px] border border-border/30 bg-background/70 p-4">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                          البيع
                        </p>
                        <p className="mt-2 font-display text-lg font-black">
                          {formatCurrency(Number(product.price ?? 0))}
                        </p>
                      </div>
                      <div className="rounded-[24px] border border-border/30 bg-background/70 p-4">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                          التكلفة
                        </p>
                        <p className="mt-2 font-display text-lg font-black">
                          {product.costPrice
                            ? formatCurrency(Number(product.costPrice))
                            : "غير محدد"}
                        </p>
                      </div>
                      <div className="rounded-[24px] border border-border/30 bg-background/70 p-4">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                          المخزون
                        </p>
                        <p className="mt-2 font-display text-lg font-black">
                          {quantity} / {minStockLevel}
                        </p>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      ) : (
        <Card className="flex min-h-[420px] flex-col items-center justify-center rounded-[40px] border-dashed border-border/30 bg-background/35 px-6 text-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Package className="h-12 w-12 stroke-[1.6]" />
          </div>
          <h3 className="mt-6 font-display text-2xl font-black">لا توجد منتجات مطابقة</h3>
          <p className="mt-3 max-w-md text-sm leading-7 text-muted-foreground">
            غيّر كلمات البحث أو افتح منتجًا جديدًا. رمز التتبع التالي سيُنشأ تلقائيًا عند الإضافة.
          </p>
        </Card>
      )}

      <AlertDialog
        open={Boolean(productToDelete)}
        onOpenChange={open => {
          if (!open) {
            setProductToDelete(null);
          }
        }}
      >
        <AlertDialogContent className="rounded-[28px] border-border/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl font-black">
              حذف المنتج
            </AlertDialogTitle>
            <AlertDialogDescription className="leading-7">
              سيتم حذف المنتج{" "}
              <span className="font-display font-black text-foreground">
                {productToDelete?.name ?? ""}
              </span>{" "}
              نهائيًا من القائمة الحالية.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={event => {
                event.preventDefault();
                void handleDelete();
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "تأكيد الحذف"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BarcodeScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onBarcodeDetected={handleBarcodeDetected}
      />
    </PageShell>
  );
}
