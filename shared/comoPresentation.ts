/** Presentation contracts only; authorization and mailbox evidence remain server-owned. */
export const dashboardDestinations = [
  { label: "المطبخ التنفيذي", path: "/como-next" },
  { label: "إدارة المشروعات", path: "/project-management" },
] as const;

export function sentEmailDestination(search: string): string {
  const params = new URLSearchParams(search);
  const destination = new URLSearchParams({ section: "email", mailFilter: "sent" });
  const projectId = Number(params.get("projectId"));
  if (Number.isSafeInteger(projectId) && projectId > 0) destination.set("projectId", String(projectId));
  return `/como-next?${destination.toString()}`;
}

export type CommunicationPresentation = {
  communicationStatus?: string | null;
  channel?: string | null;
  direction?: string | null;
  /** Supplied only after the server verifies a unique canonical ledger association. */
  mailboxDraftState?: string | null;
};

export function isSavedUnsentCommunication(item: CommunicationPresentation): boolean {
  return item.communicationStatus === "archived" && item.channel === "email" &&
    item.direction === "outbound" && item.mailboxDraftState === "draft_saved";
}

export function isPendingCommunication(item: CommunicationPresentation): boolean {
  return item.communicationStatus === "draft" || item.communicationStatus === "approved_for_send" ||
    isSavedUnsentCommunication(item);
}

export function communicationPresentationLabel(item: CommunicationPresentation): string | null {
  return isSavedUnsentCommunication(item) ? "محفوظة في Drafts — لم تُرسل" : null;
}

export function filterKitchenProjectRecords<T extends { projectId?: unknown }>(items: readonly T[], projectId: number | null): T[] {
  if (projectId === null) return [...items];
  if (!Number.isSafeInteger(projectId) || projectId <= 0) return [];
  return items.filter(item => Number(item.projectId) === projectId);
}

export type ComoInboxFilter = "attention" | "sent" | "linked" | "dismissed";
export function comoInboxFilter(value:unknown):ComoInboxFilter {
 return value === "sent" || value === "linked" || value === "dismissed" ? value : "attention";
}
export function matchesComoInboxFilter(item:{folderName?:string|null;inboxStatus?:string|null},filter:ComoInboxFilter) {
 if(filter === "attention") return item.folderName === "INBOX" && (item.inboxStatus === "unmatched" || item.inboxStatus === "suggested");
 if(filter === "sent") return item.folderName === "Sent" && item.inboxStatus !== "dismissed";
 return item.inboxStatus === filter;
}
