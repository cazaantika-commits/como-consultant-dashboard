import { drizzle } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";
import { users, projects, consultants, projectConsultants } from "../drizzle/schema";

// Database connection
const db = drizzle(process.env.DATABASE_URL!);

// Original data from the HTML file
const PROJECTS_DATA = [
  { id: "p1", name: "مركز مجان التجاري (G+4)", consultantNames: ["Osus International", "Realistic Engineering", "ARTEC Architectural & Engineering Consultants", "DATUM Engineering Consultants"] },
  { id: "p2", name: "مجان متعدد الاستخدامات (G+4P+25)", consultantNames: ["LACASA", "ARTEC Architectural & Engineering Consultants", "DATUM Engineering Consultants"] },
  { id: "p3", name: "مبنى الجداف السكني (G+7)", consultantNames: ["Osus International", "Realistic Engineering", "ARTEC Architectural & Engineering Consultants", "DATUM Engineering Consultants"] },
  { id: "p4", name: "ند الشبا — قطعة 1 (6185392)", consultantNames: ["Realistic Engineering", "ARTEC Architectural & Engineering Consultants", "DATUM Engineering Consultants", "Safeer Engineering Consultants (SEC)"] },
  { id: "p5", name: "ند الشبا — قطعة 2 المدمجة (6182776)", consultantNames: ["Realistic Engineering", "ARTEC Architectural & Engineering Consultants", "DATUM Engineering Consultants", "Safeer Engineering Consultants (SEC)"] },
  { id: "p6", name: "ند الشبا — قطعة 3 الفلل (6180578)", consultantNames: ["Realistic Engineering", "ARTEC Architectural & Engineering Consultants", "DATUM Engineering Consultants", "Safeer Engineering Consultants (SEC)"] }
];

const ALL_CONSULTANTS_DATA = [
  "Osus International",
  "Realistic Engineering",
  "DATUM Engineering Consultants",
  "ARTEC Architectural & Engineering Consultants",
  "Arif & Bintoak Consulting Architects & Engineers",
  "Al Diwan Engineering Consultants",
  "LACASA",
  "XYZ Designers",
  "Kieferle & Partner",
  "Safeer Engineering Consultants (SEC)"
];

async function importData() {
  try {
    console.log("🚀 بدء استيراد البيانات...");

    // Get the owner user (first admin user)
    const ownerUsers = await db.select().from(users).limit(1);
    if (ownerUsers.length === 0) {
      console.error("❌ لم يتم العثور على مستخدم مسجل. يرجى تسجيل الدخول أولاً.");
      process.exit(1);
    }

    const userId = ownerUsers[0].id;
    console.log(`✅ تم العثور على المستخدم: ${ownerUsers[0].name}`);

    // Import consultants
    console.log("\n📋 جاري استيراد الاستشاريين...");
    const importedConsultants: Record<string, number> = {};

    for (const consultantName of ALL_CONSULTANTS_DATA) {
      try {
        await db.insert(consultants).values({
          userId,
          name: consultantName,
          email: null,
          phone: null,
          specialization: null,
        });
        
        // Get the inserted consultant ID
        const inserted = await db.select().from(consultants)
          .where(eq(consultants.name, consultantName))
          .limit(1);
        
        if (inserted.length > 0) {
          importedConsultants[consultantName] = inserted[0].id;
          console.log(`  ✅ ${consultantName}`);
        }
      } catch (error) {
        // Check if consultant already exists
        const existing = await db.select().from(consultants)
          .where(eq(consultants.name, consultantName))
          .limit(1);
        
        if (existing.length > 0) {
          importedConsultants[consultantName] = existing[0].id;
          console.log(`  ℹ️ ${consultantName} (موجود بالفعل)`);
        } else {
          console.log(`  ⚠️ ${consultantName} (فشل الاستيراد)`);
        }
      }
    }

    // Import projects
    console.log("\n🏗️ جاري استيراد المشاريع...");
    const importedProjects: Record<string, number> = {};

    for (const projectData of PROJECTS_DATA) {
      try {
        await db.insert(projects).values({
          userId,
          name: projectData.name,
          description: null,
          bua: null,
          pricePerSqft: null,
          notes: null,
        });

        // Get the inserted project ID
        const inserted = await db.select().from(projects)
          .where(eq(projects.name, projectData.name))
          .limit(1);

        if (inserted.length > 0) {
          importedProjects[projectData.id] = inserted[0].id;
          console.log(`  ✅ ${projectData.name}`);

          // Link consultants to project
          for (const consultantName of projectData.consultantNames) {
            const consultantId = importedConsultants[consultantName];
            if (consultantId) {
              try {
                await db.insert(projectConsultants).values({
                  projectId: inserted[0].id,
                  consultantId: consultantId,
                });
              } catch (error) {
                // Consultant might already be linked
              }
            }
          }
        }
      } catch (error) {
        // Check if project already exists
        const existing = await db.select().from(projects)
          .where(eq(projects.name, projectData.name))
          .limit(1);
        
        if (existing.length > 0) {
          importedProjects[projectData.id] = existing[0].id;
          console.log(`  ℹ️ ${projectData.name} (موجود بالفعل)`);
        } else {
          console.log(`  ⚠️ ${projectData.name} (فشل الاستيراد)`);
        }
      }
    }

    console.log("\n✅ تم إكمال الاستيراد بنجاح!");
    console.log(`📊 تم استيراد ${Object.keys(importedConsultants).length} استشاري و ${Object.keys(importedProjects).length} مشروع`);

  } catch (error) {
    console.error("❌ خطأ أثناء الاستيراد:", error);
    process.exit(1);
  }
}

importData();
