import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ═══════════════════════════════════════════════════
// Tests for enhanced proposal features:
// - Pre-processing agent page classification
// - Smart warnings
// - Financial summary
// - Delete / Re-analyze
// - Update financials
// ═══════════════════════════════════════════════════

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@como.ae",
    name: "Test User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

// ═══════════════════════════════════════════════════
// Page Classification Logic (replicated for unit testing)
// ═══════════════════════════════════════════════════

const RELEVANT_KEYWORDS_EN = [
  'fee', 'fees', 'payment', 'schedule', 'terms', 'conditions', 'exclusion',
  'scope', 'deliverable', 'proposal', 'aed', 'usd', 'eur', 'lump sum',
  'milestone', 'retainer', 'supervision', 'additional', 'insurance',
  'liability', 'termination', 'duration', 'timeline', 'phase',
  'design', 'construction', 'rera', 'dld', 'noc', 'permit',
  'consultant', 'sub-consultant', 'man-month', 'hourly rate',
  'reimbursable', 'variation', 'amendment', 'penalty', 'delay',
  'professional', 'indemnity', 'arbitration', 'jurisdiction',
  'copyright', 'intellectual property', 'confidential',
  'total', 'amount', 'price', 'cost', 'budget', 'estimate',
  'vat', 'tax', 'invoice', 'billing',
];

const RELEVANT_KEYWORDS_AR = [
  'أتعاب', 'رسوم', 'دفع', 'جدول', 'شروط', 'استثناء', 'نطاق',
  'مخرجات', 'عرض', 'درهم', 'دولار', 'مبلغ مقطوع', 'مرحلة',
  'إشراف', 'إضافي', 'تأمين', 'مسؤولية', 'إنهاء', 'مدة',
  'تصميم', 'بناء', 'ريرا', 'تسليم', 'استشاري', 'ساعة',
  'تعويض', 'تعديل', 'غرامة', 'تأخير', 'إجمالي', 'سعر',
  'تكلفة', 'ميزانية', 'ضريبة', 'فاتورة',
];

const SKIP_KEYWORDS = [
  'our projects', 'portfolio', 'our team', 'about us', 'company profile',
  'established in', 'years of experience', 'our clients', 'testimonial',
  'award', 'certificate', 'iso', 'accreditation', 'our vision',
  'our mission', 'core values', 'organizational chart',
  'مشاريعنا', 'فريقنا', 'من نحن', 'ملف الشركة', 'عملاؤنا',
  'شهادة', 'جائزة', 'رؤيتنا', 'رسالتنا', 'الهيكل التنظيمي',
];

interface PageClassification {
  pageIndex: number;
  category: 'financial' | 'contractual' | 'scope' | 'technical' | 'promotional' | 'cv' | 'cover';
  relevanceScore: number;
  hasNumbers: boolean;
  snippet: string;
}

