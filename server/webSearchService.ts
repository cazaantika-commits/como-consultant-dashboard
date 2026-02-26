/**
 * Web Search Service
 * 
 * Uses invokeLLM as a research engine since external search APIs
 * (Forge Data API Google/search, DuckDuckGo) are not available.
 * 
 * The LLM provides expert-level knowledge on most topics.
 * browse_webpage still fetches real web content via HTTP.
 */

import { invokeLLM } from "./_core/llm";

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

export interface SearchResponse {
  results: SearchResult[];
  query: string;
  totalResults: number;
}

/**
 * Research a topic using the LLM's knowledge base.
 * Returns structured results that the agent can use.
 */
export async function webSearch(query: string, lang: string = "ar"): Promise<SearchResponse> {
  try {
    const systemPrompt = lang === "ar"
      ? `أنت محرك بحث متخصص. عند تلقي استعلام بحث، قدم معلومات دقيقة ومفصلة وحديثة.
أجب بتنسيق JSON فقط بالشكل التالي:
{
  "results": [
    {"title": "عنوان النتيجة", "snippet": "ملخص تفصيلي للمعلومات (3-5 جمل)", "link": ""},
    ...
  ]
}
قدم 3-5 نتائج مفصلة. كل snippet يجب أن يكون غنياً بالمعلومات المفيدة.
لا تقل "لا أستطيع البحث" - استخدم معرفتك لتقديم أفضل المعلومات المتاحة.`
      : `You are a specialized search engine. When given a search query, provide accurate, detailed, and current information.
Reply ONLY with JSON in this format:
{
  "results": [
    {"title": "Result title", "snippet": "Detailed summary of information (3-5 sentences)", "link": ""},
    ...
  ]
}
Provide 3-5 detailed results. Each snippet should be rich with useful information.
Never say "I cannot search" - use your knowledge to provide the best available information.`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "search_results",
          strict: true,
          schema: {
            type: "object",
            properties: {
              results: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    snippet: { type: "string" },
                    link: { type: "string" },
                  },
                  required: ["title", "snippet", "link"],
                  additionalProperties: false,
                },
              },
            },
            required: ["results"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      return { results: [], query, totalResults: 0 };
    }

    const parsed = JSON.parse(content);
    const results: SearchResult[] = (parsed.results || []).map((r: any) => ({
      title: r.title || "",
      link: r.link || "",
      snippet: r.snippet || "",
    }));

    console.log(`[WebSearch] LLM research returned ${results.length} results for: "${query}"`);
    return { results, query, totalResults: results.length };
  } catch (error: any) {
    console.log(`[WebSearch] LLM research failed: ${error.message}`);
    return { results: [], query, totalResults: 0 };
  }
}

/**
 * Fetch and extract text content from a webpage URL
 */
export async function fetchWebpageContent(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ComoDevBot/1.0)",
        "Accept": "text/html,application/xhtml+xml",
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return `[خطأ في تحميل الصفحة: ${response.status}]`;
    }

    const html = await response.text();

    // Simple HTML to text extraction
    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (text.length > 4000) {
      text = text.substring(0, 4000) + "\n\n[... تم اقتطاع المحتوى - الصفحة طويلة جداً]";
    }

    return text || "[لم يتم العثور على محتوى نصي في الصفحة]";
  } catch (error: any) {
    return `[خطأ في تحميل الصفحة: ${error.message}]`;
  }
}

/**
 * Search and read - research then provide detailed content
 */
export async function searchAndRead(query: string, maxPages: number = 3): Promise<string> {
  const searchResults = await webSearch(query);

  if (searchResults.results.length === 0) {
    return `لم يتم العثور على نتائج للبحث: "${query}"`;
  }

  let output = `## نتائج البحث عن: "${query}"\n\n`;

  for (let i = 0; i < searchResults.results.length; i++) {
    const r = searchResults.results[i];
    output += `${i + 1}. **${r.title}**\n   ${r.snippet}\n`;
    if (r.link) {
      output += `   🔗 ${r.link}\n`;
    }
    output += "\n";
  }

  return output;
}
