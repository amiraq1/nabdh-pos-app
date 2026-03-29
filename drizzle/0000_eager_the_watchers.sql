CREATE TYPE "public"."isActive" AS ENUM('true', 'false');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('user', 'admin', 'cashier');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('completed', 'pending', 'cancelled');--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"imageUrl" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" varchar(100) NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"date" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"categoryId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"sku" varchar(100) NOT NULL,
	"barcode" varchar(100),
	"price" numeric(10, 2) NOT NULL,
	"costPrice" numeric(10, 2),
	"imageUrl" text,
	"quantity" integer DEFAULT 0 NOT NULL,
	"minStockLevel" integer DEFAULT 10 NOT NULL,
	"isActive" "isActive" DEFAULT 'true' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "products_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "saleItems" (
	"id" serial PRIMARY KEY NOT NULL,
	"saleId" integer NOT NULL,
	"productId" integer NOT NULL,
	"quantity" integer NOT NULL,
	"unitPrice" numeric(10, 2) NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoiceNumber" varchar(100) NOT NULL,
	"userId" integer NOT NULL,
	"totalAmount" numeric(10, 2) NOT NULL,
	"taxAmount" numeric(10, 2) DEFAULT '0',
	"discountAmount" numeric(10, 2) DEFAULT '0',
	"finalAmount" numeric(10, 2) NOT NULL,
	"paymentMethod" varchar(50) DEFAULT 'cash',
	"customerName" varchar(255),
	"customerPhone" varchar(20),
	"notes" text,
	"status" "status" DEFAULT 'completed' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sales_invoiceNumber_unique" UNIQUE("invoiceNumber")
);
--> statement-breakpoint
CREATE TABLE "stockHistory" (
	"id" serial PRIMARY KEY NOT NULL,
	"productId" integer NOT NULL,
	"quantityChange" integer NOT NULL,
	"reason" varchar(100) NOT NULL,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "role" DEFAULT 'user' NOT NULL,
	"pin" varchar(4),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
