import { getDb } from './server/db.ts';
import { cfProjects, projects } from './drizzle/schema.ts';

const db = await getDb();

const all = await db.select({ id: cfProjects.id, name: cfProjects.name, projectId: cfProjects.projectId }).from(cfProjects);
console.log('cf_projects count:', all.length);
all.forEach(p => console.log(`  cfProject id=${p.id}, name="${p.name}", projectId=${p.projectId}`));

const allProjects = await db.select({ id: projects.id, name: projects.name }).from(projects);
console.log('\nprojects count:', allProjects.length);
allProjects.forEach(p => console.log(`  project id=${p.id}, name="${p.name}"`));

process.exit(0);
