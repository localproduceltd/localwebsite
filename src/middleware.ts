import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/orders(.*)",
  "/account(.*)",
  "/admin(.*)",
  "/supplier-portal(.*)",
]);

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

// Public routes that should redirect to holding page
const isPublicCustomerRoute = createRouteMatcher([
  "/",
  "/products(.*)",
  "/suppliers(.*)",
  "/map(.*)",
  "/cart(.*)",
]);

// Routes that should always be accessible
const isAlwaysAccessible = createRouteMatcher([
  "/holding(.*)",
  "/admin(.*)",
  "/supplier-portal(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  // Check if user is admin
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string })?.role;
  const isAdmin = role === "admin";

  // Redirect public customer routes to holding page (but allow admin to see everything)
  if (isPublicCustomerRoute(req) && !isAlwaysAccessible(req) && !isAdmin) {
    return NextResponse.redirect(new URL("/holding", req.url));
  }

  if (isProtectedRoute(req)) {
    await auth.protect();
  }

  if (isAdminRoute(req)) {
    if (!isAdmin) {
      return Response.redirect(new URL("/holding", req.url));
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
