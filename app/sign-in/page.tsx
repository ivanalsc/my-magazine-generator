import { redirect } from "next/navigation";
import { accountSession } from "@/lib/supabase/server";
import { SignInExperience } from "@/components/account/SignInExperience";
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  if (error !== "callback") {
    const session = await accountSession().catch(() => null);
    if (session) redirect("/account");
  }
  return <SignInExperience callbackError={error === "callback"} />;
}
