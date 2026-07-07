import { getDb } from './server/db.ts';
import { users, projects } from './drizzle/schema.ts';
import { eq } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  const ownerOpenId = '5ayJotR3SdmQrbRBtwWMjz';
  
  // Check all users
  const allUsers = await db.select().from(users);
  console.log('All users:');
  allUsers.forEach(u => console.log(' -', u.id, JSON.stringify(u.openId), 'len:', u.openId?.length));
  
  // Check exact match
  const ownerRows = await db.select().from(users).where(eq(users.openId, ownerOpenId)).limit(1);
  console.log('\nOwner rows found:', ownerRows.length);
  
  if (ownerRows.length > 0) {
    const allProjects = await db.select().from(projects).where(eq(projects.userId, ownerRows[0].id));
    console.log('Projects count:', allProjects.length);
    allProjects.forEach(p => console.log(' -', p.id, p.nameAr));
  } else {
    // Check all projects
    const allProjects = await db.select().from(projects);
    console.log('All projects (no owner filter):', allProjects.length);
    allProjects.forEach(p => console.log(' -', p.id, p.nameAr, 'userId:', p.userId));
  }
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
