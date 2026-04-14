"use client";

import { useUser } from "@clerk/nextjs";

export function useAdmin(): boolean {
  const { user } = useUser();
  const role = user?.publicMetadata?.role as string | undefined;
  return role === "admin";
}
