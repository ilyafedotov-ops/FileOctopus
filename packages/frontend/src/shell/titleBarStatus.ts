import {
  profileIdFromRemoteUri,
  type GitRepoInfoDto,
  type NetworkConnectionStatusDto,
} from "@fileoctopus/ts-api";

export type TitleBarStatusTone = "neutral" | "ok" | "warning" | "danger";

export interface TitleBarStatusItem {
  key: string;
  label: string;
  title: string;
  tone: TitleBarStatusTone;
}

interface BuildTitleBarStatusOptions {
  activeUri: string;
  gitRepo: GitRepoInfoDto | null;
  networkStatuses: NetworkConnectionStatusDto[];
  operationError: string | null;
}

export function buildTitleBarStatus({
  activeUri,
  gitRepo,
  networkStatuses,
  operationError,
}: BuildTitleBarStatusOptions): TitleBarStatusItem[] {
  const items: TitleBarStatusItem[] = [];

  if (gitRepo) {
    const ref = gitRepo.branch ?? gitRepo.headShort ?? "detached";
    items.push({
      key: "git",
      label: `Git: ${ref}`,
      title: `Git branch ${ref}${gitRepo.isDirty ? " with changes" : ""}`,
      tone: gitRepo.isDirty ? "warning" : "neutral",
    });
  }

  const profileId = profileIdFromRemoteUri(activeUri);
  if (profileId) {
    const status = networkStatuses.find((item) => item.profileId === profileId);
    const label = status?.status ?? "disconnected";
    items.push({
      key: "remote",
      label: `Remote: ${label}`,
      title: `Remote profile ${profileId} is ${label}${status?.message ? `: ${status.message}` : ""}`,
      tone:
        status?.status === "connected"
          ? "ok"
          : status?.status === "error"
            ? "danger"
            : "neutral",
    });
  }

  if (operationError) {
    items.push({
      key: "health",
      label: "Attention",
      title: "Last operation reported a problem",
      tone: "danger",
    });
  }

  return items;
}