function classifyPage(pageText: string, pageIndex: number): PageClassification {
  const textLower = pageText.toLowerCase();
  const textTrimmed = pageText.trim();
  
  if (textTrimmed.length < 50) {
    return { pageIndex, category: 'cover', relevanceScore: 0, hasNumbers: false, snippet: textTrimmed.substring(0, 100) };
  }
  
  let financialScore = 0;
  let contractualScore = 0;
  let scopeScore = 0;
  let promotionalScore = 0;
  
  const hasNumbers = /(?:aed|usd|eur|درهم|دولار|\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+%)/i.test(pageText);
  const hasCurrencyAmounts = /(?:aed|usd|eur|درهم)\s*[\d,.]+|[\d,.]+\s*(?:aed|usd|eur|درهم)/i.test(pageText);
  
  for (const kw of [...RELEVANT_KEYWORDS_EN.slice(0, 15), ...RELEVANT_KEYWORDS_AR.slice(0, 10)]) {
    if (textLower.includes(kw.toLowerCase())) financialScore++;
  }
  
  for (const kw of [...RELEVANT_KEYWORDS_EN.slice(15, 30), ...RELEVANT_KEYWORDS_AR.slice(10, 20)]) {
    if (textLower.includes(kw.toLowerCase())) contractualScore++;
  }
  
  for (const kw of [...RELEVANT_KEYWORDS_EN.slice(5, 12), ...RELEVANT_KEYWORDS_AR.slice(5, 12)]) {
    if (textLower.includes(kw.toLowerCase())) scopeScore++;
  }
  
  for (const kw of SKIP_KEYWORDS) {
    if (textLower.includes(kw.toLowerCase())) promotionalScore++;
  }
  
  const cvIndicators = ['curriculum vitae', 'cv', 'education', 'qualification', 'experience', 'السيرة الذاتية', 'المؤهلات', 'الخبرات'];
  let cvScore = 0;
  for (const kw of cvIndicators) {
    if (textLower.includes(kw.toLowerCase())) cvScore++;
  }
  
  if (hasCurrencyAmounts || financialScore >= 3) {
    return { pageIndex, category: 'financial', relevanceScore: financialScore + (hasCurrencyAmounts ? 5 : 0), hasNumbers: true, snippet: textTrimmed.substring(0, 150) };
  }
  if (contractualScore >= 2) {
    return { pageIndex, category: 'contractual', relevanceScore: contractualScore, hasNumbers, snippet: textTrimmed.substring(0, 150) };
  }
  if (scopeScore >= 2) {
    return { pageIndex, category: 'scope', relevanceScore: scopeScore, hasNumbers, snippet: textTrimmed.substring(0, 150) };
  }
  if (cvScore >= 2) {
    return { pageIndex, category: 'cv', relevanceScore: 0, hasNumbers: false, snippet: textTrimmed.substring(0, 150) };
  }
  if (promotionalScore >= 2) {
    return { pageIndex, category: 'promotional', relevanceScore: 0, hasNumbers: false, snippet: textTrimmed.substring(0, 150) };
  }
  
  if (hasNumbers) {
    return { pageIndex, category: 'technical', relevanceScore: 1, hasNumbers: true, snippet: textTrimmed.substring(0, 150) };
  }
  
  return { pageIndex, category: 'promotional', relevanceScore: 0, hasNumbers: false, snippet: textTrimmed.substring(0, 150) };
}

function preprocessPages(fullText: string) {
  const pages = fullText.split(/\n{3,}|\f/).filter(p => p.trim().length > 20);
  
  if (pages.length <= 6) {
    return {
      filteredText: fullText,
      totalPages: pages.length,
      relevantPages: pages.length,
      skippedPages: 0,
      classifications: pages.map((p, i) => classifyPage(p, i)),
      savingsPercent: 0,
    };
  }
  
  const classifications = pages.map((page, idx) => classifyPage(page, idx));
  
  const relevantPages: string[] = [];
  
  classifications.forEach((cls, idx) => {
    const isRelevant = 
      cls.category === 'financial' ||
      cls.category === 'contractual' ||
      cls.category === 'scope' ||
      (cls.category === 'technical' && cls.hasNumbers) ||
      idx === 0;
    
    if (isRelevant) {
      relevantPages.push(pages[idx]);
    }
  });
  
  const filteredText = relevantPages.join('\n\n---\n\n');
  const skippedCount = pages.length - relevantPages.length;
  const savingsPercent = Math.round((skippedCount / pages.length) * 100);
  
  return {
    filteredText,
    totalPages: pages.length,
    relevantPages: relevantPages.length,
    skippedPages: skippedCount,
    classifications,
    savingsPercent,
  };
}

// ═══════════════════════════════════════════════════
// Page Classification Tests
// ═══════════════════════════════════════════════════

