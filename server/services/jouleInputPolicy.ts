import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { marketOverview, competitionPricing, projects } from "../../drizzle/schema";

const percent = z.number().finite().min(0).max(100).nullable().optional();
const area = z.number().finite().nonnegative().nullable().optional();
const count = z.number().int().nonnegative().nullable().optional();
export const jouleMarketInput = z.object({
  projectId: z.number().int().positive(),
  residentialStudioPct: percent, residentialStudioAvgArea: area, residentialStudioCount: count,
  residential1brPct: percent, residential1brAvgArea: area, residential1brCount: count,
  residential2brPct: percent, residential2brAvgArea: area, residential2brCount: count,
  residential3brPct: percent, residential3brAvgArea: area, residential3brCount: count,
  retailSmallPct: percent, retailSmallAvgArea: area, retailSmallCount: count,
  retailMediumPct: percent, retailMediumAvgArea: area, retailMediumCount: count,
  retailLargePct: percent, retailLargeAvgArea: area, retailLargeCount: count,
  officeSmallPct: percent, officeSmallAvgArea: area, officeSmallCount: count,
  officeMediumPct: percent, officeMediumAvgArea: area, officeMediumCount: count,
  officeLargePct: percent, officeLargeAvgArea: area, officeLargeCount: count,
  finishingQuality: z.enum(["ممتاز", "جيد", "عادي"]).nullable().optional(),
}).strict();
export const joulePriceInput = z.object({
  projectId: z.number().int().positive(),
  optStudioPrice: area, opt1brPrice: area, opt2brPrice: area, opt3brPrice: area,
  optRetailSmallPrice: area, optRetailMediumPrice: area, optRetailLargePrice: area,
  optOfficeSmallPrice: area, optOfficeMediumPrice: area, optOfficeLargePrice: area,
  baseStudioPrice: area, base1brPrice: area, base2brPrice: area, base3brPrice: area,
  baseRetailSmallPrice: area, baseRetailMediumPrice: area, baseRetailLargePrice: area,
  baseOfficeSmallPrice: area, baseOfficeMediumPrice: area, baseOfficeLargePrice: area,
  consStudioPrice: area, cons1brPrice: area, cons2brPrice: area, cons3brPrice: area,
  consRetailSmallPrice: area, consRetailMediumPrice: area, consRetailLargePrice: area,
  consOfficeSmallPrice: area, consOfficeMediumPrice: area, consOfficeLargePrice: area,
}).strict();
const recommendedUnit = z.object({recommended:z.boolean(), pct:z.number().finite().min(0).max(100),avgArea:z.number().finite().nonnegative()}).strict();
const sizeUnit = z.object({pct:z.number().finite().min(0).max(100),avgArea:z.number().finite().nonnegative()}).strict();
export const jouleRecommendationSchema = z.object({
 residential:z.object({studio:recommendedUnit,oneBr:recommendedUnit,twoBr:recommendedUnit,threeBr:recommendedUnit}).strict().optional(),
 retail:z.object({hasRetail:z.boolean(),small:sizeUnit,medium:sizeUnit,large:sizeUnit}).strict().optional(),
 offices:z.object({hasOffices:z.boolean(),small:sizeUnit,medium:sizeUnit,large:sizeUnit}).strict().optional(),
 finishingQuality:z.enum(["ممتاز","جيد","عادي"]),
 summary:z.string().max(4000).optional(),
}).strict();
type Basis = Pick<typeof projects.$inferSelect,"gfaResidentialSqft"|"gfaRetailSqft"|"gfaOfficesSqft">;
const fail = (message:string):never => {throw new TRPCError({code:"BAD_REQUEST",message});};
export function assertJouleUnlocked(row: {isApproved:number|null}|undefined) {
 if (row?.isApproved === 1) throw new TRPCError({code:"FORBIDDEN",message:"المصدر المعتمد مقفل ولا يجوز تعديله"});
}
/** Existing INT/DECIMAL columns must never silently round a user's input. */
function assertStoredRecommendationValue(key:string,value:unknown) {
 if(value===undefined || value===null || typeof value!=="number") return;
 if(key.endsWith("Pct")) {
  if(Math.abs(value*100-Math.round(value*100))>0.000001) fail("النسب المحفوظة تدعم منزلتين عشريتين فقط؛ لا يتم تقريب المدخل تلقائيًا");
 } else if(key.endsWith("AvgArea") || key.endsWith("Count") || key.endsWith("Price")) {
  if(!Number.isSafeInteger(value)) fail("حقل السعر أو المساحة الحالي يدعم عددًا صحيحًا فقط؛ يلزم ترحيل واضح لدعم الكسور دون فقدانها");
 }
}
export function assertJouleSourceNotGenerated(row:{aiSmartReport:string|null;aiRecommendationsJson:string|null}|undefined) {
 if (row?.aiSmartReport || row?.aiRecommendationsJson) throw new TRPCError({code:"FORBIDDEN",message:"التقرير المولد ومصدر التوصيات مثبتان؛ لا يجوز استبدالهما"});
}
function available(value:unknown) { return value !== null && value !== undefined && Number.isFinite(Number(value)) && Number(value)>0; }
const groups = [
 {basis:"gfaResidentialSqft",prefixes:["residentialStudio","residential1br","residential2br","residential3br"]},
 {basis:"gfaRetailSqft",prefixes:["retailSmall","retailMedium","retailLarge"]},
 {basis:"gfaOfficesSqft",prefixes:["officeSmall","officeMedium","officeLarge"]},
] as const;
/** Missing fields preserve the stored recommendation. No report/source columns enter this patch. */
export function jouleMarketPatch(input:z.infer<typeof jouleMarketInput>, existing:typeof marketOverview.$inferSelect|undefined, basis:Basis) {
 const {projectId: _projectId,...values}=input;
 const data:Partial<typeof marketOverview.$inferInsert>={};
 for(const [key,value] of Object.entries(values)) {
  if(value===undefined) continue;
  assertStoredRecommendationValue(key,value);
  const column=key as keyof typeof data;
  // Zod has already limited keys; decimal percentages are stored as strings.
  Object.assign(data,{[column]:key.endsWith("Pct") && value!==null ? String(value):value});
 }
 const merged:Record<string,unknown>={...existing,...data};
 for(const group of groups) {
  const touched=group.prefixes.some(prefix=>Object.keys(values).some(key=>key.startsWith(prefix)));
  if(!touched) continue;
  const present=available(basis[group.basis]);
  const percentages=group.prefixes.map(prefix=>Number(merged[`${prefix}Pct`]??0));
  for(const prefix of group.prefixes) {
   const pct=Number(merged[`${prefix}Pct`]??0), avg=Number(merged[`${prefix}AvgArea`]??0), units=Number(merged[`${prefix}Count`]??0);
   if(!present && (pct>0||avg>0||units>0)) fail("نوع توصية غير موجود في GFA المصدر المثبت");
   if(pct>0 && !(avg>0)) fail("مساحة النوع الموصى به يجب أن تكون موجبة");
  }
  const total=percentages.reduce((sum,pct)=>sum+pct,0);
  if(present && Math.abs(total-100)>0.000001) fail("نسب الأنواع المناسبة يجب أن تساوي 100% للفئة الموجودة");
 }
 return data;
}
export function jouleRecommendationPatch(raw:string,existing:typeof marketOverview.$inferSelect|undefined,basis:Basis) {
 let decoded:unknown;try{decoded=JSON.parse(raw);}catch{fail("JSON التوصيات غير صالح");}
 const parsed=jouleRecommendationSchema.safeParse(decoded);
 if(!parsed.success) return fail("حقول أو قيم توصيات غير مسموحة");
 const recs=parsed.data;
 const input:z.infer<typeof jouleMarketInput>={projectId:1,finishingQuality:recs.finishingQuality};
 if(recs.residential) for(const [key,prefix] of [["studio","residentialStudio"],["oneBr","residential1br"],["twoBr","residential2br"],["threeBr","residential3br"]] as const) {
  const unit=recs.residential[key];
  if(!unit.recommended && (unit.pct!==0||unit.avgArea!==0)) fail("النوع غير المناسب يجب أن يبقى بلا نسبة أو مساحة");
  Object.assign(input,{[`${prefix}Pct`]:unit.pct,[`${prefix}AvgArea`]:unit.avgArea,[`${prefix}Count`]:0});
 }
 for(const [key,prefix] of [["retail","retail"],["offices","office"]] as const) {
  const group=recs[key];if(!group)continue;
  const enabled=key==="retail" ? recs.retail?.hasRetail : recs.offices?.hasOffices;
  for(const size of ["small","medium","large"] as const) {
   const unit=group[size];if(!enabled&&(unit.pct!==0||unit.avgArea!==0))fail("الفئة غير الموجودة يجب أن تبقى بلا نسبة أو مساحة");
   const suffix=size[0].toUpperCase()+size.slice(1);
   Object.assign(input,{[`${prefix}${suffix}Pct`]:unit.pct,[`${prefix}${suffix}AvgArea`]:unit.avgArea,[`${prefix}${suffix}Count`]:0});
  }
 }
 return jouleMarketPatch(input,existing,basis);
}
export function joulePricePatch(input:z.infer<typeof joulePriceInput>,basis:Basis) {
 const {projectId:_projectId,...data}=input;
 for(const [key,value] of Object.entries(data)) {
  assertStoredRecommendationValue(key,value);
  const source=key.includes("Retail")?basis.gfaRetailSqft:key.includes("Office")?basis.gfaOfficesSqft:basis.gfaResidentialSqft;
  if(value!==undefined && value!==null && value>0 && !available(source)) fail("سعر لنوع غير موجود في GFA المصدر المثبت");
 }
 return data;
}
