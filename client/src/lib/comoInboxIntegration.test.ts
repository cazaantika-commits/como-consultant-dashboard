import {beforeEach,describe,expect,it,vi} from "vitest";
import * as React from "react";
import type {ReactNode} from "react";
const h=vi.hoisted(()=>({states:[] as unknown[],cursor:0,effects:[] as (()=>void)[],calls:vi.fn(),items:[{id:1,subject:"SENT ONLY",folderName:"Sent",inboxStatus:"linked"},{id:2,subject:"DRAFT NOT SENT",folderName:"Drafts",inboxStatus:"linked"},{id:3,subject:"UNKNOWN NOT SENT",folderName:"Unknown",inboxStatus:"linked"},{id:4,subject:"INBOX ONLY",folderName:"INBOX",inboxStatus:"unmatched"}]}));
vi.mock("react",async original=>{const real=await original<typeof import("react")>();return {...real,useState<T>(initial:T|(()=>T)){const i=h.cursor++;if(!(i in h.states))h.states[i]=typeof initial==="function"?(initial as ()=>T)():initial;return[h.states[i] as T,(value:T)=>{h.states[i]=value;}];},useEffect(effect:()=>void){h.effects.push(effect);},useMemo<T>(fn:()=>T){return fn();}};});
vi.mock("@/lib/trpc",()=>({trpc:{comoNextEmail:{list:{useQuery:()=>({data:h.items,isLoading:false,refetch:h.calls})},scheduledStatus:{useQuery:()=>({data:null})},syncReadonly:{useMutation:()=>({mutateAsync:h.calls,isPending:false})}}}}));
vi.mock("@/components/ComoNextIntakeProposals",()=>({ComoNextIntakeProposals:()=>null}));
import {isValidElement} from "react";
import {ComoNextEmailInbox} from "../components/ComoNextEmailInbox";
function nodes(node:ReactNode):React.ReactElement<{children?:ReactNode;item?:{subject:string}}>[]{if(Array.isArray(node))return node.flatMap(nodes);if(!isValidElement<{children?:ReactNode;item?:{subject:string}}>(node))return[];return[node,...nodes(node.props.children)];}
function render(filter:string){h.cursor=0;const tree=ComoNextEmailInbox({requestedFilter:filter,onOverviewChanged:h.calls});h.effects.splice(0).forEach(effect=>effect());return nodes(tree).flatMap(node=>node.props.item?[node.props.item.subject]:[]);}
beforeEach(()=>{vi.clearAllMocks();h.states.length=0;h.effects.length=0;vi.stubGlobal("React",React);});
describe("actual inbox component filter wiring",()=>{
 it("opens /sent-emails requested Sent filter without mailbox mutation",()=>{expect(render("sent")).toEqual(["SENT ONLY"]);expect(h.calls).not.toHaveBeenCalled();});
 it("reacts to filter prop navigation, preserving only real INBOX/Sent folders",()=>{expect(render("attention")).toEqual(["INBOX ONLY"]);render("sent");expect(render("sent")).toEqual(["SENT ONLY"]);render("attention");expect(render("attention")).toEqual(["INBOX ONLY"]);expect(h.calls).not.toHaveBeenCalled();});
});
