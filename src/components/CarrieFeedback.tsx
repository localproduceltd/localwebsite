"use client";

import { useState, useRef, useEffect } from "react";
import { X, Send, MessageCircleHeart } from "lucide-react";
import { submitFeedback } from "@/lib/data";

export default function CarrieFeedback() {
  const [showTooltip, setShowTooltip] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [name, setName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (formRef.current && !formRef.current.contains(e.target as Node)) {
        setShowForm(false);
      }
    }
    if (showForm) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showForm]);

  const handleSubmit = async () => {
    if (!feedback.trim()) return;
    try {
      await submitFeedback(name, feedback);
    } catch (e) {
      console.error("Failed to save feedback:", e);
    }
    setSubmitted(true);
    setTimeout(() => {
      setShowForm(false);
      setSubmitted(false);
      setFeedback("");
      setName("");
    }, 2500);
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => !showForm && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <button
        onClick={() => { setShowTooltip(false); setShowForm(true); }}
        className="block"
        aria-label="Leave feedback"
      >
        <img src="/logo-carrot.png" alt="Carrie the Carrot" className="h-14 w-14 object-contain transition hover:scale-110" />
      </button>

      {/* Tooltip on hover */}
      {showTooltip && (
        <div className="absolute left-0 top-full z-50 mt-2 hidden w-56 rounded-lg border border-primary/10 bg-surface px-4 py-2.5 text-sm font-medium shadow-lg sm:block">
          <div className="absolute -top-1.5 left-6 h-3 w-3 rotate-45 border-l border-t border-primary/10 bg-surface" />
          <span className="flex items-center gap-1.5 text-primary">
            <MessageCircleHeart size={14} className="flex-shrink-0 text-secondary" />
            Hi! I&apos;m Carrie 🥕 Click me to leave feedback and ideas!
          </span>
        </div>
      )}

      {/* Feedback form popup */}
      {showForm && (
        <div ref={formRef} className="fixed inset-x-4 top-20 z-50 mx-auto max-w-sm rounded-xl border border-primary/10 bg-surface p-5 shadow-xl text-primary sm:absolute sm:inset-auto sm:left-0 sm:top-full sm:mt-3 sm:mx-0 sm:w-80">
          {submitted ? (
            <div className="py-6 text-center">
              <p className="text-3xl">🥕💜</p>
              <p className="mt-2 text-lg font-bold text-primary">Thank you!</p>
              <p className="mt-1 text-sm text-muted">Carrie has passed your feedback to Josie</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img src="/logo-carrot.png" alt="" className="h-8 w-8" />
                  <div>
                    <p className="text-sm font-bold text-primary">Carrie says hi!</p>
                    <p className="text-xs text-muted">We&apos;re new — your ideas help us grow</p>
                  </div>
                </div>
                <button onClick={() => setShowForm(false)} className="rounded p-1 text-muted hover:text-primary">
                  <X size={16} />
                </button>
              </div>
              <input
                placeholder="Your name (optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-4 w-full rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm outline-none focus:border-secondary"
              />
              <textarea
                placeholder="Request a local supplier or product, suggest a feature, or tell us how we're doing!"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={3}
                className="mt-2 w-full rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm outline-none focus:border-secondary resize-none"
              />
              <button
                onClick={handleSubmit}
                disabled={!feedback.trim()}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={14} /> Send Feedback
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
