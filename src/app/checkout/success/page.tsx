"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Package, ArrowRight } from "lucide-react";
import { useCart } from "@/lib/cart-context";

function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [orderNumber, setOrderNumber] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { clearCart } = useCart();

  useEffect(() => {
    if (sessionId) {
      // Confirm the session and create the order
      fetch("/api/checkout/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setOrderNumber(data.orderNumber);
            // Clear the cart after successful order
            clearCart();
            sessionStorage.removeItem("pendingCheckout");
          } else {
            setError(true);
          }
          setLoading(false);
        })
        .catch(() => {
          setError(true);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [sessionId, clearCart]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
          <p className="mt-4 text-muted">Processing your order...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="rounded-2xl bg-surface p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-primary">Something went wrong</h1>
          <p className="mt-2 text-muted">
            There was an issue processing your order. Please contact us if you were charged.
          </p>
          <Link
            href="/cart"
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary/90"
          >
            Return to Cart
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <div className="rounded-2xl bg-surface p-8 shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle className="h-10 w-10 text-green-600" />
        </div>
        
        <h1 className="mt-6 text-2xl font-bold text-primary">Payment Successful!</h1>
        {orderNumber && (
          <p className="mt-2 text-lg font-medium text-secondary">Order #{orderNumber}</p>
        )}
        <p className="mt-2 text-muted">
          Thank you for your order. We&apos;ve sent a confirmation email with your order details.
        </p>

        <div className="mt-8 rounded-xl bg-secondary/10 p-6">
          <div className="flex items-center justify-center gap-2 text-primary">
            <Package className="h-5 w-5" />
            <span className="font-medium">What happens next?</span>
          </div>
          <ul className="mt-4 space-y-2 text-sm text-muted text-left">
            <li>• Your order has been sent to our suppliers</li>
            <li>• They&apos;ll prepare your items fresh for delivery</li>
            <li>• You&apos;ll receive updates as your order progresses</li>
            <li>• Your order will arrive on your selected delivery day</li>
          </ul>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/orders"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary/90"
          >
            View My Orders
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/products"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-primary/20 px-6 py-3 text-sm font-semibold text-primary transition hover:bg-secondary/10"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
          <p className="mt-4 text-muted">Loading...</p>
        </div>
      </div>
    }>
      <CheckoutSuccessContent />
    </Suspense>
  );
}
