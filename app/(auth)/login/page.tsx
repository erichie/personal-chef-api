import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/server-session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in | Personal Chef",
};

export default async function LoginPage() {
  const session = await getServerSession();
  if (session) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-5xl rounded-3xl bg-white p-10 shadow-2xl">
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="space-y-6">
            <p className="inline-flex rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-600">
              Personal Chef
            </p>
            <h1 className="text-4xl font-semibold text-zinc-900">
              Welcome back! Sign in to sync your BetterAuth account between
              mobile and the web.
            </h1>
            <p className="text-lg text-zinc-600">
              Your saved recipes, pantry, and friends will be right where you
              left them. Create and publish new recipes to share with the
              community directly from the browser.
            </p>
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}

