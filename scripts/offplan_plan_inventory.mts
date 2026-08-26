import mysql from "mysql2/promise";
import { getProjectMarketingTiming } from "/home/ubuntu/como-consultant-dashboard/client/src/lib/projectTiming";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is unavailable");

const connection = await mysql.createConnection(databaseUrl);
const [rows] = await connection.query<any[]>(`
  SELECT p.id, p.name, p.startDate, p.constructionMonths, p.constructionScheduleJson,
         w.id AS waelPlanId, w.payment_plan_json AS paymentPlanJson
  FROM projects p
  JOIN wael_sales_plans w ON w.project_id = p.id
  WHERE p.financingScenario = 'offplan_escrow'
  ORDER BY p.id
`);

const output = rows.map((project) => {
  const timing = getProjectMarketingTiming(project);
  const constructionInstallmentMonths = [
    timing.salesStartMonth + 4,
    timing.salesStartMonth + 8,
    timing.salesStartMonth + 12,
    timing.salesStartMonth + 16,
  ];
  const latestConstructionMonth = timing.projectEndMonth - 2;
  return {
    projectId: project.id,
    projectName: project.name,
    startDate: project.startDate,
    constructionMonths: project.constructionMonths,
    salesStartMonth: timing.salesStartMonth,
    constructionStartMonth: timing.constructionStartMonth,
    handoverMonth: timing.projectEndMonth,
    latestConstructionMonth,
    standardConstructionMonths: constructionInstallmentMonths,
    standardPlanFits: constructionInstallmentMonths.every((month) => month <= latestConstructionMonth),
  };
});

console.log(JSON.stringify(output, null, 2));
await connection.end();
