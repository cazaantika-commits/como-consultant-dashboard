/**
 * Knowledge Service - خدمة قاعدة المعرفة المتخصصة
 * 
 * توفر معرفة متخصصة لكل وكيل:
 * - قوانين RERA ودبي العقارية
 * - معايير بلدية دبي للبناء
 * - أسعار السوق المرجعية
 * - سياق COMO (مشاريع، أشخاص، تفضيلات)
 */

import { getDb } from "./db";
import { specialistKnowledge } from "../drizzle/schema";
import { eq, and, desc, sql, like, or } from "drizzle-orm";

export type KnowledgeDomain = 
  | 'rera_law' | 'dubai_municipality' | 'building_codes' | 'market_prices'
  | 'como_context' | 'como_people' | 'como_preferences' | 'como_workflow'
  | 'consultant_info' | 'project_standards' | 'general';

// ═══════════════════════════════════════════════════
// Search & Retrieval
// ═══════════════════════════════════════════════════

/**
 * بحث في قاعدة المعرفة
 */
export async function searchKnowledge(
  query: string,
  options?: {
    domain?: KnowledgeDomain;
    category?: string;
    limit?: number;
  }
): Promise<Array<{
  id: number;
  domain: string;
  category: string;
  title: string;
  content: string;
  source: string | null;
  relevanceSnippet: string;
}>> {
  const db = await getDb();
  if (!db) return [];

  const conditions: any[] = [eq(specialistKnowledge.isActive, 1)];
  
  if (options?.domain) {
    conditions.push(eq(specialistKnowledge.domain, options.domain));
  }
  if (options?.category) {
    conditions.push(eq(specialistKnowledge.category, options.category));
  }

  // Search in title, content, keywords
  const searchTerms = query.split(/\s+/).filter(t => t.length > 1);
  if (searchTerms.length > 0) {
    const searchConditions = searchTerms.map(term =>
      or(
        like(specialistKnowledge.title, `%${term}%`),
        like(specialistKnowledge.content, `%${term}%`),
        like(specialistKnowledge.keywords, `%${term}%`),
        like(specialistKnowledge.category, `%${term}%`)
      )
    );
    conditions.push(...searchConditions);
  }

  const results = await db.select()
    .from(specialistKnowledge)
    .where(and(...conditions))
    .orderBy(desc(specialistKnowledge.useCount))
    .limit(options?.limit || 5);

  // Update use count
  for (const r of results) {
    db.update(specialistKnowledge)
      .set({ 
        lastUsedAt: new Date(),
        useCount: sql`${specialistKnowledge.useCount} + 1`
      })
      .where(eq(specialistKnowledge.id, r.id))
      .catch(() => {});
  }

  return results.map(r => {
    // Generate relevance snippet
    const lowerContent = r.content.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const idx = lowerContent.indexOf(lowerQuery);
    let relevanceSnippet: string;
    if (idx >= 0) {
      const start = Math.max(0, idx - 100);
      const end = Math.min(r.content.length, idx + query.length + 200);
      relevanceSnippet = (start > 0 ? '...' : '') + r.content.substring(start, end) + (end < r.content.length ? '...' : '');
    } else {
      relevanceSnippet = r.content.substring(0, 300) + (r.content.length > 300 ? '...' : '');
    }

    return {
      id: r.id,
      domain: r.domain,
      category: r.category,
      title: r.title,
      content: r.content,
      source: r.source,
      relevanceSnippet,
    };
  });
}

/**
 * جلب معرفة حسب المجال
 */
export async function getKnowledgeByDomain(
  domain: KnowledgeDomain,
  limit: number = 20
): Promise<Array<{
  id: number;
  category: string;
  title: string;
  content: string;
  source: string | null;
}>> {
  const db = await getDb();
  if (!db) return [];

  return db.select({
    id: specialistKnowledge.id,
    category: specialistKnowledge.category,
    title: specialistKnowledge.title,
    content: specialistKnowledge.content,
    source: specialistKnowledge.source,
  })
    .from(specialistKnowledge)
    .where(and(
      eq(specialistKnowledge.domain, domain),
      eq(specialistKnowledge.isActive, 1)
    ))
    .orderBy(desc(specialistKnowledge.useCount))
    .limit(limit);
}

// ═══════════════════════════════════════════════════
// Knowledge Management
// ═══════════════════════════════════════════════════

/**
 * إضافة معرفة جديدة
 */
