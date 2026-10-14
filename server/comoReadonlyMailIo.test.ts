import {beforeAll,beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
const io=vi.hoisted(()=>({mode:'success',instances:[] as any[],controllers:[] as AbortController[],parser:vi.fn()}));
vi.mock('mailparser',()=>({simpleParser:(...args:any[])=>io.parser(...args)}));
vi.mock('imap',async()=>{
 const {EventEmitter}=await import('node:events');
 return {default:class MockImap extends EventEmitter{
  options:any;destroyed=false;lastCriteria:any;lastFetchOptions:any;readonly:boolean|undefined;
  constructor(options:any){super();this.options=options;io.instances.push(this);}
  connect(){queueMicrotask(()=>this.emit('ready'));}
  openBox(_name:string,readonly:boolean,cb:any){this.readonly=readonly;cb(null,{uidvalidity:'123',uidnext:3});}
  search(criteria:any,cb:any){this.lastCriteria=criteria;cb(null,[2]);}
  fetch(_uids:any,options:any){
   this.lastFetchOptions=options;const f=new EventEmitter();
   queueMicrotask(()=>{
    if(io.mode==='hang')return;
    if(io.mode==='missing'){f.emit('end');return;}
    const m=new EventEmitter(),s=new EventEmitter();f.emit('message',m);
    m.emit('attributes',{uid:2,flags:[]});m.emit('body',s);s.emit('data',Buffer.from('verified RFC source'));
    m.emit('end');f.emit('end');
   });return f;
  }
  destroy(){this.destroyed=true;}
  end(){this.emit('end');}
 }};
});
let mail:typeof import('./emailMonitor');
beforeAll(async()=>{vi.stubEnv('EMAIL_PASSWORD','test-only-password');mail=await import('./emailMonitor');});
beforeEach(()=>{
 io.mode='success';io.instances=[];io.controllers=[];
 io.parser.mockReset().mockResolvedValue({messageId:'<source@example.test>',headers:new Map(),from:{value:[{address:'sender@example.test'}]},subject:'Thread',date:new Date('2026-10-14T10:00:00Z'),text:'body',attachments:[]});
 vi.spyOn(AbortSignal,'timeout').mockImplementation(()=>{const c=new AbortController();io.controllers.push(c);return c.signal;});
});
afterEach(()=>vi.restoreAllMocks());
describe('COMO bounded read-only IMAP I/O',()=>{
 it('fails and destroys a silent UID connection on the full I/O deadline',async()=>{
  io.mode='hang';const p=mail.fetchEmailByUID(2,'123','INBOX');const assertion=expect(p).rejects.toThrow('readonly_uid_fetch_timeout');
  await Promise.resolve();io.controllers[0].abort();await assertion;
  expect(io.instances[0].destroyed).toBe(true);expect(io.instances[0].readonly).toBe(true);
 });
 it('does not resolve before asynchronous MIME parsing completes',async()=>{
  let release:any;io.parser.mockImplementation(()=>new Promise(r=>{release=r}));
  const p=mail.fetchEmailByUID(2,'123');let resolved=false;p.then(()=>{resolved=true});
  await Promise.resolve();await Promise.resolve();expect(resolved).toBe(false);
  release({messageId:'<source@example.test>',from:{value:[]},subject:'Thread',text:'body',attachments:[]});
  const result=await p;expect(result?.uid).toBe(2);expect(io.instances[0].destroyed).toBe(true);
  expect(io.instances[0].lastFetchOptions.markSeen).toBe(false);
 });
 it('rejects a searched UID that disappeared instead of hanging or returning partial mail',async()=>{
  io.mode='missing';await expect(mail.fetchReadonlyFolderSince('Sent',72,100)).rejects.toThrow('readonly_folder_batch_incomplete');
  expect(io.instances[0].destroyed).toBe(true);
 });
 it('bounds a silent folder fetch as well as a single-message fetch',async()=>{
  io.mode='hang';const p=mail.fetchReadonlyFolderSince('Drafts');const assertion=expect(p).rejects.toThrow('readonly_folder_fetch_timeout');
  await Promise.resolve();io.controllers[0].abort();await assertion;expect(io.instances[0].destroyed).toBe(true);
 });
 it('applies a subject preflight without changing scheduled cursor behavior or flags',async()=>{
  const batch=await mail.fetchReadonlyFolderSince('Sent',72,100,{lastUid:1,uidValidity:'123'},'Land Plot Documents');
  const instance=io.instances[0];expect(instance.lastCriteria).toEqual([['UID','2:*'],['HEADER','SUBJECT','Land Plot Documents']]);
  expect(instance.readonly).toBe(true);expect(instance.lastFetchOptions.markSeen).toBe(false);expect(batch.messages).toHaveLength(1);
 });
});
