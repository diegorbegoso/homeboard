import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

export default function HomePage() {
  return (
    <section>
      <h1>{SITE_NAME}</h1>
      <p>{SITE_DESCRIPTION}</p>
    </section>
  );
}
