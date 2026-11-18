import { sql } from "drizzle-orm";
import type { getDb } from "../db";

type Communication = {id:number;userId?:number;projectId:number;workFileId:number;channel:string;direction?:string;communicationStatus:string;sentAt?:unknown};
type Ledger = {id:number;userId:number|null;projectId:number|null;workFileId:number|null;communicationId:number|null;state:string;draftFolder:string|null;draftUid:number|null;sentFolder:string|null;sentUid:number|null};
type Sent = {communicationId:number|null;userId:number;linkedProjectId:number|null;linkedWorkFileId:number|null;folderName:string};
export function verifiedSavedDraftState(item:Communication,ledgers:readonly Ledger[],sentMessages:readonly Sent[]):"draft_saved"|null {
 if(item.communicationStatus!=="archived"||item.channel!=="email"||item.direction!=="outbound"||item.sentAt) return null;
 const matches=ledgers.filter(row=>row.communicationId===item.id);
 if(matches.length!==1)return null;
 const row=matches[0];
 if(row.userId!==item.userId||row.projectId!==item.projectId||row.workFileId!==item.workFileId||row.state!=="draft_saved"||row.draftFolder!=="Drafts"||!Number.isSafeInteger(row.draftUid)||Number(row.draftUid)<=0||row.sentFolder!==null||row.sentUid!==null) return null;
 // Any explicit Sent association is a contradiction, never an invitation to resend.
 if(sentMessages.some(message=>message.communicationId===item.id&&message.folderName==="Sent"))return null;
 return "draft_saved";
}
function rows<T>(value:unknown):T[] {return (Array.isArray(value)&&Array.isArray(value[0])?value[0]:value) as T[];}
/** Keep one communication row. Reading all associated ledger rows is deliberate:
 * filtering bad lineage out first would hide duplicate/conflicting evidence. */
export async function projectSavedMailboxDrafts<T extends Communication>(db:NonNullable<Awaited<ReturnType<typeof getDb>>>,items:readonly T[]) {
 const ids=items.filter(item=>item.communicationStatus==="archived"&&item.channel==="email"&&item.direction==="outbound").map(item=>item.id);
 if(!ids.length)return items.map(item=>({...item,mailboxDraftState:null}));
 const list=sql.join(ids.map(id=>sql`${id}`),sql`, `);
 const ledgers=rows<Ledger>(await db.execute(sql`SELECT id, user_id AS userId, project_id AS projectId, work_file_id AS workFileId, communication_id AS communicationId, state, draft_folder AS draftFolder, draft_uid AS draftUid, sent_folder AS sentFolder, sent_uid AS sentUid FROM como_mailbox_draft_ledger WHERE communication_id IN (${list})`));
 const sent=rows<Sent>(await db.execute(sql`SELECT communication_id AS communicationId, user_id AS userId, linked_project_id AS linkedProjectId, linked_work_file_id AS linkedWorkFileId, folder_name AS folderName FROM como_next_email_messages WHERE communication_id IN (${list}) AND folder_name = 'Sent'`));
 return items.map(item=>({...item,mailboxDraftState:verifiedSavedDraftState(item,ledgers,sent)}));
}
