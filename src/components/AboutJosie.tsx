"use client";

import { useState } from "react";
import { X } from "lucide-react";

export default function AboutJosie() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Clickable photo with hint */}
      <button
        onClick={() => setOpen(true)}
        className="group flex flex-col items-center text-center focus:outline-none"
      >
        <div className="relative h-12 w-12 overflow-hidden rounded-full ring-2 ring-secondary transition group-hover:ring-accent group-hover:scale-110">
          <img src="/images/Josie.png" alt="Josie" className="h-full w-full object-cover" />
        </div>
        <h3 className="mt-3 font-semibold text-primary">Managed Locally</h3>
        <p className="mt-1 text-sm text-muted">Run by Josie<br />I work directly with every supplier</p>
        <span className="mt-1 text-xs font-medium text-secondary">
          Tap to learn more
        </span>
      </button>

      {/* Modal backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-6 sm:p-10"
          onClick={() => setOpen(false)}
        >
          {/* Modal content */}
          <div
            className="relative w-full max-w-sm sm:max-w-md overflow-hidden rounded-2xl bg-surface shadow-xl animate-in fade-in zoom-in-95 duration-200 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 z-10 rounded-full bg-[#f7f5ef]/80 p-2 text-muted transition hover:bg-[#f7f5ef] hover:text-primary"
            >
              <X size={18} />
            </button>

            {/* Photo */}
            <div className="aspect-[3/1] sm:aspect-[2/1] overflow-hidden">
              <img
                src="/images/Josie.png"
                alt="Josie — founder of Local Produce"
                className="h-full w-full object-cover"
              />
            </div>

            {/* Content */}
            <div className="p-6 sm:p-8">
              <h2 className="text-2xl font-bold text-primary">Meet Josie</h2>
              <p className="mt-1 text-sm font-medium text-secondary">Founder, Local Produce</p>

              <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
                <p>
                  Local Produce started in Hulland, Ashbourne with one simple idea: <strong className="text-primary">make supporting local easier.</strong>
                </p>
                <p>
                  I&apos;ve always shopped at local farms, bakeries and independent suppliers — but it takes effort to visit them all. So when I kept hearing &ldquo;we&apos;d love to shop local, it&apos;s just inconvenient,&rdquo; I decided to change that.
                </p>
                <p>
                  After speaking with local producers who were equally keen to collaborate, we launched in March 2026 — bringing together Derbyshire&apos;s best food and drink in one simple online marketplace, delivered weekly to your door.
                </p>
                <p className="font-semibold text-primary">
                  Supporting local shouldn&apos;t be complicated.
                </p>
              </div>

              <div className="mt-6 flex items-center gap-3 border-t border-primary/5 pt-4">
                <div className="h-10 w-10 overflow-hidden rounded-full ring-2 ring-secondary">
                  <img src="/images/Josie.png" alt="Josie" className="h-full w-full object-cover" />
                </div>
                <div>
                  <p className="text-sm font-bold text-primary">Josie</p>
                  <p className="text-xs text-muted">josie@localproduce.ltd</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