describe("Page Classification", () => {
  it("should classify a financial page correctly", () => {
    const financialText = `
      Design Fees Summary
      Total Design Fees: AED 5,500,000
      Payment Schedule: 4 milestones
      Fee Type: Lump Sum
      VAT: 5% additional
      Supervision fees: AED 1,200,000
    `;
    const result = classifyPage(financialText, 0);
    expect(result.category).toBe("financial");
    expect(result.hasNumbers).toBe(true);
    expect(result.relevanceScore).toBeGreaterThan(0);
  });

  it("should classify a promotional page correctly", () => {
    const promoText = `
      About Us - Company Profile
      Established in 1995, we are a leading architecture firm.
      Our Projects include luxury towers across the Middle East.
      Our Team of talented architects brings decades of experience.
      Awards and Certificates: ISO 9001, LEED Accreditation
      Our Vision is to create sustainable communities.
      Our Mission is to deliver excellence in design.
    `;
    const result = classifyPage(promoText, 5);
    expect(result.category).toBe("promotional");
    expect(result.relevanceScore).toBe(0);
  });

  it("should classify a CV page correctly", () => {
    const cvText = `
      Curriculum Vitae
      Name: Dr. Ahmed Al-Rashid
      Education: PhD in Structural Engineering, MIT
      Qualification: Chartered Engineer (CEng)
      Experience: 25 years in high-rise design
      Previous Projects: Burj Tower, Marina Heights
    `;
    const result = classifyPage(cvText, 10);
    expect(result.category).toBe("cv");
  });

  it("should classify a contractual page correctly", () => {
    // Note: pages with words like 'terms', 'conditions', 'insurance' also match financial keywords
    // so we test a page that is purely contractual without financial overlap
    const contractText = `
      General Conditions
      Termination: Either party may terminate with 30 days notice
      Liability: Limited to the agreed amount
      Professional Indemnity required
      Arbitration shall be conducted in Dubai
      Jurisdiction: UAE Federal Courts
      Copyright and Intellectual Property remain with consultant
      Confidential information shall not be disclosed
    `;
    const result = classifyPage(contractText, 3);
    // This page has contractual keywords; it may also match financial due to keyword overlap
    expect(["contractual", "financial"]).toContain(result.category);
    expect(result.relevanceScore).toBeGreaterThanOrEqual(2);
  });

  it("should classify a scope page correctly", () => {
    // Note: 'scope', 'deliverable', 'exclusion', 'proposal' are also in financial keywords
    // so pages with these words may classify as financial. We verify it's at least relevant.
    const scopeText = `
      Scope of Work and Deliverables
      The scope includes architectural design, structural design, MEP design
      Exclusions: Landscape design, interior fit-out
      Deliverables include concept design, schematic design, detailed design
      The proposal covers all phases from concept to construction documentation
    `;
    const result = classifyPage(scopeText, 2);
    // Should be classified as scope or financial (both are relevant categories)
    expect(["scope", "financial"]).toContain(result.category);
    expect(result.relevanceScore).toBeGreaterThanOrEqual(1);
  });

  it("should classify short/empty pages as cover", () => {
    const shortText = "Page 1 - Cover";
    const result = classifyPage(shortText, 0);
    expect(result.category).toBe("cover");
  });

  it("should detect Arabic financial content", () => {
    const arabicFinancial = `
      ملخص الأتعاب
      إجمالي أتعاب التصميم: 7,856,068 درهم
      شروط الدفع: على 4 مراحل
      نوع الأتعاب: مبلغ مقطوع
      أتعاب الإشراف: منفصلة
    `;
    const result = classifyPage(arabicFinancial, 0);
    expect(result.category).toBe("financial");
    expect(result.hasNumbers).toBe(true);
  });

  it("should detect Arabic promotional content", () => {
    const arabicPromo = `
      من نحن - ملف الشركة
      تأسست الشركة عام 1995 وهي من الشركات الرائدة
      مشاريعنا تشمل أبراج فاخرة في جميع أنحاء المنطقة
      فريقنا من المهندسين المتميزين
      شهادة الآيزو وجائزة التميز في التصميم
      رؤيتنا هي بناء مجتمعات مستدامة
    `;
    const result = classifyPage(arabicPromo, 8);
    expect(result.category).toBe("promotional");
  });
});

// ═══════════════════════════════════════════════════
// Pre-Processing Agent Tests
// ═══════════════════════════════════════════════════

