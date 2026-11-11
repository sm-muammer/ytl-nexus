import { pageMetadata } from "@/components/layout/module-page";
import { TransferView } from "@/components/transfer/transfer-view";
import { requirePage } from "@/lib/server/guards";
import { getMode } from "@/lib/server/mode";
import { readOwnAccount } from "@/lib/server/transfer";

// The signed-in Member's own file transfer account (TRF-09). The account is found
// from the session's user id; the page takes no account name or id from the
// request (requirements 12.17 and 12.18). The file portal itself is served at
// /files/ by SFTPGo behind Apache.
export const metadata = pageMetadata("/transfer");

export default async function TransferPage() {
  const { identity } = await requirePage("/transfer");
  const view =
    identity.kind === "user"
      ? await readOwnAccount(identity.userId)
      : ({
          state: "no-account",
          source: getMode() === "demo" ? "demo" : "live",
          host: "",
        } as const);
  return <TransferView view={view} demoSession={getMode() === "demo"} />;
}
