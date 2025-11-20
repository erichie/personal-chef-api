"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";
import type { BasicPost } from "@/lib/types";
import { uploadImageToBlob } from "@/components/shared/blob-uploader";

interface PostComposerProps {
  onPostCreated?: (post: BasicPost) => void;
}

export function PostComposer({ onPostCreated }: PostComposerProps) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);

    return () => {
      URL.revokeObjectURL(localUrl);
    };
  }, [file]);

  const canSubmit = useMemo(() => {
    return !submitting && (text.trim().length > 0 || !!file);
  }, [file, submitting, text]);

  const resetForm = useCallback(() => {
    setText("");
    setFile(null);
    setPreviewUrl(null);
    setError(null);
  }, []);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    setFile(nextFile);
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      let photoUrl: string | undefined;

      if (file) {
        photoUrl = await uploadImageToBlob(file);
      }

      const payload = {
        text: text.trim() || undefined,
        photoUrl,
      };

      const response = await fetch("/api/feed", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const problem = await response.json().catch(() => ({}));
        throw new Error(problem.error || "Failed to share post");
      }

      const data = (await response.json()) as { post: BasicPost };
      onPostCreated?.(data.post);
      resetForm();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Failed to share post"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Share what you're cooking..."
        className="w-full resize-none rounded-xl border border-transparent bg-zinc-100 p-3 text-sm text-zinc-900 outline-none focus:border-pink-500 focus:bg-white focus:ring-2 focus:ring-pink-100"
        rows={3}
      />

      {previewUrl && (
        <div className="relative overflow-hidden rounded-xl border border-zinc-200">
          <Image
            src={previewUrl}
            alt="Post preview"
            width={800}
            height={600}
            className="h-48 w-full object-cover"
            unoptimized
          />
          <button
            type="button"
            onClick={() => setFile(null)}
            className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-1 text-xs text-white"
          >
            Remove
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-zinc-200 px-3 py-1 text-sm font-medium text-zinc-700 hover:border-pink-400 hover:text-pink-600">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <span>Upload photo</span>
        </label>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="rounded-full bg-pink-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-pink-300"
        >
          {submitting ? "Posting..." : "Share"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

