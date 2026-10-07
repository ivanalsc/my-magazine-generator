import { ArchivedIssue } from "@/components/archive/ArchivedIssue";
export default async function IssuePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ArchivedIssue id={id} />;
}
