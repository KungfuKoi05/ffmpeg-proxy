import { NextResponse, type NextRequest } from "next/server";

/**
 * Protects /admin with HTTP Basic auth against a shared secret.
 *
 * Design choices worth stating:
 *  - FAILS CLOSED. If ADMIN_PASSWORD is unset the route returns 503, not a
 *    public dashboard. A missing config must never be the thing that exposes it.
 *  - Constant-time comparison, so the response time cannot be used to guess the
 *    secret one character at a time. `===` on a secret is a real (if slow) leak.
 *  - Basic auth is deliberate: there is no account system yet, and a hand-rolled
 *    cookie session would be more code and more ways to be wrong. Replace this
 *    when real accounts exist.
 */
function constantTimeEqual(a: string, b: string): boolean {
  // Compare a fixed number of bytes so length alone does not leak via timing.
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  const length = Math.max(ab.length, bb.length);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < length; i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

function unauthorized(): NextResponse {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Toolbench admin", charset="UTF-8"',
      "Cache-Control": "no-store",
    },
  });
}

export function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith("/admin")) return NextResponse.next();

  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return new NextResponse(
      "Admin is disabled: ADMIN_PASSWORD is not set on this deployment.",
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const header = req.headers.get("authorization") ?? "";
  const [scheme, encoded] = header.split(" ");
  if (scheme !== "Basic" || !encoded) return unauthorized();

  let decoded: string;
  try {
    decoded = atob(encoded);
  } catch {
    return unauthorized();
  }

  // Only the password is checked; any username is accepted.
  const password = decoded.slice(decoded.indexOf(":") + 1);
  if (!constantTimeEqual(password, expected)) return unauthorized();

  const res = NextResponse.next();
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = { matcher: ["/admin/:path*"] };
