import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { eoAddContact } from "@/lib/emailoctopus";

// Homepage email-capture box. Saves the address to Supabase (as before) and
// adds it to the Email Octopus list tagged "prospect", which starts the
// welcome-email automation.
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    const cleaned = typeof email === "string" ? email.toLowerCase().trim() : "";
    if (!cleaned || !cleaned.includes("@")) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const { error } = await supabase
      .from("email_signups")
      .insert({ email: cleaned });
    if (error && error.code !== "23505") {
      // 23505 = duplicate - fine, they had already signed up
      throw error;
    }

    // Push to Email Octopus (fail-soft: logs on error, never throws)
    await eoAddContact({ email: cleaned, tags: ["prospect"] });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Email signup error:", error);
    return NextResponse.json({ error: "Failed to sign up" }, { status: 500 });
  }
}
