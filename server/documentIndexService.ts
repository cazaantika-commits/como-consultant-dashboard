/**
 * Document Index Service - خدمة فهرسة المستندات المشتركة
 * 
 * تستخرج النص من المستندات (PDF, Excel, Word, Google Docs, صور)
 * وتحفظه في قاعدة البيانات ليتمكن كل الوكلاء من البحث فيه
 * 
 * المبدأ: وكيل يقرأ ملف مرة واحدة → كل الوكلاء يستفيدون
 */

import { getDb } from "./db";
import { documentIndex } from "../drizzle/schema";
import { eq, and, desc, sql, like, or, gte } from "drizzle-orm";
import { readFileContent, getFileMetadata } from "./googleDrive";
import { getOAuthClientForUser } from "./googleOAuthClient";
import { invokeLLM } from "./_core/llm";
import { logActivity } from "./activityLogger";

// ═══════════════════════════════════════════════════
// Text Extraction
// ═══════════════════════════════════════════════════

/**
 * استخراج النص من ملف Google Drive
 * يدعم: Google Docs, Google Sheets, PDF, text files
 */
export async function extractTextFromDriveFile(
  fileId: string,
  userId: number,
  agentName: string
): Promise<{ text: string; fileType: string; mimeType: string; fileName: string } | null> {
  try {
    const authClient = await getOAuthClientForUser(userId);
    if (!authClient) {
      console.error("[DocIndex] No auth client for user", userId);
      return null;
    }

    // Get file metadata first
    const metadata = await getFileMetadata(fileId);
    if (!metadata) {
      console.error("[DocIndex] Could not get metadata for file", fileId);
      return null;
    }

    const mimeType = metadata.mimeType || '';
    const fileName = metadata.name || 'unknown';
    let fileType = detectFileType(mimeType, fileName);
    let text = '';

    // Read content based on type
    try {
      const content = await readFileContent(fileId);
      if (content) {
        text = typeof content === 'string' ? content : JSON.stringify(content);
      }
    } catch (readErr: any) {
      console.error(`[DocIndex] Error reading file ${fileId}:`, readErr.message);
      // For binary files that can't be read as text, try export
      text = `[ملف ثنائي - النوع: ${mimeType}, الاسم: ${fileName}]`;
    }

    return { text, fileType, mimeType, fileName };
  } catch (err: any) {
    console.error("[DocIndex] extractTextFromDriveFile error:", err.message);
    return null;
  }
}

/**
 * تحديد نوع الملف من MIME type واسم الملف
 */
function detectFileType(mimeType: string, fileName: string): string {
  if (mimeType.includes('application/vnd.google-apps.document')) return 'google_doc';
  if (mimeType.includes('application/vnd.google-apps.spreadsheet')) return 'google_sheet';
  if (mimeType.includes('application/vnd.google-apps.presentation')) return 'google_slides';
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) return 'excel';
  if (mimeType.includes('word') || mimeType.includes('document') || fileName.endsWith('.docx') || fileName.endsWith('.doc')) return 'word';
  if (mimeType.includes('image')) return 'image';
  if (mimeType.includes('text') || mimeType.includes('csv')) return 'text';
  if (fileName.endsWith('.csv')) return 'csv';
  return 'other';
}

// ═══════════════════════════════════════════════════
// Indexing Operations
// ═══════════════════════════════════════════════════

/**
 * فهرسة ملف من Google Drive
 * يستخرج النص ويحفظه في قاعدة البيانات
 */
