"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Mail, CheckCircle2, Calendar } from "lucide-react";
import AboutJosie from "@/components/AboutJosie";

export default function HoldingPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { error: dbError } = await supabase
        .from("email_signups")
        .insert([{ email, created_at: new Date().toISOString() }]);

      if (dbError) throw dbError;
      
      setSubmitted(true);
      setEmail("");
    } catch (err) {
      setError("Something went wrong. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden px-4 py-24 text-center text-white sm:py-32">
        <img 
          src="/Header Image.jpg" 
          alt="" 
          className="absolute inset-0 h-full w-full object-cover brightness-50" 
        />
        <div className="relative mx-auto max-w-5xl">
          <div className="flex justify-center mb-8">
            <h1 className="text-5xl font-extrabold tracking-tight text-surface drop-shadow-sm sm:text-7xl lg:text-8xl">
              Derbyshire's Produce: <span className="font-extrabold uppercase tracking-wider text-surface">Delivered</span>
            </h1>
          </div>
          
          <div className="mt-12 inline-flex items-center gap-3 rounded-full bg-primary px-6 py-3 text-xl font-bold text-white shadow-lg sm:text-2xl">
            <Calendar size={28} />
            <span>Orders Open: 1st May 2026</span>
          </div>

          <p className="mt-8 text-xl text-surface/90 sm:text-2xl font-medium">
            Ashbourne &amp; Belper's best farmers, producers and independents.<br />
            Quality local food, delivered directly to your door!
          </p>
        </div>
      </section>

      {/* Email Signup Section */}
      <section className="px-4 py-16 bg-white">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-primary sm:text-4xl">
            Be First to Know
          </h2>
          <p className="mt-4 text-lg text-muted">
            Enter your email address below to receive exclusive launch offers for our first few customers only.
          </p>

          {!submitted ? (
            <form onSubmit={handleSubmit} className="mt-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                <div className="flex-1">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    required
                    className="w-full rounded-lg border border-primary/20 bg-surface px-4 py-3 text-base outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-secondary px-6 py-3 font-semibold text-white transition hover:bg-secondary/90 disabled:opacity-50"
                >
                  <Mail size={20} />
                  {loading ? "Signing up..." : "Join the List"}
                </button>
              </div>
              {error && (
                <p className="mt-3 text-sm text-red-600">{error}</p>
              )}
            </form>
          ) : (
            <div className="mt-8 rounded-xl bg-green-50 border-2 border-green-200 px-6 py-8">
              <div className="flex items-center justify-center gap-3 text-green-800">
                <CheckCircle2 size={32} />
                <div className="text-left">
                  <p className="text-xl font-bold">You're on the list!</p>
                  <p className="mt-1 text-sm text-green-700">
                    We'll send you exclusive offers and launch updates soon.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Value Props */}
      <section className="border-t border-primary/5 bg-white px-4 py-12">
        <p className="mx-auto mb-10 max-w-7xl text-center text-xl font-semibold text-primary sm:text-2xl">
          Ashbourne &amp; Belper&apos;s best farmers, producers and independents.<br />Quality local food, delivered directly to your door!
        </p>
        <div className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-3">
          <div className="flex flex-col items-center text-center">
            <div className="h-12 w-12 overflow-hidden rounded-full">
              <img src="/images/Pin.png" alt="Pin" className="h-full w-full object-cover" />
            </div>
            <h3 className="mt-3 font-semibold text-secondary">Know The Origin</h3>
            <p className="mt-1 text-sm text-muted">Every item traceable to the farm, producer or maker</p>
          </div>
          <AboutJosie />
          <div className="flex flex-col items-center text-center">
            <div className="h-12 w-12 overflow-hidden rounded-full">
              <img src="/images/clock.png" alt="Delivered Fresh" className="h-full w-full object-cover" />
            </div>
            <h3 className="mt-3 font-semibold text-secondary">Delivered Fresh</h3>
            <p className="mt-1 text-sm text-muted">Weekly delivery straight to your door</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-primary/10 bg-white px-4 py-8">
        <div className="mx-auto max-w-7xl text-center">
          <p className="text-sm text-muted">
            Questions? Email us at{" "}
            <a href="mailto:josie@localproduce.ltd" className="font-medium text-secondary hover:underline">
              josie@localproduce.ltd
            </a>
          </p>
          <p className="mt-2 text-xs text-muted">
            © 2026 Local Produce Ltd. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
