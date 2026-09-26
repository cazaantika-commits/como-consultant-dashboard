import { promoteReviewedProjectMemory } from "../server/services/comoNextProjectMemory";

async function main() {
  const result = await promoteReviewedProjectMemory(process.argv[2]);
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