export async function addKnowledge(params: {
  domain: KnowledgeDomain;
  category: string;
  title: string;
  content: string;
  keywords?: string[];
  source?: string;
  sourceUrl?: string;
  addedBy?: string;
}): Promise<{ success: boolean; id?: number; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "قاعدة البيانات غير متاحة" };

  try {
    const [result] = await db.insert(specialistKnowledge).values({
      domain: params.domain,
      category: params.category,
      title: params.title,
      content: params.content,
      keywords: params.keywords ? JSON.stringify(params.keywords) : null,
      source: params.source || null,
      sourceUrl: params.sourceUrl || null,
      addedBy: params.addedBy || 'system',
      isActive: 1,
      useCount: 0,
    });

    return { success: true, id: result.insertId };
  } catch (err: any) {
    console.error("[Knowledge] addKnowledge error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * تحديث معرفة موجودة
 */
export async function updateKnowledge(
  id: number,
  updates: Partial<{
    content: string;
    title: string;
    category: string;
    keywords: string[];
    source: string;
    isActive: number;
  }>
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    const setValues: any = {};
    if (updates.content !== undefined) setValues.content = updates.content;
    if (updates.title !== undefined) setValues.title = updates.title;
    if (updates.category !== undefined) setValues.category = updates.category;
    if (updates.keywords !== undefined) setValues.keywords = JSON.stringify(updates.keywords);
    if (updates.source !== undefined) setValues.source = updates.source;
    if (updates.isActive !== undefined) setValues.isActive = updates.isActive;

    await db.update(specialistKnowledge)
      .set(setValues)
      .where(eq(specialistKnowledge.id, id));

    return true;
  } catch (err) {
    console.error("[Knowledge] updateKnowledge error:", err);
    return false;
  }
}

/**
 * إحصائيات قاعدة المعرفة
 */
export async function getKnowledgeStats() {
  const db = await getDb();
  if (!db) return null;

  const byDomain = await db.select({
    domain: specialistKnowledge.domain,
    count: sql<number>`count(*)`,
    totalUses: sql<number>`SUM(${specialistKnowledge.useCount})`,
  })
    .from(specialistKnowledge)
    .where(eq(specialistKnowledge.isActive, 1))
    .groupBy(specialistKnowledge.domain);

  const [total] = await db.select({
    totalEntries: sql<number>`count(*)`,
    totalUses: sql<number>`SUM(${specialistKnowledge.useCount})`,
  })
    .from(specialistKnowledge)
    .where(eq(specialistKnowledge.isActive, 1));

  return {
    ...total,
    byDomain,
  };
}

// ═══════════════════════════════════════════════════
// Agent-specific Knowledge Retrieval
// ═══════════════════════════════════════════════════

/**
 * جلب المعرفة المناسبة لوكيل معين حسب تخصصه
 */
export function getRelevantDomainsForAgent(agentName: string): KnowledgeDomain[] {
  const agentDomains: Record<string, KnowledgeDomain[]> = {
    salwa: ['como_context', 'como_people', 'como_workflow', 'como_preferences', 'general'],
    farouq: ['rera_law', 'como_context', 'consultant_info', 'project_standards'],
    khazen: ['como_workflow', 'como_context', 'consultant_info', 'project_standards'],
    alina: ['market_prices', 'como_context', 'consultant_info', 'project_standards'],
    khaled: ['building_codes', 'dubai_municipality', 'project_standards', 'como_context'],
    joelle: ['market_prices', 'rera_law', 'como_context', 'project_standards'],
    baz: ['market_prices', 'como_context', 'como_preferences', 'general'],
    buraq: ['como_workflow', 'como_context', 'project_standards'],
  };
  return agentDomains[agentName] || ['general', 'como_context'];
}

/**
 * جلب سياق المعرفة لوكيل (يُضاف إلى system prompt)
 */
export async function getAgentKnowledgeContext(agentName: string): Promise<string> {
  const domains = getRelevantDomainsForAgent(agentName);
  const db = await getDb();
  if (!db) return '';

  let context = '\n\n📚 قاعدة المعرفة المتخصصة:\n';
  
  for (const domain of domains) {
    const items = await db.select({
      title: specialistKnowledge.title,
      content: specialistKnowledge.content,
    })
      .from(specialistKnowledge)
      .where(and(
        eq(specialistKnowledge.domain, domain),
        eq(specialistKnowledge.isActive, 1)
      ))
      .orderBy(desc(specialistKnowledge.useCount))
      .limit(3);

    if (items.length > 0) {
      const domainLabels: Record<string, string> = {
        rera_law: '⚖️ قوانين RERA',
        dubai_municipality: '🏛️ بلدية دبي',
        building_codes: '🏗️ كودات البناء',
        market_prices: '💰 أسعار السوق',
        como_context: '🏢 سياق COMO',
        como_people: '👥 فريق COMO',
        como_preferences: '⭐ تفضيلات COMO',
        como_workflow: '🔄 طريقة عمل COMO',
        consultant_info: '🏛️ الاستشاريون',
        project_standards: '📐 معايير المشاريع',
        general: '📋 عام',
      };
      
      context += `\n${domainLabels[domain] || domain}:\n`;
      for (const item of items) {
        // Truncate content to keep prompt manageable
        const truncated = item.content.length > 500 
          ? item.content.substring(0, 500) + '...' 
          : item.content;
        context += `• ${item.title}: ${truncated}\n`;
      }
    }
  }

  return context;
}
