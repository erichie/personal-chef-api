"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";

export function SignOutButton() {
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  async function handleSignOut() {
    setIsPending(true);
    await signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={isPending}
      className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-60"
    >
      {isPending ? "Signing out..." : "Sign out"}
    </button>
  );
}

