import { MicroAppTile } from "@/components/micro-app-tile";
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

  const { data: membership } = user
    ? await supabase.from("household_members").select("households(name)").eq("user_id", user.id).maybeSingle()
    : { data: null };

  const householdName = (membership?.households as { name: string } | null)?.name;
  const apps = enabledMicroApps();

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-8">
      <div>
        <h1>Hola, {profile?.display_name}</h1>
        {householdName && <p className="text-muted-foreground">{householdName}</p>}
      </div>
      <div className="grid grid-cols-1 gap-4">
        {apps.map((app) => (
          <MicroAppTile key={app.id} app={app} />
        ))}
      </div>
    </main>
  );
}
