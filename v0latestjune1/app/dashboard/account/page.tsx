import { redirect } from "next/navigation"

export default function AccountRedirect() {
  redirect("/dashboard/accounts")
}
