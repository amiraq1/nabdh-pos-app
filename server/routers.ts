import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { sdk } from "./_core/sdk";
import { ONE_YEAR_MS } from "@shared/const";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    listUsers: adminProcedure.query(() => db.getUsers()),
    updateProfile: protectedProcedure
      .input(
        z.object({
          name: z.string().trim().min(2).max(80),
        })
      )
      .mutation(({ ctx, input }) => db.updateUserProfile(ctx.user.id, input)),
    createManagedUser: adminProcedure
      .input(
        z.object({
          name: z.string().trim().min(2).max(80),
          role: z.enum(["admin", "cashier", "user"]),
          pin: z.string().length(4),
          email: z.string().email().optional(),
        })
      )
      .mutation(({ input }) => db.createManagedUser(input)),
    updateManagedUser: adminProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().trim().min(2).max(80).optional(),
          role: z.enum(["admin", "cashier", "user"]).optional(),
          pin: z.string().length(4).optional(),
          email: z.string().email().optional(),
        })
      )
      .mutation(({ ctx, input }) => {
        if (input.id === ctx.user.id && input.role && input.role !== ctx.user.role) {
          throw new Error("لا يمكن تغيير دور الحساب الحالي من هذه الشاشة");
        }

        const { id, ...data } = input;
        return db.updateManagedUser(id, data);
      }),
    changePin: protectedProcedure
      .input(
        z.object({
          currentPin: z.string().length(4),
          newPin: z.string().length(4),
        })
      )
      .mutation(({ ctx, input }) =>
        db.updateUserPin(ctx.user.id, input.currentPin, input.newPin)
      ),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
    loginByPin: publicProcedure
      .input(z.string().length(4))
      .mutation(async ({ input, ctx }) => {
        const user = await db.getUserByPin(input);
        if (!user) throw new Error("رقم التعريف غير صحيح");

        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name || "",
          expiresInMs: ONE_YEAR_MS,
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        
        return { success: true };
      }),
  }),

  // ============ Categories Router ============
  categories: router({
    list: publicProcedure.query(() => db.getCategories()),
    get: publicProcedure.input(z.number()).query(({ input }) => db.getCategoryById(input)),
    create: adminProcedure
      .input(z.object({ name: z.string(), description: z.string().optional(), imageUrl: z.string().optional() }))
      .mutation(({ input }) => db.createCategory(input)),
    update: adminProcedure
      .input(z.object({ id: z.number(), name: z.string().optional(), description: z.string().optional(), imageUrl: z.string().optional() }))
      .mutation(({ input: { id, ...data } }) => db.updateCategory(id, data)),
    delete: adminProcedure.input(z.number()).mutation(({ input }) => db.deleteCategory(input)),
  }),

  // ============ Products Router ============
  products: router({
    list: publicProcedure.input(z.number().optional()).query(({ input }) => db.getProducts(input)),
    get: publicProcedure.input(z.number()).query(({ input }) => db.getProductById(input)),
    nextTrackingCode: publicProcedure.query(() => db.getNextProductTrackingCode()),
    getBySku: publicProcedure.input(z.string()).query(({ input }) => db.getProductBySku(input)),
    getByBarcode: publicProcedure.input(z.string()).query(({ input }) => db.getProductByBarcode(input)),
    create: adminProcedure
      .input(z.object({
        categoryId: z.number(),
        name: z.string(),
        description: z.string().optional(),
        sku: z.string().optional(),
        barcode: z.string().optional(),
        price: z.string(),
        costPrice: z.string().optional(),
        imageUrl: z.string().optional(),
        quantity: z.number().default(0),
        minStockLevel: z.number().default(10),
      }))
      .mutation(({ input }) => db.createProduct(input as any)),
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        categoryId: z.number().optional(),
        name: z.string().optional(),
        description: z.string().optional(),
        sku: z.string().optional(),
        barcode: z.string().optional(),
        price: z.string().optional(),
        costPrice: z.string().optional(),
        imageUrl: z.string().optional(),
        quantity: z.number().optional(),
        minStockLevel: z.number().optional(),
      }))
      .mutation(({ input: { id, ...data } }) => db.updateProduct(id, data as any)),
    delete: adminProcedure.input(z.number()).mutation(({ input }) => db.deleteProduct(input)),
  }),

  // ============ Stock Router ============
  stock: router({
    history: publicProcedure.input(z.number()).query(({ input }) => db.getStockHistory(input)),
    addHistory: adminProcedure
      .input(z.object({
        productId: z.number(),
        quantityChange: z.number(),
        reason: z.string(),
        notes: z.string().optional(),
      }))
      .mutation(({ input }) => db.addStockHistory(input as any)),
  }),

  // ============ Sales Router ============
  sales: router({
    list: publicProcedure.input(z.object({ limit: z.number().default(50), offset: z.number().default(0) }).optional()).query(({ input }) => db.getSales(input?.limit, input?.offset)),
    get: publicProcedure.input(z.number()).query(({ input }) => db.getSaleById(input)),
    getByInvoice: publicProcedure.input(z.string()).query(({ input }) => db.getSaleByInvoiceNumber(input)),
    create: protectedProcedure
      .input(z.object({
        invoiceNumber: z.string(),
        totalAmount: z.string(),
        taxAmount: z.string().optional(),
        discountAmount: z.string().optional(),
        finalAmount: z.string(),
        paymentMethod: z.string().optional(),
        customerName: z.string().optional(),
        customerPhone: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(({ ctx, input }) => db.createSale({ ...input, userId: ctx.user.id } as any)),
    checkout: protectedProcedure
      .input(z.object({
        invoiceNumber: z.string(),
        totalAmount: z.string(),
        taxAmount: z.string().optional(),
        discountAmount: z.string().optional(),
        finalAmount: z.string(),
        paymentMethod: z.string().optional(),
        customerName: z.string().optional(),
        customerPhone: z.string().optional(),
        notes: z.string().optional(),
        items: z.array(z.object({
          productId: z.number(),
          quantity: z.number(),
          unitPrice: z.string(),
          subtotal: z.string(),
        })),
      }))
      .mutation(({ ctx, input }) => {
        const { items, ...saleData } = input;
        return db.checkoutTransaction(
          { ...saleData, userId: ctx.user.id } as any,
          items as any
        );
      }),
    items: publicProcedure.input(z.number()).query(({ input }) => db.getSaleItems(input)),
    addItem: protectedProcedure
      .input(z.object({
        saleId: z.number(),
        productId: z.number(),
        quantity: z.number(),
        unitPrice: z.string(),
        subtotal: z.string(),
      }))
      .mutation(({ input }) => db.addSaleItem(input as any)),
  }),

  // ============ Analytics Router ============
  analytics: router({
    dailyTotal: publicProcedure.input(z.date()).query(({ input }) => db.getDailySalesTotal(input)),
    topProducts: publicProcedure.input(z.number().default(10).optional()).query(({ input }) => db.getTopProducts(input)),
  }),
  // ============ Expenses Router ============
  expenses: router({
    list: publicProcedure.query(() => db.getExpenses()),
    create: adminProcedure
      .input(z.object({
        category: z.string(),
        description: z.string(),
        amount: z.string(),
        date: z.date().optional(),
      }))
      .mutation(({ input }) => db.createExpense(input as any)),
    delete: adminProcedure.input(z.number()).mutation(({ input }) => db.deleteExpense(input)),
  }),
});

export type AppRouter = typeof appRouter;
