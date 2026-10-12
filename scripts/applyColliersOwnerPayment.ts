import {eq} from 'drizzle-orm';
import {comoNextStagedDirectives} from '../drizzle/schema';
import {getDb} from '../server/db';
import {recordWorkFileUpdateCommand} from '../server/services/comoNextKitchen';
import {applyOwnerPaymentAssertion,readWorkFileLifecycle} from '../server/services/comoWorkFileLifecycle';
import {writeFile} from 'node:fs/promises';
const db=await getDb();if(!db)throw new Error('database_unavailable');
const [directive]=await db.select().from(comoNextStagedDirectives).where(eq(comoNextStagedDirectives.id,150003)).limit(1);
if(!directive||directive.userId!==1||directive.workFileId!==60017||!directive.directiveText.includes('Payment is now confirmed as paid from our side'))throw new Error('source_mismatch');
// Original statement retained verbatim. Current owner's Oct 12 instruction explicitly
// authorizes applying it; we do not convert this acknowledgement into bank evidence.
const update=await recordWorkFileUpdateCommand({userId:1,workFileId:60017,sourceChannel:'internal',updateText:directive.directiveText,actorType:'human',actorUserId:1,idempotencyKey:'staged-directive:150003'});
const result=await applyOwnerPaymentAssertion({userId:1,workFileId:60017,updateId:Number(update.id),text:directive.directiveText,assertionReference:'إفادة المالك المحفوظة عبر سارة #150003 بتاريخ 9 أكتوبر 2026 15:01 دبي؛ أكد تطبيقها في توجيه 12 أكتوبر'});
await writeFile('/home/ubuntu/reports/colliers-lifecycle-2026-10-12/payment-applied.json',JSON.stringify({capturedAt:new Date().toISOString(),sourceDirectiveId:150003,updateId:update.id,result,lanes:await readWorkFileLifecycle(60017)},null,2)+'\n');
console.log(JSON.stringify({updateId:update.id,result},null,2));process.exit(0);
