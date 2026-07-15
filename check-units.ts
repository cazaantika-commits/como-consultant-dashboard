async function main() {
  const { db } = await import("./server/_core/db-client");
  const { projects } = await import("./drizzle/schema");
  const rows = await db.select({
    id: projects.id,
    name: projects.name,
    res1brCount: projects.residential1brCount,
    res2brCount: projects.residential2brCount,
    res3brCount: projects.residential3brCount,
    gfaRes: projects.gfaResidentialSqft,
  }).from(projects).limit(6);
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}
main();
