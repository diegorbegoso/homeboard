import { CaretRight } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MicroAppTile } from "@/components/micro-app-tile";
import { getActiveHousehold } from "@/lib/household";
import { createClient } from "@/lib/supabase/server";
import { enabledMicroApps } from "@/micro-apps/registry";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle()
    : { data: null };

  const { active, all } = user ? await getActiveHousehold(supabase, user.id) : { active: null, all: [] };
  if (user && !active) redirect("/bienvenida");
  const apps = enabledMicroApps();

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-8">
      <div>
        <h1>Hola, {profile?.display_name}</h1>
        {active && (
          <Link
            href="/hogares"
            aria-label={`Hogar ${active.name}. ${all.length > 1 ? "Cambiar de hogar" : "Mis hogares"}`}
            className="mt-1 inline-flex min-h-11 items-center gap-1 text-muted-foreground"
          >
            <span data-testid="hogar-activo">{active.name}</span>
            <span className="text-sm font-medium text-primary">{all.length > 1 ? "· Cambiar" : "· Mis hogares"}</span>
            <CaretRight size={16} aria-hidden="true" className="text-primary" />
          </Link>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4">
        {apps.map((app) => (
          <MicroAppTile key={app.id} app={app} />
        ))}
      </div>
    </main>
  );
}
