import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { PRE_LAUNCH } from "@/lib/pre-launch";

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

export default clerkMiddleware(async (auth, req) => {
  // Check if user is admin or signed in
  const { sessionClaims, userId } = await auth();
  const role = (sessionClaims?.metadata as { role?: string })?.role;
  const isAdmin = role === "admin";
  const isSignedIn = !!userId;

  // Pre-launch: redirect root (/) to /home for everyone
  if (PRE_LAUNCH && req.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/home", req.url));
  }

  // Pre-launch: redirect non-signed-in users from cart to home
  // Signed-in users (customers) can access cart
  if (PRE_LAUNCH && isAdminOnlyPreLaunch(req) && !isSignedIn) {
    return NextResponse.redirect(new URL("/home", req.url));
  }

  if (isProtectedRoute(req)) {
    await auth.protect();
  }

  if (isAdminRoute(req)) {
    if (!isAdmin) {
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
