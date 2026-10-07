import { Onboarding } from "@/components/onboarding/Onboarding";
export const metadata = { title: "Make your magazine — My Magazine Generator" };
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; edit?: string }>;
}) {
  const params = await searchParams;
  return (
    <Onboarding
      initialStep={params.step === "sources" ? 2 : 1}
      editing={params.edit === "1"}
    />
  );
}
