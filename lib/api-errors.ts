import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function handleApiError(error: unknown): NextResponse {
  console.error("API Error:", error);

  // Handle known ApiError
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
      },
      { status: error.statusCode }
    );
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: error.issues,
      },
      { status: 400 }
    );
  }

  // Handle Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Unique constraint violation
    if (error.code === "P2002") {
      return NextResponse.json(
        {
          error: "A record with this value already exists",
          code: "DUPLICATE_RECORD",
          field: error.meta?.target,
        },
        { status: 409 }
      );
    }

    // Record not found
    if (error.code === "P2025") {
      return NextResponse.json(
        {
          error: "Record not found",
          code: "NOT_FOUND",
        },
        { status: 404 }
      );
    }

    // Foreign key constraint violation
    if (error.code === "P2003") {
      return NextResponse.json(
        {
          error: "Related record not found",
          code: "FOREIGN_KEY_VIOLATION",
        },
        { status: 400 }
      );
    }
  }

  // Handle Prisma connection errors
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return NextResponse.json(
      {
        error: "Database connection failed",
        code: "DATABASE_CONNECTION_ERROR",
      },
      { status: 503 }
    );
  }

  // Handle generic errors
  if (error instanceof Error) {
    return NextResponse.json(
      {
        error: error.message,
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }

  // Fallback for unknown errors
  return NextResponse.json(
    {
      error: "An unexpected error occurred",
      code: "UNKNOWN_ERROR",
    },
    { status: 500 }
  );
}

// Wrapper function to handle errors in API routes
export function withErrorHandling<T extends unknown[]>(
  handler: (...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleApiError(error);
    }
  };
}

// Common error factories
export const errors = {
  unauthorized: (message = "Unauthorized") =>
    new ApiError(401, message, "UNAUTHORIZED"),
  forbidden: (message = "Forbidden") => new ApiError(403, message, "FORBIDDEN"),
  notFound: (message = "Not found") => new ApiError(404, message, "NOT_FOUND"),
  badRequest: (message: string) => new ApiError(400, message, "BAD_REQUEST"),
  conflict: (message: string) => new ApiError(409, message, "CONFLICT"),
  internal: (message = "Internal server error") =>
    new ApiError(500, message, "INTERNAL_ERROR"),
  serviceUnavailable: (message = "Service unavailable") =>
    new ApiError(503, message, "SERVICE_UNAVAILABLE"),
};
