"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

interface ProfileMenuProps {
  displayName: string;
}

export function ProfileMenu({ displayName }: ProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  async function handleSignOut() {
    await signOut();
    router.push("/login");
    router.refresh();
  }

  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-pink-500 text-sm font-semibold text-white transition hover:opacity-80"
        aria-label="Profile menu"
      >
        {initials}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-xl border border-zinc-200 bg-white shadow-lg">
          <div className="border-b border-zinc-100 px-4 py-3">
            <p className="text-sm font-medium text-zinc-900">{displayName}</p>
          </div>
          <div className="py-1">
            <Link
              href="/cookbook"
              onClick={() => setIsOpen(false)}
              className="block px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50"
            >
              My Cookbook
            </Link>
            <button
              onClick={handleSignOut}
              className="block w-full px-4 py-2 text-left text-sm text-zinc-700 transition hover:bg-zinc-50"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

