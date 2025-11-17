"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmail, signUpWithEmail } from "@/lib/auth-client";

type Mode = "signIn" | "signUp";

export function LoginForm() {
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const action =
      mode === "signIn"
        ? signInWithEmail({ email, password })
        : signUpWithEmail({ name: name || email.split("@")[0], email, password });

    const result = await action;

    if (result.error) {
      setError(result.error);
      setIsSubmitting(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-lg">
      <div className="mb-6 flex gap-2 rounded-full bg-zinc-100 p-1">
        <button
          type="button"
          onClick={() => setMode("signIn")}
          className={`flex-1 rounded-full py-2 text-sm font-medium transition ${
            mode === "signIn" ? "bg-white shadow" : "text-zinc-500"
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => setMode("signUp")}
          className={`flex-1 rounded-full py-2 text-sm font-medium transition ${
            mode === "signUp" ? "bg-white shadow" : "text-zinc-500"
          }`}
        >
          Create Account
        </button>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        {mode === "signUp" && (
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Name
            </label>
            <input
              type="text"
              className="w-full rounded-xl border border-zinc-200 px-4 py-2 focus:border-black focus:outline-none"
              placeholder="Chef Name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">
            Email
          </label>
          <input
            type="email"
            className="w-full rounded-xl border border-zinc-200 px-4 py-2 focus:border-black focus:outline-none"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">
            Password
          </label>
          <input
            type="password"
            className="w-full rounded-xl border border-zinc-200 px-4 py-2 focus:border-black focus:outline-none"
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
          />
        </div>

        {error && (
          <p className="text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-full bg-black py-2 text-white transition hover:bg-zinc-800 disabled:opacity-50"
        >
          {isSubmitting
            ? "Please wait..."
            : mode === "signIn"
              ? "Sign in"
              : "Create account"}
        </button>
      </form>
    </div>
  );
}

