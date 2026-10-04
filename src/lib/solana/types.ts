/** Shared Solana DTOs. bigint values travel over HTTP as decimal strings. */
import type { Address } from "@solana/kit";

export type AsyncStatus = "idle" | "loading" | "ready" | "error";

export interface AsyncState<T> {
  status: AsyncStatus;
  data: T | null;
  error: string | null;
  refresh: () => void;
}

export interface SkrBalance {
  owner: Address;
  mint: Address;
  ata: Address;
  amount: bigint;
  decimals: number;
  exists: boolean;
}

export interface SeekerStatus {
  owner: Address;
  isSeeker: boolean;
  sgtMint: Address | null;
  sgtTokenAccount: Address | null;
  checkedAt: number;
}

export interface SeekerStatusResponse {
  owner: string;
  isSeeker: boolean;
  sgtMint: string | null;
  sgtTokenAccount: string | null;
  checkedAt: number;
}

export type ApiErrorCode =
  | "bad_request"
  | "forbidden_method"
  | "forbidden_origin"
  | "payload_too_large"
  | "rate_limited"
  | "upstream_unavailable"
  | "not_configured"
  | "not_found"
  | "unauthorized"
  | "conflict";

export interface ApiError {
  error: string;
  code: ApiErrorCode;
  retryAfterSec?: number;
}
