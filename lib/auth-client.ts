"use client";

import { createAuthClient } from "better-auth/react";

const base =
  process.env.NEXT_PUBLIC_BETTER_AUTH_URL?.replace(/\/$/, "") || "/api/auth";

export const authClient = createAuthClient({
  baseURL: base,
});

export const useSession = authClient.useSession;

async function postAuthRoute<T>(
  path: string,
  body: Record<string, unknown>
): Promise<{ data: T | null; error: string | null }> {
  const url = `${base}${path}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let message = "Request failed";
    try {
      const payload = await response.json();
      message = payload?.message || payload?.error || message;
    } catch {
      // ignore
    }

    return { data: null, error: message };
  }

  try {
    const payload = (await response.json()) as T;
    return { data: payload, error: null };
  } catch {
    return { data: null, error: "Failed to parse response" };
  }
}

export function signInWithEmail(input: {
  email: string;
  password: string;
  rememberMe?: boolean;
}) {
  return postAuthRoute("/sign-in/email", {
    email: input.email,
    password: input.password,
    rememberMe: input.rememberMe ?? true,
  });
}

export function signUpWithEmail(input: {
  name: string;
  email: string;
  password: string;
}) {
  return postAuthRoute("/sign-up/email", {
    name: input.name,
    email: input.email,
    password: input.password,
  });
}

export async function signOut() {
  return postAuthRoute("/sign-out", {});
}

