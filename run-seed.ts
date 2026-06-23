import { seedKnowledgeBase } from "./server/seedKnowledge";

async function main() {
  console.log("Starting knowledge base seeding...");
  const result = await seedKnowledgeBase();
  console.log("Result:", JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
