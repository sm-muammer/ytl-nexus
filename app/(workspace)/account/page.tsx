import { redirect } from "next/navigation";
import { AccountView } from "@/components/auth/account-view";
import { Backdrop } from "@/components/backdrop/backdrop";
import { pageMetadata } from "@/components/layout/module-page";
import { readOwnAccountSnapshot } from "@/lib/server/account";
import { requirePage } from "@/lib/server/guards";

export const metadata = pageMetadata("/account");

export default async function AccountPage() {
  const { identity } = await requirePage("/account");
  if (identity.kind !== "user") {
    redirect("/signin?next=%2Faccount");
  }
  const snapshot = await readOwnAccountSnapshot(identity);

  return (
    <>
      <Backdrop path="/account" />
      <AccountView snapshot={snapshot} />
    </>
  );
}
