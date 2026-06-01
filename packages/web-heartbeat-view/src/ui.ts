import { twMerge } from "tailwind-merge";
import { clsx, type ClassValue } from "clsx";

export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));

export const stringifyStructuredValue = (value: unknown): string => JSON.stringify(value, null, 2) ?? "null";
