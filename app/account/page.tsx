import { redirect } from "next/navigation";
import { AccountExperience } from "@/components/account/AccountExperience";
import { accountSession } from "@/lib/supabase/server";
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  if (error === "callback") redirect("/sign-in?error=callback");
  let session;
  try {
    session = await accountSession();
  } catch {
    return <AccountExperience />;
  }
  if (!session) redirect("/sign-in");
  return <AccountExperience />;
}
