import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    
    return NextResponse.json({
      email: user.primaryEmailAddress?.emailAddress || null,
      firstName: user.firstName,
      lastName: user.lastName,
    });
  } catch (error) {
    console.error("Failed to fetch Clerk user:", error);
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
}
