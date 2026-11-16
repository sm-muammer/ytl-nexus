import { pageMetadata } from "@/components/layout/module-page";
import { ShieldView } from "@/components/shield/shield-view";
import { requirePage } from "@/lib/server/guards";
import { getMode } from "@/lib/server/mode";
import { getShieldView } from "@/lib/server/shield";

export const metadata = pageMetadata("/shield");

export default async function ShieldPage() {
  await requirePage("/shield");
  const shield = await getShieldView();
  const mode = getMode();

  return <ShieldView shield={shield} mode={mode} />;
}