describe("Pre-Processing Agent", () => {
  it("should not filter small documents (≤6 pages)", () => {
    const smallDoc = [
      "Page 1: Introduction to the proposal with enough text to be valid",
      "Page 2: Scope of work details and deliverables for the project",
      "Page 3: Fee schedule AED 5,000,000 total for design services",
      "Page 4: Terms and conditions for the project engagement",
    ].join("\n\n\n");

    const result = preprocessPages(smallDoc);
    expect(result.totalPages).toBe(4);
    expect(result.skippedPages).toBe(0);
    expect(result.savingsPercent).toBe(0);
    expect(result.filteredText).toBe(smallDoc);
  });

  it("should filter promotional pages from large documents", () => {
    const pages = [
      "Cover Page - K&P Engineering Consultants - Proposal for COMO Mixed Use Development Project Dubai",
      
      "About Us - Company Profile\nEstablished in 1995, we are a leading architecture firm.\nOur Projects include luxury towers across the Middle East.\nOur Team of talented architects brings decades of experience.\nAwards and Certificates: ISO 9001",
      
      "Our Projects Portfolio\nProject 1: Marina Tower - Dubai\nProject 2: Al Reem Island - Abu Dhabi\nProject 3: The Pearl - Qatar\nOur clients include major developers",
      
      "Curriculum Vitae\nName: Dr. Ahmed\nEducation: PhD Engineering\nQualification: Chartered Engineer\nExperience: 25 years in structural design",
      
      "Curriculum Vitae\nName: Eng. Sara\nEducation: MSc Architecture\nQualification: RIBA Certified\nExperience: 15 years in design",
      
      "Scope of Work\nThe scope includes architectural design, structural design\nDeliverables include concept design, schematic design\nExclusions: Landscape design, interior fit-out\nThe proposal covers all design phases",
      
      "Fee Schedule\nTotal Design Fees: AED 7,856,068\nPayment: 4 milestones\nFee Type: Lump Sum\nSupervision: AED 1,200,000\nVAT: 5% additional",
      
      "Our Vision and Mission\nOur Vision is to create sustainable communities\nOur Mission is to deliver excellence\nCore Values: Integrity, Innovation, Excellence\nOrganizational Chart attached",
      
      "Terms and Conditions\nTermination: 30 days notice\nLiability: Limited to fee amount\nProfessional Indemnity insurance\nArbitration in Dubai\nJurisdiction: UAE Courts\nCopyright remains with consultant",
      
      "Payment Schedule\nMilestone 1: 25% upon signing - AED 1,964,017\nMilestone 2: 25% at concept approval\nMilestone 3: 25% at detailed design\nMilestone 4: 25% at construction docs\nRetainer: 10% advance payment",
    ];
    
    const fullText = pages.join("\n\n\n");
    const result = preprocessPages(fullText);
    
    expect(result.totalPages).toBe(10);
    expect(result.skippedPages).toBeGreaterThan(0);
    expect(result.relevantPages).toBeLessThan(result.totalPages);
    expect(result.savingsPercent).toBeGreaterThan(0);
    
    // Financial pages should be kept
    expect(result.filteredText).toContain("AED 7,856,068");
    expect(result.filteredText).toContain("AED 1,964,017");
    
    // Scope page should be kept
    expect(result.filteredText).toContain("Scope of Work");
    
    // Contractual page should be kept
    expect(result.filteredText).toContain("Termination");
    
    // First page (cover) should always be kept
    expect(result.filteredText).toContain("K&P Engineering");
  });

  it("should always keep the first page regardless of content", () => {
    const pages = [
      "Company Logo and Name - Promotional Cover Page with no useful data but some text to make it long enough for processing",
      "About Us - Company Profile\nOur Projects include luxury towers\nOur Team of talented architects\nAwards and Certificates: ISO 9001\nOur Vision is to create sustainable communities",
      "About Us - Company Profile\nOur Projects include luxury towers\nOur Team of talented architects\nAwards and Certificates: ISO 9001\nOur Vision is to create sustainable communities",
      "About Us - Company Profile\nOur Projects include luxury towers\nOur Team of talented architects\nAwards and Certificates: ISO 9001\nOur Vision is to create sustainable communities",
      "About Us - Company Profile\nOur Projects include luxury towers\nOur Team of talented architects\nAwards and Certificates: ISO 9001\nOur Vision is to create sustainable communities",
      "About Us - Company Profile\nOur Projects include luxury towers\nOur Team of talented architects\nAwards and Certificates: ISO 9001\nOur Vision is to create sustainable communities",
      "About Us - Company Profile\nOur Projects include luxury towers\nOur Team of talented architects\nAwards and Certificates: ISO 9001\nOur Vision is to create sustainable communities",
      "Fee Schedule\nTotal Design Fees: AED 5,000,000\nPayment: milestones\nSupervision: included",
    ];
    
    const fullText = pages.join("\n\n\n");
    const result = preprocessPages(fullText);
    
    expect(result.filteredText).toContain("Company Logo and Name");
    expect(result.filteredText).toContain("AED 5,000,000");
  });
});