export async function indexDriveFile(
  fileId: string,
  userId: number,
  agentName: string,
  options?: {
    projectId?: number;
    consultantId?: number;
    category?: string;
    sourcePath?: string;
  }
): Promise<{ success: boolean; documentId?: number; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "قاعدة البيانات غير متاحة" };

  try {
    // Check if already indexed
    const existing = await db.select()
      .from(documentIndex)
      .where(and(
        eq(documentIndex.sourceType, 'google_drive'),
        eq(documentIndex.sourceId, fileId)
      ))
      .limit(1);

    if (existing.length > 0 && existing[0].indexStatus === 'indexed') {
      // Update access count
      await db.update(documentIndex)
        .set({ 
          lastAccessedAt: new Date(),
          accessCount: sql`${documentIndex.accessCount} + 1`
        })
        .where(eq(documentIndex.id, existing[0].id));
      
      return { success: true, documentId: existing[0].id };
    }

    // Extract text
    const extracted = await extractTextFromDriveFile(fileId, userId, agentName);
    if (!extracted) {
      // Mark as failed
      if (existing.length > 0) {
        await db.update(documentIndex)
          .set({ indexStatus: 'failed', indexError: 'فشل استخراج النص' })
          .where(eq(documentIndex.id, existing[0].id));
      }
      return { success: false, error: "فشل استخراج النص من الملف" };
    }

    // Generate search vector (keywords)
    const searchVector = generateSearchVector(extracted.text, extracted.fileName);

    // Generate AI summary if text is substantial
    let summary: string | null = null;
    if (extracted.text.length > 200) {
      try {
        summary = await generateDocumentSummary(extracted.text, extracted.fileName);
      } catch (err) {
        console.warn("[DocIndex] Summary generation failed:", err);
      }
    }

    // Detect language
    const language = detectLanguage(extracted.text);

    if (existing.length > 0) {
      // Update existing record
      await db.update(documentIndex)
        .set({
          extractedText: extracted.text,
          extractedTextLength: extracted.text.length,
          summary,
          searchVector,
          language,
          indexStatus: 'indexed',
          indexError: null,
          indexedBy: agentName,
          lastAccessedAt: new Date(),
          accessCount: sql`${documentIndex.accessCount} + 1`,
          ...(options?.projectId && { projectId: options.projectId }),
          ...(options?.consultantId && { consultantId: options.consultantId }),
          ...(options?.category && { category: options.category }),
        })
        .where(eq(documentIndex.id, existing[0].id));

      return { success: true, documentId: existing[0].id };
    } else {
      // Insert new record
      const [result] = await db.insert(documentIndex).values({
        sourceType: 'google_drive',
        sourceId: fileId,
        sourcePath: options?.sourcePath || null,
        sourceName: extracted.fileName,
        fileType: extracted.fileType as any,
        mimeType: extracted.mimeType,
        fileSizeBytes: null,
        extractedText: extracted.text,
        extractedTextLength: extracted.text.length,
        summary,
        category: options?.category || null,
        projectId: options?.projectId || null,
        consultantId: options?.consultantId || null,
        language,
        indexStatus: 'indexed',
        indexedBy: agentName,
        searchVector,
        lastAccessedAt: new Date(),
        accessCount: 1,
      });

      // Log the indexing activity
      await logActivity({
        agentName,
        actionType: 'analysis',
        toolName: 'index_document',
        inputSummary: `فهرسة ملف: ${extracted.fileName} (${fileId})`,
        outputSummary: `تم فهرسة ${extracted.text.length} حرف، النوع: ${extracted.fileType}`,
        status: 'success',
        userId,
        relatedEntityType: 'document',
        relatedEntityId: result.insertId,
      });

      return { success: true, documentId: result.insertId };
    }
  } catch (err: any) {
    console.error("[DocIndex] indexDriveFile error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * فهرسة محتوى نصي مباشر (من إيميل، تقرير وكيل، إلخ)
 */
export async function indexTextContent(
  text: string,
  sourceName: string,
  sourceType: 'email_attachment' | 'upload' | 'agent_output',
  agentName: string,
  options?: {
    sourceId?: string;
    sourcePath?: string;
    projectId?: number;
    consultantId?: number;
    category?: string;
    fileType?: string;
    mimeType?: string;
  }
): Promise<{ success: boolean; documentId?: number; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "قاعدة البيانات غير متاحة" };

  try {
    const searchVector = generateSearchVector(text, sourceName);
    const language = detectLanguage(text);
    let summary: string | null = null;
    
    if (text.length > 200) {
      try {
        summary = await generateDocumentSummary(text, sourceName);
      } catch (err) {
        console.warn("[DocIndex] Summary generation failed:", err);
      }
    }

    const [result] = await db.insert(documentIndex).values({
      sourceType,
      sourceId: options?.sourceId || null,
      sourcePath: options?.sourcePath || null,
      sourceName,
      fileType: (options?.fileType || 'text') as any,
      mimeType: options?.mimeType || 'text/plain',
      extractedText: text,
      extractedTextLength: text.length,
      summary,
      category: options?.category || null,
      projectId: options?.projectId || null,
      consultantId: options?.consultantId || null,
      language,
      indexStatus: 'indexed',
      indexedBy: agentName,
      searchVector,
      lastAccessedAt: new Date(),
      accessCount: 1,
    });

    return { success: true, documentId: result.insertId };
  } catch (err: any) {
    console.error("[DocIndex] indexTextContent error:", err);
    return { success: false, error: err.message };
  }
}

// ═══════════════════════════════════════════════════
// Search Operations
// ═══════════════════════════════════════════════════

/**
 * بحث في المستندات المفهرسة
 * يبحث في النص المستخرج والملخص والكلمات المفتاحية واسم الملف
 */
export async function searchDocuments(
  query: string,
  options?: {
    projectId?: number;
    consultantId?: number;
    category?: string;
    fileType?: string;
    limit?: number;
  }
): Promise<Array<{
  id: number;
  sourceName: string;
  sourceType: string;
  sourceId: string | null;
  fileType: string;
  category: string | null;
  summary: string | null;
  extractedTextLength: number | null;
  relevanceSnippet: string;
  projectId: number | null;
  consultantId: number | null;
  indexedBy: string | null;
  createdAt: Date;
}>> {
  const db = await getDb();
  if (!db) return [];

  const conditions: any[] = [eq(documentIndex.indexStatus, 'indexed')];
  
  if (options?.projectId) {
    conditions.push(eq(documentIndex.projectId, options.projectId));
  }
  if (options?.consultantId) {
    conditions.push(eq(documentIndex.consultantId, options.consultantId));
  }
  if (options?.category) {
    conditions.push(eq(documentIndex.category, options.category));
  }
  if (options?.fileType) {
    conditions.push(eq(documentIndex.fileType, options.fileType as any));
  }

  // Search in multiple fields
  const searchTerms = query.split(/\s+/).filter(t => t.length > 1);
  if (searchTerms.length > 0) {
    const searchConditions = searchTerms.map(term => 
      or(
        like(documentIndex.sourceName, `%${term}%`),
        like(documentIndex.searchVector, `%${term}%`),
        like(documentIndex.summary, `%${term}%`),
        like(documentIndex.extractedText, `%${term}%`)
      )
    );
    conditions.push(...searchConditions);
  }

  const results = await db.select({
    id: documentIndex.id,
    sourceName: documentIndex.sourceName,
    sourceType: documentIndex.sourceType,
    sourceId: documentIndex.sourceId,
    fileType: documentIndex.fileType,
    category: documentIndex.category,
    summary: documentIndex.summary,
    extractedTextLength: documentIndex.extractedTextLength,
    extractedText: documentIndex.extractedText,
    projectId: documentIndex.projectId,
    consultantId: documentIndex.consultantId,
    indexedBy: documentIndex.indexedBy,
    createdAt: documentIndex.createdAt,
  })
    .from(documentIndex)
    .where(and(...conditions))
    .orderBy(desc(documentIndex.lastAccessedAt))
    .limit(options?.limit || 10);

  // Generate relevance snippets
  return results.map(r => {
    let relevanceSnippet = '';
    if (r.extractedText) {
      // Find the most relevant part of the text
      const lowerText = r.extractedText.toLowerCase();
      const lowerQuery = query.toLowerCase();
      const idx = lowerText.indexOf(lowerQuery);
      if (idx >= 0) {
        const start = Math.max(0, idx - 100);
        const end = Math.min(r.extractedText.length, idx + query.length + 100);
        relevanceSnippet = (start > 0 ? '...' : '') + r.extractedText.substring(start, end) + (end < r.extractedText.length ? '...' : '');
      } else {
        // Use first 200 chars
        relevanceSnippet = r.extractedText.substring(0, 200) + (r.extractedText.length > 200 ? '...' : '');
      }
    }

    // Update access count asynchronously
    db.update(documentIndex)
      .set({ 
        lastAccessedAt: new Date(),
        accessCount: sql`${documentIndex.accessCount} + 1`
      })
      .where(eq(documentIndex.id, r.id))
      .catch(() => {});

    return {
      id: r.id,
      sourceName: r.sourceName,
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      fileType: r.fileType,
      category: r.category,
      summary: r.summary,
      extractedTextLength: r.extractedTextLength,
      relevanceSnippet,
      projectId: r.projectId,
      consultantId: r.consultantId,
      indexedBy: r.indexedBy,
      createdAt: r.createdAt,
    };
  });
}

/**
 * جلب المحتوى الكامل لمستند مفهرس
 */
export async function getDocumentContent(documentId: number): Promise<{
  id: number;
  sourceName: string;
  extractedText: string | null;
  structuredData: string | null;
  summary: string | null;
  category: string | null;
  fileType: string;
  sourceType: string;
  sourceId: string | null;
} | null> {
  const db = await getDb();
  if (!db) return null;

  const [doc] = await db.select()
    .from(documentIndex)
    .where(eq(documentIndex.id, documentId))
    .limit(1);

  if (!doc) return null;

  // Update access count
  await db.update(documentIndex)
    .set({ 
      lastAccessedAt: new Date(),
      accessCount: sql`${documentIndex.accessCount} + 1`
    })
    .where(eq(documentIndex.id, documentId));

  return {
    id: doc.id,
    sourceName: doc.sourceName,
    extractedText: doc.extractedText,
    structuredData: doc.structuredData,
    summary: doc.summary,
    category: doc.category,
    fileType: doc.fileType,
    sourceType: doc.sourceType,
    sourceId: doc.sourceId,
  };
}

/**
 * إحصائيات الفهرسة
 */
export async function getIndexStats() {
  const db = await getDb();
  if (!db) return null;

  const stats = await db.select({
    totalDocs: sql<number>`count(*)`,
    indexedDocs: sql<number>`SUM(CASE WHEN ${documentIndex.indexStatus} = 'indexed' THEN 1 ELSE 0 END)`,
    failedDocs: sql<number>`SUM(CASE WHEN ${documentIndex.indexStatus} = 'failed' THEN 1 ELSE 0 END)`,
    pendingDocs: sql<number>`SUM(CASE WHEN ${documentIndex.indexStatus} = 'pending' THEN 1 ELSE 0 END)`,
    totalTextLength: sql<number>`SUM(${documentIndex.extractedTextLength})`,
    totalAccesses: sql<number>`SUM(${documentIndex.accessCount})`,
  })
    .from(documentIndex);

  const byType = await db.select({
    fileType: documentIndex.fileType,
    count: sql<number>`count(*)`,
  })
    .from(documentIndex)
    .groupBy(documentIndex.fileType);

  const byAgent = await db.select({
    indexedBy: documentIndex.indexedBy,
    count: sql<number>`count(*)`,
  })
    .from(documentIndex)
    .where(sql`${documentIndex.indexedBy} IS NOT NULL`)
    .groupBy(documentIndex.indexedBy);

  return {
    ...stats[0],
    byType,
    byAgent,
  };
}

// ═══════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════

/**
 * توليد كلمات مفتاحية للبحث السريع
 */
function generateSearchVector(text: string, fileName: string): string {
  const words = new Set<string>();
  
  // Add filename parts
  fileName.replace(/[._-]/g, ' ').split(/\s+/).forEach(w => {
    if (w.length > 1) words.add(w.toLowerCase());
  });

  // Extract key terms from text (first 5000 chars)
  const sample = text.substring(0, 5000);
  
  // Arabic and English word extraction
  const textWords = sample.match(/[\u0600-\u06FF]+|[a-zA-Z]+/g) || [];
  textWords.forEach(w => {
    if (w.length > 2) words.add(w.toLowerCase());
  });

  // Extract numbers that look like IDs, amounts, areas
  const numbers = sample.match(/\d{4,}/g) || [];
  numbers.forEach(n => words.add(n));

  return Array.from(words).slice(0, 200).join(' ');
}

/**
 * كشف لغة النص
 */
function detectLanguage(text: string): string {
  const sample = text.substring(0, 500);
  const arabicChars = (sample.match(/[\u0600-\u06FF]/g) || []).length;
  const englishChars = (sample.match(/[a-zA-Z]/g) || []).length;
  
  if (arabicChars > englishChars * 2) return 'ar';
  if (englishChars > arabicChars * 2) return 'en';
  return 'mixed';
}

/**
 * توليد ملخص AI للمستند
 */
async function generateDocumentSummary(text: string, fileName: string): Promise<string | null> {
  try {
    // Use first 3000 chars for summary
    const sample = text.substring(0, 3000);
    
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "أنت مساعد متخصص في تلخيص المستندات العقارية والهندسية. لخّص المستند التالي في 2-3 جمل مركزة. اذكر: نوع المستند، الأطراف المعنية، والمعلومات الرئيسية (مساحات، أسعار، مواعيد، شروط). أجب بالعربية."
        },
        {
          role: "user",
          content: `اسم الملف: ${fileName}\n\nالمحتوى:\n${sample}`
        }
      ]
    });

    const content = response.choices?.[0]?.message?.content;
    return typeof content === 'string' ? content.substring(0, 1000) : null;
  } catch (err) {
    console.warn("[DocIndex] Summary generation failed:", err);
    return null;
  }
}
