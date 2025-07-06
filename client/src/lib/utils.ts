import { SerializedError } from "@reduxjs/toolkit";
import { FetchBaseQueryError } from "@reduxjs/toolkit/query/react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function cleanObject<T extends Record<string, any>>(obj: T): Partial<T> {
  const cleaned: Partial<T> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const nested = cleanObject(value);
      if (Object.keys(nested).length > 0) {
        cleaned[key as keyof T] = nested as T[keyof T];
      }
    } else if (value !== "") {
      cleaned[key as keyof T] = value;
    }
  }

  return cleaned;
}

export const formatMultiField = (field?: { VALUE: string }[]) =>
  field?.[0]?.VALUE || "N/A";

export const formatAddress = (
  city?: string,
  region?: string,
  province?: string
): string => {
  const parts = [city, region, province].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "N/A";
};

export const extractErrorMessage = (error: unknown): string => {
  if (!error) return "An unknown error occurred";

  if (typeof error === "object" && error !== null) {
    if ("status" in error) {
      const fetchError = error as FetchBaseQueryError;
      const data = fetchError.data;

      if (typeof data === "string") return data;
      if (typeof data === "object" && data !== null && "message" in data)
        return (data as any).message ?? "An unknown error occurred";
    }

    if ("message" in error) {
      return (error as SerializedError).message ?? "An unknown error occurred";
    }
  }

  return "An unknown error occurred";
};
