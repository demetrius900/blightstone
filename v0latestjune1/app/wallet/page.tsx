import { redirect } from "next/navigation"

export default function WalletPageRedirect() {
  redirect("/dashboard/wallet")
}
