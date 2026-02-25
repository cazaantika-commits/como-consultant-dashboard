/**
 * Web Search Service - خدمة البحث في الإنترنت للوكلاء
 * 
 * يستخدم Google Search عبر SerpAPI أو مباشرة عبر fetch
 * لتمكين الوكلاء من البحث في الإنترنت والحصول على معلومات محدّثة
 */

import { ENV } from "./_core/env";

interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

interface SearchResponse {
  results: SearchResult[];
  query: string;
  totalResults: number;
}

/**
 * Search the web using Google Custom Search via the forge data API
 */
async function searchViaForgeDataApi(query: string, lang: string = "ar"): Promise<SearchResponse> {
  const baseUrl = ENV.forgeApiUrl.endsWith("/") ? ENV.forgeApiUrl : `${ENV.forgeApiUrl}/`;
  const fullUrl = new URL("webdevtoken.v1.WebDevService/CallApi", baseUrl).toString();

  const response = await fetch(fullUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "connect-protocol-version": "1",
      authorization: `Bearer ${ENV.forgeApiKey}`,
    },
    body: JSON.stringify({
      apiId: "Google/search",
      query: { q: query, gl: "AE", hl: lang, num: "8" },
    }),
  });

  if (response.ok) {
    const payload = await response.json();
    let data: any;
    if (payload && typeof payload === "object" && "jsonData" in payload) {
      try {
        data = JSON.parse((payload as any).jsonData ?? "{}");
      } catch {
        data = (payload as any).jsonData;
      }
    } else {
      data = payload;
    }

    // Parse Google search results
    const items = data?.organic_results || data?.items || data?.results || [];
    return {
      results: items.slice(0, 8).map((item: any) => ({
        title: item.title || "",
        link: item.link || item.url || "",
        snippet: item.snippet || item.description || "",
      })),
      query,
      totalResults: items.length,
    };
  }

  // Fallback: try direct fetch approach
  throw new Error(`Forge Data API search failed: ${response.status}`);
}

/**
 * Search the web using a simple scraping approach as fallback
 */
async function searchViaDirectFetch(query: string): Promise<SearchResponse> {
  // Use DuckDuckGo instant answer API (no API key needed)
  const encodedQuery = encodeURIComponent(query);
  const response = await fetch(
    `https://api.duckduckgo.com/?q=${encodedQuery}&format=json&no_html=1&skip_disambig=1`,
    { headers: { "User-Agent": "ComoDevBot/1.0" } }
  );

  if (!response.ok) {
    throw new Error(`DuckDuckGo API failed: ${response.status}`);
  }

  const data = await response.json() as any;
  const results: SearchResult[] = [];

  // Abstract (main answer)
  if (data.Abstract) {
    results.push({
      title: data.Heading || query,
      link: data.AbstractURL || "",
      snippet: data.Abstract,
    });
  }

  // Related topics
  if (data.RelatedTopics) {
    for (const topic of data.RelatedTopics.slice(0, 7)) {
      if (topic.Text) {
        results.push({
          title: topic.Text?.substring(0, 100) || "",
          link: topic.FirstURL || "",
          snippet: topic.Text || "",
        });
      }
    }
  }

  return { results, query, totalResults: results.length };
}

/**
 * Fetch and extract text content from a webpage URL
 */
async function fetchWebpageContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ComoDevBot/1.0)",
        "Accept": "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (!response.ok) {
      return `[خطأ في تحميل الصفحة: ${response.status}]`;
    }

    const html = await response.text();
    
    // Simple HTML to text extraction
    let text = html
      // Remove scripts and styles
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      // Remove HTML tags
      .replace(/<[^>]+>/g, " ")
      // Decode common HTML entities
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      // Clean up whitespace
      .replace(/\s+/g, " ")
      .trim();

    // Limit to first 4000 chars to avoid overwhelming the LLM
    if (text.length > 4000) {
      text = text.substring(0, 4000) + "\n\n[... تم اقتطاع المحتوى - الصفحة طويلة جداً]";
    }

    return text || "[لم يتم العثور على محتوى نصي في الصفحة]";
  } catch (error: any) {
    return `[خطأ في تحميل الصفحة: ${error.message}]`;
  }
}

/**
 * Main search function - tries forge API first, then fallback
 */
export async function webSearch(query: string, lang: string = "ar"): Promise<SearchResponse> {
  // Try forge data API first
  try {
    const result = await searchViaForgeDataApi(query, lang);
    if (result.results.length > 0) {
      return result;
    }
  } catch (e: any) {
    console.log(`[WebSearch] Forge API failed: ${e.message}, trying fallback...`);
  }

  // Fallback to DuckDuckGo
  try {
    return await searchViaDirectFetch(query);
  } catch (e: any) {
    console.log(`[WebSearch] DuckDuckGo failed: ${e.message}`);
  }

  // Last resort: use LLM's own knowledge
  return {
    results: [],
    query,
    totalResults: 0,
  };
}

/**
 * Search and read - search then fetch content from top results
 */
export async function searchAndRead(query: string, maxPages: number = 3): Promise<string> {
  const searchResults = await webSearch(query);
  
  if (searchResults.results.length === 0) {
    return `لم يتم العثور على نتائج للبحث: "${query}"`;
  }

  let output = `## نتائج البحث عن: "${query}"\n\n`;
  
  // Add search result summaries
  for (let i = 0; i < searchResults.results.length; i++) {
    const r = searchResults.results[i];
    output += `${i + 1}. **${r.title}**\n   ${r.snippet}\n   🔗 ${r.link}\n\n`;
  }

  // Fetch content from top pages
  const pagesToFetch = searchResults.results.slice(0, maxPages).filter(r => r.link);
  if (pagesToFetch.length > 0) {
    output += `\n---\n## محتوى تفصيلي من أهم النتائج:\n\n`;
    
    const fetchPromises = pagesToFetch.map(async (r, i) => {
      const content = await fetchWebpageContent(r.link);
      return `### ${i + 1}. ${r.title}\n${r.link}\n\n${content}\n\n`;
    });

    const contents = await Promise.all(fetchPromises);
    output += contents.join("\n---\n");
  }

  return output;
}
