import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Gate for /api/admin/* routes.
 *
 * Returns either:
 *   - a NextResponse (401 if not signed in, 403 if not admin), to be returned by the caller, or
 *   - { userId } when the request is authorised.
 *
 * Mirrors the admin check in `src/middleware.ts` which gates `/admin(.*)` pages
 * on Clerk `sessionClaims.metadata.role === "admin"`.
 *
 * Usage:
 *   const gate = await requireAdmin();
 *   if (gate instanceof NextResponse) return gate;
 *   const { userId } = gate;
 */
export async function requireAdmin(): Promise<{ userId: string } | NextResponse> {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Sign in required" } },
      { status: 401 },
    );
  }

  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role;
  if (role !== "admin") {
    return NextResponse.json(
      { error: { code: "forbidden", message: "Admin role required" } },
      { status: 403 },
    );
  }

  return { userId };
}

/**
 * Gate for API routes the driver role may also use (delivery route, box returns).
 * Same contract as `requireAdmin`, but accepts role "admin" or "driver".
 * Mirrors the driver allowance in `src/middleware.ts`.
 */
export async function requireAdminOrDriver(): Promise<{ userId: string } | NextResponse> {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Sign in required" } },
      { status: 401 },
    );
  }

  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role;
  if (role !== "admin" && role !== "driver") {
    return NextResponse.json(
      { error: { code: "forbidden", message: "Admin or driver role required" } },
      { status: 403 },
    );
  }

  return { userId };
}
