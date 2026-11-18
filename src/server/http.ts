import "server-only";

import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, userFromToken, type User } from "./auth";
import { ApiError, badRequest } from "./errors";
import { sameOrigin } from "./origin";
import { ensureWorker } from "./worker";

/**
 * Every API route goes through `route()`. It reads the session, guards against
 * cross-site writes, and turns thrown `ApiError`s into one error shape:
 *
 *   { "error": { "code": "insufficient_credits", "message": "..." } }
 */

export { ApiError, badRequest, notFound } from "./errors";

export interface Ctx<P> {
  req: NextRequest;
  user: User | null;
  params: P;
}

export interface AuthedCtx<P> extends Ctx<P> {
  user: User;
}

type Result = Response | Record<string, unknown> | unknown[];

function respond(result: Result): Response {
  return result instanceof Response ? result : NextResponse.json(result);
}

function fail(err: unknown): Response {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.status });
  }
  console.error("[api] unexpected error:", err instanceof Error ? err.stack ?? err.message : err);
  return NextResponse.json({ error: { code: "server_error", message: "Something went wrong on our side." } }, { status: 500 });
}

type Jar = Awaited<ReturnType<typeof cookies>>;

async function open<P>(req: NextRequest, context: { params: Promise<P> }, jar: Jar): Promise<Ctx<P>> {
  if (req.method !== "GET" && req.method !== "HEAD" && !sameOrigin(req)) {
    throw new ApiError(403, "forbidden", "Cross-site request refused.");
  }
  ensureWorker();
  const token = jar.get(SESSION_COOKIE)?.value;
  return { req, user: token ? userFromToken(token) : null, params: await context.params };
}

/*
 * Both wrappers read cookies before their `try`. That read marks the route as
 * request-time, and during a build Next ends its prerender probe by rejecting it.
 * The rejection is Next's own signal, so it must pass through uncaught.
 */

/** A route that needs a signed-in member (guest accounts count). */
export function route<P = Record<string, never>>(handler: (ctx: AuthedCtx<P>) => Promise<Result> | Result) {
  return async (req: NextRequest, context: { params: Promise<P> }): Promise<Response> => {
    const jar = await cookies();
    try {
      const ctx = await open(req, context, jar);
      if (!ctx.user) throw new ApiError(401, "unauthorized", "Sign in to continue.");
      return respond(await handler(ctx as AuthedCtx<P>));
    } catch (err) {
      return fail(err);
    }
  };
}

/** A route that also works signed out. `ctx.user` may be null. */
export function publicRoute<P = Record<string, never>>(handler: (ctx: Ctx<P>) => Promise<Result> | Result) {
  return async (req: NextRequest, context: { params: Promise<P> }): Promise<Response> => {
    const jar = await cookies();
    try {
      return respond(await handler(await open(req, context, jar)));
    } catch (err) {
      return fail(err);
    }
  };
}

/** Parses a JSON body. Anything that is not a JSON object is a 400. */
export async function readJson(req: NextRequest, maxBytes = 256_000): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (text.length > maxBytes) throw new ApiError(413, "invalid_request", "Request body is too large.");
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {
    /* fall through */
  }
  throw badRequest("Send a JSON object.");
}

export function intParam(req: NextRequest, name: string, fallback: number, min: number, max: number): number {
  const raw = req.nextUrl.searchParams.get(name);
  const n = raw == null ? fallback : Math.floor(Number(raw));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/* A small in-memory limiter. Enough to blunt password guessing on one node. */
const buckets = ((globalThis as unknown as { __parallaxLimits?: Map<string, { n: number; reset: number }> }).__parallaxLimits ??= new Map());

export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    if (buckets.size > 5000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
    return;
  }
  if (++b.n > max) throw new ApiError(429, "rate_limited", "Too many attempts. Wait a few minutes and try again.");
}

/** How many reverse proxies sit in front of the app and append to X-Forwarded-For. 0 when unset or invalid. */
function trustedProxies(): number {
  const n = Number(process.env.PARALLAX_TRUSTED_PROXIES);
  return Number.isInteger(n) && n > 0 && n <= 5 ? n : 0;
}

/**
 * Who is calling, for rate limits and anonymous counters.
 *
 * X-Forwarded-For is written by the caller, so a client that reaches the app directly can
 * send a new value on every request and never hit a limit. The header is therefore ignored
 * unless the operator says how many trusted proxies are in front (PARALLAX_TRUSTED_PROXIES).
 * Each trusted proxy appends the address it saw, so the client is that many entries from the
 * right; anything further left was supplied by the client and is not read.
 *
 * Without the setting every caller shares the key "local": limits are then global, which is
 * strict but cannot be dodged.
 */
export function clientKey(req: NextRequest): string {
  const hops = trustedProxies();
  if (hops === 0) return "local";
  const chain = (req.headers.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return chain[chain.length - hops] ?? "local";
}
