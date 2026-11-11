import 'dotenv/config';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import Imap from 'imap';
import nodemailer from 'nodemailer';
import {simpleParser} from 'mailparser';
import {createHash} from 'node:crypto';
import {getConfiguredMailboxAddress} from '../server/emailMonitor';
const root='/home/ubuntu/reports/como-directive-2370001-2026-11-11';
const load=(n:string)=>JSON.parse(fs.readFileSync(root+'/'+n+'.json','utf8')),save=(n:string,v:any)=>fs.writeFileSync(root+'/'+n+'.json',JSON.stringify(v,null,2)+'\n');
const norm=(v:any)=>String(v||'').replace(/\r\n?/g,'\n').trim(),sha=(v:any)=>createHash('sha256').update(norm(v)).digest('hex');
const env=(v:any)=>[...new Set(String(v||'').toLowerCase().match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/g)||[])].sort().join(',');
const open=(i:any,f:string,ro=true)=>new Promise<any>((ok,no)=>i.openBox(f,ro,(e:any,b:any)=>e?no(e):ok(b))),search=(i:any,s:any[])=>new Promise<number[]>((ok,no)=>i.search(s,(e:any,v:any)=>e?no(e):ok(v||[])));
const raw=(i:any,uid:number)=>new Promise<Buffer>((ok,no)=>{const bb:Buffer[]=[];let count=0;const f=i.fetch([uid],{bodies:'',markSeen:false});f.on('message',(m:any)=>{count++;m.on('body',(s:any)=>s.on('data',(b:Buffer)=>bb.push(b)));});f.once('error',no);f.once('end',()=>count===1?ok(Buffer.concat(bb)):no(Error('UID missing')));});
async function main(){
 assert(!fs.existsSync(root+'/replacement-journal.json'),'Never repeat REPLACE: reconcile journal read-only');
 const b=load('protected-before'),c=b.communications.find((v:any)=>v.id===5730001),l=b.ledgers.find((v:any)=>v.id===2070001),pre=load('mail-before'),context=load('context');
 assert(c&&l&&l.draft_key==='email-reply-draft:4020001'&&l.draft_uid===1026&&l.state==='draft_saved'&&!l.sent_uid&&!c.sent_at&&c.communication_status==='archived');assert(Date.now()-Date.parse(pre.checkedAt)<15*60000);
 const dm=pre.Drafts.messages.filter((v:any)=>v.messageId===l.message_id||v.headers?.['x-como-draft-key']===l.draft_key);assert.equal(dm.length,1);const original=dm[0];assert.equal(original.uid,1026);
 assert(!pre.Sent.messages.some((v:any)=>v.messageId===l.message_id||v.headers?.['x-como-draft-key']===l.draft_key||v.headers?.['in-reply-to']===context.source.message_id));
 const full=fs.readFileSync(root+'/Reply_To_Tedi_EN.txt','utf8'),body=norm(full.slice(full.indexOf('\n\n')+2));assert(full.startsWith('Subject: '+c.subject));assert(body.includes('DDA approval')&&body.includes('two days')&&body.includes('separate matter'));assert(!/currently coordinating|payment will|commenced|unconditional/i.test(body));assert(body.endsWith('Abdalrahman Zaqout'));
 const i:any=await new Promise((ok,no)=>{const client=new Imap({user:process.env.EMAIL_USER||getConfiguredMailboxAddress(),password:process.env.EMAIL_PASSWORD||'',host:process.env.EMAIL_HOST||'mail.privateemail.com',port:993,tls:true,connTimeout:15000,authTimeout:10000,socketTimeout:45000});client.once('ready',()=>ok(client));client.on('error',(e:any)=>{console.error('IMAP:',e.message);no(e);});client.connect();});
 try{
 assert(i.serverSupports('REPLACE')&&i.serverSupports('LITERAL+'));
 const identity:any[]=[['OR',['HEADER','X-COMO-Draft-Key',l.draft_key],['HEADER','Message-ID',l.message_id]]];async function exact(){const found=await search(i,identity);assert(found.length<40);const out:number[]=[];for(const uid of found){const m=await simpleParser(await raw(i,uid));if(m.messageId===l.message_id||m.headers.get('x-como-draft-key')===l.draft_key)out.push(uid);}return out;}
 await open(i,'Sent');assert.equal((await exact()).length,0,'Already sent');assert.equal((await search(i,[['HEADER','In-Reply-To',context.source.message_id]])).length,0,'Owner reply already sent');
 const box=await open(i,'Drafts');assert.equal(String(box.uidvalidity),String(pre.Drafts.uidValidity));assert.deepEqual(await exact(),[1026]);const oldRaw=await raw(i,1026),old=await simpleParser(oldRaw);assert.equal(old.messageId,l.message_id);assert.equal(sha(old.text),l.body_sha256);assert.equal(sha(old.text),sha(c.body));assert.equal(old.subject,c.subject);assert.equal(env(old.to?.text),env(original.to));assert.equal(env(old.cc?.text),env(original.cc));assert.equal(sha(env(old.cc?.text)),l.cc_envelope_sha256);assert.equal(old.attachments.length,0);assert.equal(old.inReplyTo,context.source.message_id);fs.writeFileSync(root+'/Draft1026-before.eml',oldRaw);
 const built=await nodemailer.createTransport({streamTransport:true,buffer:true,newline:'unix'}).sendMail({from:old.from?.text,to:old.to?.text,cc:old.cc?.text,subject:c.subject,date:old.date,messageId:old.messageId,inReplyTo:old.inReplyTo,references:old.references,headers:{'X-COMO-Draft-Key':l.draft_key},text:body});const replacement=built.message as Buffer,expected=await simpleParser(replacement);assert.equal(sha(expected.text),sha(body));assert.equal(expected.messageId,l.message_id);assert.equal(expected.attachments.length,0);
 await open(i,'Sent');assert.equal((await exact()).length,0);await open(i,'Drafts',false);assert.deepEqual(await exact(),[1026]);assert.equal(sha((await simpleParser(await raw(i,1026))).text),l.body_sha256);
 save('replacement-journal',{phase:'replace_started',oldUid:1026,oldHash:l.body_sha256,newHash:sha(body),messageId:l.message_id,draftKey:l.draft_key,subject:c.subject,to:original.to,cc:original.cc,inReplyTo:old.inReplyTo,references:old.references,authority:'COMO directive2370001/system mail review4740001',sent:false,startedAt:new Date().toISOString()});
 await new Promise<void>((ok,no)=>{i._enqueue(`UID REPLACE 1026 "Drafts" (\\Draft) {${replacement.length}+}`,(e:any)=>e?no(e):ok());i._queue[i._queue.length-1].literalAppendData=replacement;});save('replacement-journal',{...load('replacement-journal'),phase:'replace_completed',commandCompletedAt:new Date().toISOString()});
 const ids=await exact();assert.equal(ids.length,1);const uid=ids[0];assert.notEqual(uid,1026);const bytes=await raw(i,uid),m=await simpleParser(bytes);assert.equal(sha(m.text),sha(body));assert.equal(m.messageId,l.message_id);assert.equal(m.subject,c.subject);assert.equal(env(m.to?.text),env(original.to));assert.equal(env(m.cc?.text),env(original.cc));assert.equal(m.inReplyTo,old.inReplyTo);assert.deepEqual(m.references,old.references);assert.equal(m.attachments.length,0);fs.writeFileSync(root+'/Draft'+uid+'-after.eml',bytes);save('replacement-journal',{...load('replacement-journal'),phase:'replace_verified',newUid:uid,verifiedAt:new Date().toISOString()});console.log('REPLACE verified '+uid);
 }finally{i.end();}
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.stack);process.exit(1)});