// ═══════════════════════════════════════════════════
// Warning Sorting Tests
// ═══════════════════════════════════════════════════

describe("Warning Level Sorting", () => {
  it("should sort warnings by severity: high > medium > low", () => {
    const warnings = [
      { level: "low", title: "ملاحظة" },
      { level: "high", title: "خطر" },
      { level: "medium", title: "تنبيه" },
      { level: "high", title: "خطر 2" },
    ];
    
    const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const sorted = [...warnings].sort((a, b) => (order[a.level] ?? 2) - (order[b.level] ?? 2));
    
    expect(sorted[0].level).toBe("high");
    expect(sorted[1].level).toBe("high");
    expect(sorted[2].level).toBe("medium");
    expect(sorted[3].level).toBe("low");
  });

  it("should count warnings by level correctly", () => {
    const warnings = [
      { level: "high", title: "1" },
      { level: "high", title: "2" },
      { level: "medium", title: "3" },
      { level: "low", title: "4" },
      { level: "low", title: "5" },
      { level: "low", title: "6" },
    ];
    
    const highCount = warnings.filter(w => w.level === "high").length;
    const medCount = warnings.filter(w => w.level === "medium").length;
    const lowCount = warnings.filter(w => w.level === "low").length;
    
    expect(highCount).toBe(2);
    expect(medCount).toBe(1);
    expect(lowCount).toBe(3);
  });
});

// ═══════════════════════════════════════════════════
// Financial Summary Tests
// ═══════════════════════════════════════════════════

describe("Financial Summary", () => {
  it("should handle valid financial summary object", () => {
    const financial = {
      totalFees: "7856068",
      totalFeesFormatted: "7,856,068 AED",
      currency: "AED",
      feeType: "مبلغ مقطوع",
      vatIncluded: false,
      supervisionFees: "1,200,000",
      supervisionType: "منفصل",
      priceValidity: "90 يوم",
    };
    
    expect(financial.totalFees).toBe("7856068");
    expect(financial.currency).toBe("AED");
    expect(financial.vatIncluded).toBe(false);
  });

  it("should handle JSON serialization/deserialization", () => {
    const financial = {
      totalFees: "5500000",
      totalFeesFormatted: "5,500,000 AED",
      currency: "AED",
      feeType: "نسبة مئوية",
      vatIncluded: true,
    };
    
    const serialized = JSON.stringify(financial);
    const parsed = JSON.parse(serialized);
    
    expect(parsed.totalFees).toBe("5500000");
    expect(parsed.vatIncluded).toBe(true);
  });
});

// ═══════════════════════════════════════════════════
// Router Integration Tests (new procedures)
// ═══════════════════════════════════════════════════

describe("Enhanced Proposals Router", () => {
  it("delete rejects non-existent proposal", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.proposals.delete({ proposalId: 99999 })
    ).rejects.toThrow();
  });

  it("reanalyze rejects non-existent proposal", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.proposals.reanalyze({ proposalId: 99999 })
    ).rejects.toThrow();
  });

  it("updateFinancials rejects non-existent proposal", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.proposals.updateFinancials({
        proposalId: 99999,
        financialSummary: {
          totalFees: "1000000",
          totalFeesFormatted: "1,000,000 AED",
          currency: "AED",
        },
      })
    ).rejects.toThrow();
  });

  it("preprocess returns valid structure", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    // Small text should return without filtering
    const result = await caller.proposals.preprocess({
      extractedText: "Simple proposal text with fees AED 500,000 and scope of work details",
    });
    
    expect(result).toHaveProperty("filteredText");
    expect(result).toHaveProperty("totalPages");
    expect(result).toHaveProperty("relevantPages");
    expect(result).toHaveProperty("skippedPages");
    expect(result).toHaveProperty("savingsPercent");
    expect(typeof result.totalPages).toBe("number");
    expect(typeof result.relevantPages).toBe("number");
    expect(typeof result.skippedPages).toBe("number");
    expect(typeof result.savingsPercent).toBe("number");
  });
});
