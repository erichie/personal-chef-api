import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/server-session";
import { ProfileMenu } from "@/components/profile-menu";

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  const displayName = session.user.displayName || session.user.email || "Chef";

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-r from-orange-500 to-pink-500 transition hover:opacity-80"
              aria-label="Home"
            >
              <span className="text-lg font-bold text-white">PC</span>
            </Link>
            <nav className="flex items-center gap-1">
              <Link
                href="/recipes"
                className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
              >
                Recipes
              </Link>
              <Link
                href="/cookbook"
                className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
              >
                Cookbook
              </Link>
              <Link
                href="/recipes/new"
                className="rounded-lg bg-pink-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-pink-500"
              >
                + Create
              </Link>
            </nav>
          </div>
          <ProfileMenu displayName={displayName} />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}

