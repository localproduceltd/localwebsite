"use client";

// Custom avatar component to replace Clerk's <UserButton />.
// Clerk v6 doesn't expose easy theming for the default avatar fallback color,
// so we built this to show themed initials in our brand colors.
// If Clerk improves their appearance API in future, this could be swapped
// back to <UserButton /> from @clerk/nextjs.

import { useUser, useClerk } from "@clerk/nextjs";
import { useState, useRef, useEffect } from "react";

export default function UserAvatar({ size = "h-9 w-9", bg = "bg-secondary" }: { size?: string; bg?: string }) {
  const { user } = useUser();
  const { signOut, openUserProfile } = useClerk();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const initials = user
    ? `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() || user.primaryEmailAddress?.emailAddress?.[0]?.toUpperCase() || "?"
    : "?";

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`${size} ${bg} flex items-center justify-center rounded-full text-sm font-bold text-white transition hover:opacity-90 overflow-hidden`}
      >
        {user?.hasImage ? (
          <img src={user.imageUrl} alt={initials} className="h-full w-full object-cover" />
        ) : (
          initials
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-44 rounded-xl bg-surface shadow-lg border border-primary/10 overflow-hidden z-50">
          <button
            onClick={() => { openUserProfile(); setOpen(false); }}
            className="w-full px-4 py-2.5 text-left text-sm font-medium text-primary hover:bg-background transition"
          >
            Manage Account
          </button>
          <button
            onClick={() => signOut({ redirectUrl: "/" })}
            className="w-full px-4 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-background transition"
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
