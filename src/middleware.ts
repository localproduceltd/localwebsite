import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/orders(.*)",
  "/account(.*)",
  "/admin(.*)",
  "/supplier-portal(.*)",
]);

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

// Pre-launch: routes that require admin (cart only - products shows overlay)
const isAdminOnlyPreLaunch = createRouteMatcher([
  "/cart(.*)",
]);

// Pre-launch: routes open to everyone (home, suppliers, map)
const isPreLaunchPublic = createRouteMatcher([
  "/home(.*)",
  "/suppliers(.*)",
  "/map(.*)",
]);

// Routes that should always be accessible
const isAlwaysAccessible = createRouteMatcher([
  "/admin(.*)",
  "/supplier-portal(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api(.*)",
]);

// Pre-launch mode - set to false on May 8th to disable redirects
const PRE_LAUNCH = true;

export default clerkMiddleware(async (auth, req) => {
  // Check if user is admin
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string })?.role;
  const isAdmin = role === "admin";

  // Pre-launch: redirect root (/) to /home for everyone
  if (PRE_LAUNCH && req.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/home", req.url));
  }

  // Pre-launch: redirect non-admin users from products/cart to home
  if (PRE_LAUNCH && isAdminOnlyPreLaunch(req) && !isAdmin) {
    return NextResponse.redirect(new URL("/home", req.url));
  }

  if (isProtectedRoute(req)) {
    await auth.protect();
  }

  if (isAdminRoute(req)) {
    if (!isAdmin) {
      return Response.redirect(new URL("/", req.url));
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
