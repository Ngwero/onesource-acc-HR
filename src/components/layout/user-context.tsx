"use client";

import { createContext, useContext } from "react";
import type { UserRole } from "@/generated/prisma/client";

export type AppUser = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
};

const UserContext = createContext<AppUser | null>(null);

export function UserProvider({
  user,
  children,
}: {
  user: AppUser;
  children: React.ReactNode;
}) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export function useAppUser() {
  const user = useContext(UserContext);
  if (!user) {
    throw new Error("useAppUser must be used within UserProvider");
  }
  return user;
}

export function useAppUserOptional() {
  return useContext(UserContext);
}

export function firstNameOf(fullName: string) {
  const part = fullName.trim().split(/\s+/)[0];
  return part || fullName;
}
