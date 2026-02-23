// Integration test - calls handleAgentChat for each agent
// This tests the full flow: system prompt + tools + Forge API

import { handleAgentChat } from "./server/agentChat.ts";

const AGENTS = [
  { id: "khazen", name: "خازن", msg: "اعرض ملفات مجلد الجداف" },
  { id: "salwa", name: "سلوى", msg: "من هم الاستشاريين المسجلين؟" },
  { id: "farouq", name: "فاروق", msg: "اعرض تقييمات استشاريين الجداف" },
  { id: "alina", name: "ألينا", msg: "اعرض البيانات المالية لمشروع الجداف" },
  { id: "buraq", name: "براق", msg: "اعرض المهام المعلقة" },
  { id: "khaled", name: "خالد", msg: "اعرض معايير التقييم الفني" },
  { id: "baz", name: "باز", msg: "اعرض المشاريع الحالية" },
  { id: "joelle", name: "جويل", msg: "اعرض دراسة الجدوى لمشروع الجداف" },
];

async function testAgent(agent) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🧪 Testing: ${agent.name} (${agent.id})`);
  console.log(`📝 Message: ${agent.msg}`);
  console.log(`${"=".repeat(60)}`);

  const startTime = Date.now();
  try {
    const result = await handleAgentChat(
      agent.id,
      [{ role: "user", content: agent.msg }],
      1 // userId
    );
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    if (!result || !result.content) {
      console.log(`❌ FAIL (${elapsed}s): Empty response`);
      return { agent: agent.name, status: "FAIL", reason: "Empty response", time: elapsed };
    }

    const preview = result.content.substring(0, 200).replace(/\n/g, " ");
    const toolsUsed = result.toolsUsed || [];
    
    if (toolsUsed.length > 0) {
      console.log(`✅ PASS (${elapsed}s): Used tools: ${toolsUsed.join(", ")}`);
      console.log(`   Response: ${preview}...`);
      return { agent: agent.name, status: "PASS", tools: toolsUsed, time: elapsed };
    } else {
      console.log(`⚠️ WARN (${elapsed}s): Text response only (no tools)`);
      console.log(`   Response: ${preview}...`);
      return { agent: agent.name, status: "WARN", reason: "No tools called", time: elapsed };
    }
  } catch (err) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`❌ FAIL (${elapsed}s): ${err.message}`);
    return { agent: agent.name, status: "FAIL", reason: err.message, time: elapsed };
  }
}

async function main() {
  console.log("🚀 Starting integration agent test...\n");
  
  const results = [];
  for (const agent of AGENTS) {
    const result = await testAgent(agent);
    results.push(result);
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("📊 TEST SUMMARY");
  console.log(`${"=".repeat(60)}`);
  
  const passed = results.filter(r => r.status === "PASS").length;
  const warned = results.filter(r => r.status === "WARN").length;
  const failed = results.filter(r => r.status === "FAIL").length;
  
  results.forEach(r => {
    const icon = r.status === "PASS" ? "✅" : r.status === "WARN" ? "⚠️" : "❌";
    console.log(`${icon} ${r.agent}: ${r.status} (${r.time}s) ${r.reason || (r.tools ? "tools: " + r.tools.join(", ") : "")}`);
  });
  
  console.log(`\nTotal: ${passed} passed, ${warned} warnings, ${failed} failed out of ${results.length}`);
}

main().catch(console.error);
