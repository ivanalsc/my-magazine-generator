import { repositoryRequest } from "./http";
import type { IssueEnvelope, IssueSummary } from "./models";
export const issuesRepository = {
  list: () => repositoryRequest<IssueSummary[]>("/api/issues"),
  get: (id: string) =>
    repositoryRequest<IssueEnvelope>(`/api/issues/${encodeURIComponent(id)}`),
};
