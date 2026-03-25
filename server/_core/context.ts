import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";

import type { User } from "../../drizzle/schema";
import { getUserByOpenId } from "../db";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch {
    if (process.env.NODE_ENV === "development") {
      user =
        (await getUserByOpenId("dev-mock-user")) ?? {
          id: 1,
          openId: "dev-mock-user",
          name: "المدير (وضع التطوير)",
          email: "admin@example.com",
          role: "admin",
          loginMethod: "mock",
          pin: "1234",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        };
    } else {
      user = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
