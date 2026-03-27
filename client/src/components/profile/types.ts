import { type AppPermission, type AppRole } from "@shared/permissions";
import { type ShoppingCart } from "lucide-react";

export interface AuthenticatedUser {
  id: number;
  name: string;
  role: AppRole;
  email?: string;
  openId?: string;
  lastSignedIn?: string;
  loginMethod?: "PIN" | "OAUTH";
}

export interface ManagedUser {
  id: number;
  name: string;
  role: string;
  email?: string;
  openId?: string;
  lastSignedIn?: string;
  loginMethod?: string;
}

export interface CapabilityCard {
  title: string;
  description: string;
  permission: AppPermission;
  icon: typeof ShoppingCart;
}
