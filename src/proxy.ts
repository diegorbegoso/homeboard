import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";
import { getPublicEnv } from "@/lib/env";

const PUBLIC_PATHS = ["/entrar", "/registro", "/auth/callback", "/offline"];
const AUTH_PAGES = ["/entrar", "/registro"];
const ONBOARDING = "/bienvenida";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = getPublicEnv();
  const supabase = createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const redirectTo = (pathname: string, search = "") => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = search;
    const redirect = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    return redirect;
  };

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  let userId: string | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    userId = null; // Supabase unreachable: treat as signed out rather than 500
  }

  if (!userId) {
    if (isPublic) {
      return response;
    }
    return redirectTo("/entrar", path === "/" ? "" : `?next=${encodeURIComponent(path)}`);
  }

  if (AUTH_PAGES.includes(path)) {
    return redirectTo("/");
  }
  if (isPublic) {
    return response;
  }

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!membership && path !== ONBOARDING) {
    return redirectTo(ONBOARDING);
  }
  if (membership && path === ONBOARDING) {
    return redirectTo("/");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|api/health).*)"],
};
