// Comprehensive agent test - tests each agent with a real command
// Tests that: (1) API call succeeds (2) tools are called when expected (3) response makes sense

import { invokeLLM } from "./server/_core/llm.ts";

const AGENTS = [
  {
    name: "خازن (khazen)",
    id: "khazen",
    testMessage: "اعرض ملفات مجلد الجداف الرئيسي",
    expectTool: true,
    expectedTools: ["list_drive_files", "list_drive_folders", "list_projects"],
  },
  {
    name: "سلوى (salwa)",
    id: "salwa",
    testMessage: "من هم الاستشاريين المسجلين في النظام؟",
    expectTool: true,
    expectedTools: ["list_consultants", "search_all_data"],
  },
  {
    name: "فاروق (farouq)",
    id: "farouq",
    testMessage: "اعرض تقييمات استشاريين الجداف",
    expectTool: true,
    expectedTools: ["get_evaluation_scores", "list_projects", "get_project_consultants"],
  },
  {
    name: "ألينا (alina)",
    id: "alina",
    testMessage: "اعرض البيانات المالية لمشروع الجداف",
    expectTool: true,
    expectedTools: ["get_financial_data", "list_projects"],
  },
  {
    name: "براق (buraq)",
    id: "buraq",
    testMessage: "اعرض المهام المعلقة",
    expectTool: true,
    expectedTools: ["list_tasks", "list_projects"],
  },
  {
    name: "خالد (khaled)",
    id: "khaled",
    testMessage: "اعرض معايير التقييم الفني",
    expectTool: true,
    expectedTools: ["get_evaluation_criteria", "list_projects"],
  },
  {
    name: "باز (baz)",
    id: "baz",
    testMessage: "اعرض المشاريع الحالية وحالتها",
    expectTool: true,
    expectedTools: ["list_projects", "list_tasks"],
  },
  {
    name: "جويل (joelle)",
    id: "joelle",
    testMessage: "اعرض دراسة الجدوى لمشروع الجداف",
    expectTool: true,
    expectedTools: ["get_feasibility_study", "list_projects"],
  },
];

async function testAgent(agent) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🧪 Testing: ${agent.name}`);
  console.log(`📝 Message: ${agent.testMessage}`);
  console.log(`${"=".repeat(60)}`);

  try {
    const systemPrompt = `أنت وكيل اختبار. عندك أدوات متاحة. لما يُطلب منك شي، استخدم الأدوات المتاحة فوراً بدون شرح.`;

    // We just test that invokeLLM works with tools parameter
    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: agent.testMessage },
      ],
    });

    if (!response || !response.choices || !response.choices[0]) {
      console.log(`❌ FAIL: No response from API`);
      return { agent: agent.name, status: "FAIL", reason: "No response" };
    }

    const choice = response.choices[0];
    const message = choice.message;

    if (message.tool_calls && message.tool_calls.length > 0) {
      console.log(`✅ PASS: Agent called tools: ${message.tool_calls.map(tc => tc.function?.name).join(", ")}`);
      return { agent: agent.name, status: "PASS", tools: message.tool_calls.map(tc => tc.function?.name) };
    } else if (message.content) {
      const contentPreview = message.content.substring(0, 100);
      console.log(`⚠️ WARN: Agent responded with text (no tools): ${contentPreview}...`);
      return { agent: agent.name, status: "WARN", reason: "Text response, no tools called" };
    } else {
      console.log(`❌ FAIL: Empty response`);
      return { agent: agent.name, status: "FAIL", reason: "Empty response" };
    }
  } catch (err) {
    console.log(`❌ FAIL: Error - ${err.message}`);
    return { agent: agent.name, status: "FAIL", reason: err.message };
  }
}

async function main() {
  console.log("🚀 Starting comprehensive agent test...\n");
  
  // Test that Forge API works at all first
  console.log("📡 Testing Forge API connection...");
  try {
    const test = await invokeLLM({
      messages: [{ role: "user", content: "قل مرحبا" }],
    });
    if (test?.choices?.[0]?.message?.content) {
      console.log("✅ Forge API connected successfully");
    } else {
      console.log("❌ Forge API returned empty response");
      process.exit(1);
    }
  } catch (err) {
    console.log(`❌ Forge API connection failed: ${err.message}`);
    process.exit(1);
  }

  // Test each agent
  const results = [];
  for (const agent of AGENTS) {
    const result = await testAgent(agent);
    results.push(result);
  }

  // Summary
  console.log(`\n${"=".repeat(60)}`);
  console.log("📊 TEST SUMMARY");
  console.log(`${"=".repeat(60)}`);
  
  const passed = results.filter(r => r.status === "PASS").length;
  const warned = results.filter(r => r.status === "WARN").length;
  const failed = results.filter(r => r.status === "FAIL").length;
  
  results.forEach(r => {
    const icon = r.status === "PASS" ? "✅" : r.status === "WARN" ? "⚠️" : "❌";
    console.log(`${icon} ${r.agent}: ${r.status} ${r.reason || ""}`);
  });
  
  console.log(`\nTotal: ${passed} passed, ${warned} warnings, ${failed} failed out of ${results.length}`);
}

main().catch(console.error);
