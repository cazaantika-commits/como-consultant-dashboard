import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Projects table
export const projects = mysqlTable('projects', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('userId').notNull().references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  bua: int('bua'), // Building area in sqft
  pricePerSqft: int('pricePerSqft'), // Price per square foot in AED
  notes: text('notes'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

// Consultants table
export const consultants = mysqlTable('consultants', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('userId').notNull().references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 320 }),
  phone: varchar('phone', { length: 20 }),
  specialization: varchar('specialization', { length: 255 }),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type Consultant = typeof consultants.$inferSelect;
export type InsertConsultant = typeof consultants.$inferInsert;

// Project-Consultant relationship
export const projectConsultants = mysqlTable('projectConsultants', {
  id: int('id').autoincrement().primaryKey(),
  projectId: int('projectId').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  consultantId: int('consultantId').notNull().references(() => consultants.id, { onDelete: 'cascade' }),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

export type ProjectConsultant = typeof projectConsultants.$inferSelect;
export type InsertProjectConsultant = typeof projectConsultants.$inferInsert;

// Financial data for consultant in project
export const financialData = mysqlTable('financialData', {
  id: int('id').autoincrement().primaryKey(),
  projectId: int('projectId').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  consultantId: int('consultantId').notNull().references(() => consultants.id, { onDelete: 'cascade' }),
  designType: varchar('designType', { length: 20 }).default('pct'), // 'pct' or 'lump'
  designValue: int('designValue'),
  supervisionType: varchar('supervisionType', { length: 20 }).default('pct'), // 'pct' or 'lump'
  supervisionValue: int('supervisionValue'),
  proposalLink: varchar('proposalLink', { length: 500 }),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type FinancialData = typeof financialData.$inferSelect;
export type InsertFinancialData = typeof financialData.$inferInsert;

// Evaluation scores for consultant in project
export const evaluationScores = mysqlTable('evaluationScores', {
  id: int('id').autoincrement().primaryKey(),
  projectId: int('projectId').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  consultantId: int('consultantId').notNull().references(() => consultants.id, { onDelete: 'cascade' }),
  criterionId: int('criterionId').notNull(), // 0-5 for the 6 criteria
  score: int('score'), // Score value
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type EvaluationScore = typeof evaluationScores.$inferSelect;
export type InsertEvaluationScore = typeof evaluationScores.$inferInsert;