"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPinned, ChevronDown, X } from "lucide-react";
import AboutJosie from "@/components/AboutJosie";

export default function HowItWorks() {
  const [isOpen, setIsOpen] = useState(false);
  const [deliveryExpanded, setDeliveryExpanded] = useState(false);

  const openCarrieFeedback = () => {
    const carrieButton = document.querySelector('[aria-label="Leave feedback"]') as HTMLButtonElement;
    if (carrieButton) carrieButton.click();
  };

  return (
    <>
      {/* Compact banner - always visible */}
      <section className="border-b border-primary/5 bg-white px-4 py-6">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="text-center sm:text-left">
            <p className="text-sm font-semibold text-primary">
              🥕 Order by Wednesday 7pm, delivered Friday.
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Fresh local produce from Derbyshire&apos;s farmers and producers.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsOpen(true)}
              className="rounded-lg border border-secondary bg-white px-4 py-2 text-sm font-semibold text-secondary transition hover:bg-secondary/5"
            >
              How it works
            </button>
            <Link
              href="/map"
              className="inline-flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white transition hover:bg-secondary/90"
            >
              <MapPinned size={16} />
              Check delivery
            </Link>
          </div>
        </div>
      </section>

      {/* Modal/overlay - shown when expanded */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-sm p-4 sm:p-6"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="relative my-8 w-full max-w-2xl rounded-2xl bg-surface shadow-xl animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute right-3 top-3 z-10 rounded-full bg-white/80 p-2 text-muted transition hover:bg-white hover:text-primary"
            >
              <X size={18} />
            </button>

            <div className="p-6 sm:p-8">
              {/* Header */}
              <h2 className="text-2xl font-bold text-primary">How it works</h2>
              <p className="mt-1 text-muted">We connect Derbyshire&apos;s farmers, producers and independent suppliers straight to your door - no supermarket in the middle.</p>

              {/* Cut-off reminder */}
              <div className="mt-6 rounded-lg bg-secondary px-4 py-3 text-center">
                <p className="text-sm font-semibold text-white">
                  🥕 Order cut-off: Wednesday 7pm
                </p>
              </div>

              {/* Three steps */}
              <div className="mt-6 space-y-4">
                <div className="flex gap-4">
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-white">1</div>
                  <div>
                    <h4 className="font-bold text-primary">You order</h4>
                    <p className="mt-1 text-sm text-muted">Browse the site and fill your basket from as many local suppliers and producers as you like. Check out by Wednesday 7pm. Once you&apos;ve checked out, you can still add to your order if needed.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-white">2</div>
                  <div>
                    <h4 className="font-bold text-primary">We collect &amp; pack</h4>
                    <p className="mt-1 text-sm text-muted">Your suppliers drop everything fresh at our unit in Bradley on Thursday. We pack it by hand on Thursday night and Friday morning.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-white">3</div>
                  <div>
                    <h4 className="font-bold text-primary">We deliver</h4>
                    <p className="mt-1 text-sm text-muted">One delivery to your door on Friday. Pick your slot at checkout and tell us how you&apos;d like it left.</p>

                    {/* Delivery options collapsible */}
                    <button
                      onClick={() => setDeliveryExpanded(!deliveryExpanded)}
                      className="mt-3 flex w-full items-center justify-between rounded-lg border border-primary/10 bg-white px-3 py-2 text-left text-sm font-medium text-primary transition hover:border-secondary/30"
                    >
                      <span>Delivery options</span>
                      <ChevronDown size={16} className={`text-muted transition-transform ${deliveryExpanded ? "rotate-180" : ""}`} />
                    </button>
                    {deliveryExpanded && (
                      <div className="mt-2 space-y-2 rounded-lg border border-primary/10 bg-white p-4 text-sm text-muted">
                        <p><strong className="text-primary">I&apos;ll be in</strong> - we&apos;ll knock and hand it straight to you.</p>
                        <p><strong className="text-primary">I&apos;m in but don&apos;t disturb</strong> - confirm that you will leave a box or large bag outside and we will deposit your produce (but please bring it inside pronto).</p>
                        <p><strong className="text-primary">I&apos;m out, I need a cool bag</strong> - pay a small deposit and we&apos;ll leave one of our crates &amp; cool boxes in your designated safe place.</p>
                        <p><strong className="text-primary">I&apos;m out, I&apos;ll leave my own cool bag</strong> - leave your own cool bag &amp; box out and we&apos;ll fill it, no deposit needed.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Meet Josie */}
              <div className="mt-6 flex items-center justify-center">
                <AboutJosie />
              </div>

              {/* Small print */}
              <div className="mt-6 rounded-xl bg-secondary/5 p-5 text-center">
                <p className="text-sm text-muted">
                  Where we can, every item is traceable to the farm, producer or maker.
                </p>
                <Link href="/map" className="mt-2 inline-block font-semibold text-secondary hover:underline" onClick={() => setIsOpen(false)}>
                  See the produce map →
                </Link>
              </div>

              {/* Feedback */}
              <p className="mt-4 text-center text-sm text-muted">
                We&apos;re brand new (spring 2026), still finding our feet. Got a thought, a gripe, or a producer we should add? Tap{" "}
                <button onClick={() => { setIsOpen(false); setTimeout(openCarrieFeedback, 200); }} className="font-semibold text-secondary hover:underline">
                  Carrie the carrot 🥕
                </button>{" "}
                anytime.
              </p>

              {/* Action buttons */}
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Link
                  href="/map"
                  onClick={() => setIsOpen(false)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-secondary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-secondary/90"
                >
                  <MapPinned size={16} />
                  Check if we deliver to you
                </Link>
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg border border-primary/20 bg-white px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/5"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
