import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/orders(.*)",
  "/account(.*)",
  "/admin(.*)",
  "/supplier-portal(.*)",
]);

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

// Admin pages a "driver" role is allowed to use. Customers was removed Jul 2026:
// the stop cards on Driver Run carry everything the driver needs (address, phone,
// notes, box flags), and the Customers tab is commercial information.
const isDriverAllowedRoute = createRouteMatcher([
  "/admin/driver(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string })?.role;
  const isAdmin = role === "admin";
  const isDriver = role === "driver";

  // Redirect root to /home
  if (req.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/home", req.url));
  }

  if (isProtectedRoute(req)) {
    await auth.protect();
  }

  if (isAdminRoute(req) && !isAdmin) {
    if (isDriver) {
      if (!isDriverAllowedRoute(req)) {
        return NextResponse.redirect(new URL("/admin/driver", req.url));
      }
    } else {
      return NextResponse.redirect(new URL("/home", req.url));
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
