import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MySqlDialect } from 'drizzle-orm/mysql-core';
import { getDb } from './db';
vi.mock('./db', () => ({ getDb:vi.fn() }));
import { findValidatedSentLineage, type SentLineageMessage } from './services/comoMailboxDraftLedger';
const dialect = new MySqlDialect();
const sha = (v:string) => createHash('sha256').update(v).digest('hex');
const mailboxKey = 'registered-COMO-mailbox';
const ownerMailbox = 'owner@comodevelopments.com';
const sent = (overrides:Partial<SentLineageMessage> = {}):SentLineageMessage => ({
  uid:231,messageId:'<new-client-generated-id@example.test>',from:ownerMailbox,to:'tedi@artec.test',cc:'wael@example.test',
  subject:'Re: Mobilisation invoice',textBody:'We have not received payment confirmation.',date:new Date('2026-10-26T04:00:00Z'), ...overrides,
});
const ledger = (overrides:Record<string,unknown> = {}) => ({
  id:801,mailbox_key:mailboxKey,draft_key:'email-reply-draft:2130001',user_id:1,project_id:6,work_file_id:390001,communication_id:3060001,
  message_id:'<old-draft@example.test>',subject_sha256:sha(sent().subject),body_sha256:sha(sent().textBody),to_envelope_sha256:sha(sent().to),cc_envelope_sha256:sha(sent().cc),
  state:'draft_saved',draft_folder:'Drafts',draft_uid:965,sent_folder:null,sent_uid:null,created_at:'2026-10-23 09:51:59', ...overrides,
});
function database(candidates:Record<string,unknown>[]) {
  const execute = vi.fn(async(query:any) => {
    const sql = dialect.sqlToQuery(query);
    return [sql.sql.includes('l.message_id =') ? [] : candidates];
  });
  vi.mocked(getDb).mockResolvedValue({execute} as any);
  return execute;
}
const run = (message=sent()) => findValidatedSentLineage({userId:1,mailboxKey,ownerMailbox,message});
beforeEach(()=>vi.clearAllMocks());
describe('COMO exact registered reply Sent fallback',()=>{
  it('reconnects a unique registered reply after client strips its header and replaces Message-ID',async()=>{
    const execute=database([ledger()]);
    await expect(run()).resolves.toEqual({kind:'validated',ledgerId:801,projectId:6,workFileId:390001,communicationId:3060001});
    expect(execute).toHaveBeenCalledTimes(2);
    const query=dialect.sqlToQuery(execute.mock.calls[1][0]);
    expect(query.params).toContain('email-reply-draft:%');
    expect(query.params).toContain('finance_invoice_draft:attachment:%');
    for(const hash of [sha(sent().subject),sha(sent().textBody),sha(sent().to),sha(sent().cc)]) expect(query.params).toContain(hash);
    expect(query.sql).toContain('l.created_at <=');
    expect(query.sql).toContain('finance_communication.id = l.communication_id');
    expect(query.sql).toContain('finance_communication.user_id = l.user_id');
  });
  it('does not treat modified body as the same exact reply',async()=>{
    database([ledger()]);
    await expect(run(sent({textBody:'Payment is confirmed.'}))).resolves.toMatchObject({kind:'review',reason:'sent_binding_validation_failed'});
  });
  it('does not accept a modified subject through content-only fallback',async()=>{
    database([ledger()]);
    await expect(run(sent({subject:'Re: New payment instruction'}))).resolves.toMatchObject({kind:'review'});
  });
  it('rejects another user and an earlier message date',async()=>{
    database([ledger({user_id:2})]);await expect(run()).resolves.toMatchObject({kind:'review'});
    database([ledger()]);await expect(run(sent({date:new Date('2026-10-22T04:00:00Z')}))).resolves.toMatchObject({kind:'review'});
  });
  it('never chooses between two exact registered drafts',async()=>{
    database([ledger(),ledger({id:802,communication_id:3060002})]);
    await expect(run()).resolves.toMatchObject({kind:'review'});
  });
  it('will not fall back past an explicit but unrecognized COMO draft key',async()=>{
    const execute=database([]);
    await expect(run(sent({headers:{'X-COMO-Draft-Key':'another-explicit-key'}}))).resolves.toEqual({kind:'none'});
    expect(execute).toHaveBeenCalledTimes(1);
  });
  it('checks the actual owner mailbox before querying or attempting any match',async()=>{
    const execute=database([ledger()]);
    await expect(run(sent({from:'someone-else@example.test'}))).resolves.toEqual({kind:'none'});
    expect(execute).not.toHaveBeenCalled();
  });
});
