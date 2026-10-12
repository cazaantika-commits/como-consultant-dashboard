import {describe,it,expect} from 'vitest';
import {buildKitchenBoard,kitchenProjectLabel} from '../shared/comoKitchenBoard';
import {buildExecutiveKitchenQueue} from './services/comoNextKitchen';
const base=()=>({actions:[] as any[],decisions:[] as any[],draftCommunications:[],meetings:[],emails:[] as any[],intakeProposals:[] as any[],specialistReviews:[],filesWithoutNextAction:[] as any[]});
describe('current kitchen board',()=>{
 it('shows owner work, Manus work and waiting independently within the same topic',()=>{
  const input=base();input.actions=[{id:1,workFileId:10,projectId:1,title:'راجع المسودة',ownerType:'human',actionStatus:'open'}, {id:2,workFileId:10,projectId:1,title:'قارن العروض',ownerType:'manus',actionStatus:'open'}, {id:3,workFileId:10,projectId:1,title:'انتظار التقرير',ownerType:'manus',actionStatus:'waiting_external',attentionAt:'2099-01-01 00:00:00'}];
  const queue=buildExecutiveKitchenQueue(input);const board=buildKitchenBoard(queue,[{id:10,projectName:'ماجان لايف ستايل سنتر'}]);expect(queue).toHaveLength(1);expect(board.owner.map(x=>x.recordId)).toEqual([1]);expect(board.manus.map(x=>x.recordId)).toEqual([2]);expect(board.waiting.map(x=>x.recordId)).toEqual([3]);expect(board.waiting[0].canConfirmReceipt).toBe(true);for(const group of Object.values(board))for(const item of group)expect(item.projectLabel).toBe('ماجان لايف ستايل سنتر');
 });
 it('does not ask the owner to process intake history or define an office next step',()=>{
  const input=base();input.intakeProposals=[{id:4,title:'توثيق قديم',workFileId:10,projectId:1}];input.filesWithoutNextAction=[{id:11,title:'ملف بلا خطوة',projectId:1}];const board=buildKitchenBoard(buildExecutiveKitchenQueue(input));expect(board.owner).toHaveLength(0);expect(board.manus).toHaveLength(2);
 });
 it('hides verified and cancelled tasks rather than listing their history',()=>{const input=base();input.actions=[{id:1,workFileId:10,actionStatus:'verified'},{id:2,workFileId:10,actionStatus:'cancelled'}];expect(buildExecutiveKitchenQueue(input)).toEqual([])});
 it('labels a multi-project request as Projects, not only its storage project',()=>{expect(kitchenProjectLabel({workFileId:540001,projectId:1},[{id:540001,projectName:'ماجان',title:'المشاريع — ماجان، الجداف، ند الشبا: وثائق الأراضي'}])).toBe('المشاريع — ماجان، الجداف، ند الشبا')});
 it('keeps deferred office work visible under upcoming while waiting is visible now',()=>{const input=base();input.actions=[{id:77,title:'عملManusلاحق',ownerType:'manus',actionStatus:'open',attentionAt:'2099-01-01 00:00:00',workFileId:10,projectId:1}];const b=buildKitchenBoard(buildExecutiveKitchenQueue(input));expect(b.manus).toHaveLength(0);expect(b.scheduled).toHaveLength(1)});
 it('keeps informational notes out of both work lists without deleting their source',()=>{const input=base();input.intakeProposals=[{id:78,proposalKind:'note',title:'توثيقالصادر',workFileId:10,projectId:1}];expect(buildExecutiveKitchenQueue(input)).toEqual([])});
 it('does not duplicate the same record from primary and related arrays',()=>{const row={id:'action:3',recordId:3,kind:'action',phase:'waiting_external',workFileId:10};const b=buildKitchenBoard([{...row,relatedItems:[row,row]}]);expect(b.waiting).toHaveLength(1)});
 it('retains useful legacy queue data without requiring historical UI',()=>{const b=buildKitchenBoard([{kind:'action',recordId:1,phase:'act_now',ownerType:'human',projectId:1}]);expect(b.owner).toHaveLength(1);expect(b.owner[0].canConfirmReceipt).toBe(false)});
});
