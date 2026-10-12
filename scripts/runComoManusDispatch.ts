import { executeDispatchedDirectiveCommand } from "../server/services/comoManusDispatch";

function parseDirectiveId(argv: string[]) {
  const index = argv.indexOf("--directive-id");
  if (index !== 0 || !argv[index + 1] || argv.length !== 2) {
    throw new Error("Usage: tsx scripts/runComoManusDispatch.ts --directive-id <positive-integer>");
  }
  const value = Number(argv[index + 1]);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error("--directive-id must be a positive integer");
  }
  return value;
}

async function main() {
  const directiveId = parseDirectiveId(process.argv.slice(2));
  const result = await executeDispatchedDirectiveCommand({ directiveId });
  // Deliberately omits directive text, webhook data, and provider details.
  console.log(JSON.stringify({ directiveId, ...result }, null, 2));
  process.exit(!result.accepted && !["dispatch_already_claimed", "directive_not_owner_approved"].includes(result.reason || "") ? 1 : 0);
}

main().catch(error => {
  console.error("como_manus_dispatch_worker_failed", error instanceof Error ? error.message : "unknown_error");
  process.exit(1);
});
