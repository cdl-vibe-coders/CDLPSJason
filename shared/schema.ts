import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, jsonb, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============= ADMIN MODULE SCHEMA =============
// ISOLATED: Only admin_* tables with no cross-module foreign keys

export const admin_modules = pgTable("admin_modules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull().unique(),
  displayName: text("display_name").notNull(),
  description: text("description"),
  version: varchar("version", { length: 20 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const admin_settings = pgTable("admin_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key", { length: 100 }).notNull(),
  value: jsonb("value").notNull(),
  moduleId: varchar("module_id").references(() => admin_modules.id, { onDelete: "cascade" }),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, (table) => {
  return {
    moduleKeyUnique: unique("admin_settings_module_key_unique").on(table.moduleId, table.key),
  };
});

export const admin_logs = pgTable("admin_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  moduleId: varchar("module_id").references(() => admin_modules.id, { onDelete: "set null" }),
  userId: varchar("user_id").notNull(), // Opaque reference - no FK constraint
  action: varchar("action", { length: 100 }).notNull(),
  details: jsonb("details"),
  timestamp: timestamp("timestamp").notNull().default(sql`now()`),
});

// ============= USERS MODULE SCHEMA =============
// ISOLATED: Only users_* tables (including main users table) with no cross-module foreign keys

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").unique(),
  password: text("password").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  role: varchar("role", { length: 50 }).notNull().default("user"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const users_sessions = pgTable("users_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const users_preferences = pgTable("users_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  theme: varchar("theme", { length: 20 }).notNull().default("dark"),
  language: varchar("language", { length: 10 }).notNull().default("en"),
  notifications: jsonb("notifications").notNull().default('{}'),
  moduleSettings: jsonb("module_settings").notNull().default('{}'),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const users_activity = pgTable("users_activity", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  details: jsonb("details"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  timestamp: timestamp("timestamp").notNull().default(sql`now()`),
});

export const users_profiles = pgTable("users_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  avatar: text("avatar"),
  bio: text("bio"),
  timezone: varchar("timezone", { length: 50 }).default("UTC"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// ============= CODE REVIEW MODULE SCHEMA =============
// ISOLATED: Only codereview_* tables with no cross-module foreign keys

export const codereview_projects = pgTable("codereview_projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  repository: text("repository"),
  branch: varchar("branch", { length: 100 }).default("main"),
  language: varchar("language", { length: 50 }),
  userId: varchar("user_id").notNull(), // Opaque reference - no FK constraint
  isActive: boolean("is_active").notNull().default(true),
  autoReviewEnabled: boolean("auto_review_enabled").notNull().default(false),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const codereview_reviews = pgTable("codereview_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => codereview_projects.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id").notNull(), // Opaque reference - no FK constraint
  title: text("title").notNull(),
  description: text("description"),
  codeSnippet: text("code_snippet").notNull(),
  language: varchar("language", { length: 50 }),
  filePath: text("file_path"),
  lineStart: varchar("line_start", { length: 10 }),
  lineEnd: varchar("line_end", { length: 10 }),
  reviewType: varchar("review_type", { length: 50 }).notNull().default("manual"), // manual, automated, scheduled
  status: varchar("status", { length: 50 }).notNull().default("pending"), // pending, reviewing, completed, failed
  aiModel: varchar("ai_model", { length: 100 }).default("claude-sonnet-4-20250514"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  completedAt: timestamp("completed_at"),
});

export const codereview_results = pgTable("codereview_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reviewId: varchar("review_id").references(() => codereview_reviews.id, { onDelete: "cascade" }).notNull().unique(),
  overallScore: varchar("overall_score", { length: 10 }),
  summary: text("summary"),
  issues: jsonb("issues").notNull().default('[]'), // Array of issues found
  suggestions: jsonb("suggestions").notNull().default('[]'), // Array of improvement suggestions
  securityVulnerabilities: jsonb("security_vulnerabilities").notNull().default('[]'),
  performanceIssues: jsonb("performance_issues").notNull().default('[]'),
  bestPractices: jsonb("best_practices").notNull().default('[]'),
  codeComplexity: jsonb("code_complexity"),
  testCoverage: jsonb("test_coverage"),
  documentation: jsonb("documentation"),
  rawResponse: text("raw_response"), // Full AI response for debugging
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const codereview_comments = pgTable("codereview_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reviewId: varchar("review_id").references(() => codereview_reviews.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id").notNull(), // Opaque reference - no FK constraint
  comment: text("comment").notNull(),
  isAiGenerated: boolean("is_ai_generated").notNull().default(false),
  resolved: boolean("resolved").notNull().default(false),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const codereview_templates = pgTable("codereview_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  userId: varchar("user_id").notNull(), // Opaque reference - no FK constraint
  isPublic: boolean("is_public").notNull().default(false),
  reviewCriteria: jsonb("review_criteria").notNull().default('{}'),
  systemPrompt: text("system_prompt"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const codereview_metrics = pgTable("codereview_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => codereview_projects.id, { onDelete: "cascade" }).notNull(),
  date: timestamp("date").notNull().default(sql`now()`),
  totalReviews: varchar("total_reviews", { length: 10 }).notNull().default("0"),
  avgScore: varchar("avg_score", { length: 10 }),
  issuesFound: varchar("issues_found", { length: 10 }).notNull().default("0"),
  issuesResolved: varchar("issues_resolved", { length: 10 }).notNull().default("0"),
  securityVulnerabilities: varchar("security_vulnerabilities", { length: 10 }).notNull().default("0"),
  performanceIssues: varchar("performance_issues", { length: 10 }).notNull().default("0"),
  codeQualityTrend: jsonb("code_quality_trend").notNull().default('{}'),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// ============= ADMIN MODULE ACCESS CONTROL TABLES =============
// These are owned by admin module and use opaque references to users

export const admin_module_permissions = pgTable("admin_module_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  moduleId: varchar("module_id").references(() => admin_modules.id, { onDelete: "cascade" }).notNull(),
  role: varchar("role", { length: 50 }).notNull(),
  canAccess: boolean("can_access").notNull().default(false),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, (table) => {
  return {
    moduleRoleUnique: unique("admin_module_permissions_module_role_unique").on(table.moduleId, table.role),
  };
});

export const admin_user_overrides = pgTable("admin_user_overrides", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(), // Opaque reference - no FK constraint
  moduleId: varchar("module_id").references(() => admin_modules.id, { onDelete: "cascade" }).notNull(),
  enabled: boolean("enabled").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, (table) => {
  return {
    userModuleUnique: unique("admin_user_overrides_user_module_unique").on(table.userId, table.moduleId),
  };
});

// ============= RELATIONS =============
// ISOLATED: Only intra-module relations, no cross-module relations

// Admin Module Relations (admin_* tables only)
export const adminModulesRelations = relations(admin_modules, ({ many }) => ({
  settings: many(admin_settings),
  logs: many(admin_logs),
  permissions: many(admin_module_permissions),
  userOverrides: many(admin_user_overrides),
}));

export const adminSettingsRelations = relations(admin_settings, ({ one }) => ({
  module: one(admin_modules, {
    fields: [admin_settings.moduleId],
    references: [admin_modules.id],
  }),
}));

export const adminLogsRelations = relations(admin_logs, ({ one }) => ({
  module: one(admin_modules, {
    fields: [admin_logs.moduleId],
    references: [admin_modules.id],
  }),
  // Note: No relation to users - userId is opaque reference
}));

export const adminModulePermissionsRelations = relations(admin_module_permissions, ({ one }) => ({
  module: one(admin_modules, {
    fields: [admin_module_permissions.moduleId],
    references: [admin_modules.id],
  }),
}));

export const adminUserOverridesRelations = relations(admin_user_overrides, ({ one }) => ({
  module: one(admin_modules, {
    fields: [admin_user_overrides.moduleId],
    references: [admin_modules.id],
  }),
  // Note: No relation to users - userId is opaque reference
}));

// Users Module Relations (users_* tables only)
export const usersRelations = relations(users, ({ many, one }) => ({
  sessions: many(users_sessions),
  preferences: one(users_preferences),
  activities: many(users_activity),
  profile: one(users_profiles),
}));

export const usersSessionsRelations = relations(users_sessions, ({ one }) => ({
  user: one(users, {
    fields: [users_sessions.userId],
    references: [users.id],
  }),
}));

export const usersPreferencesRelations = relations(users_preferences, ({ one }) => ({
  user: one(users, {
    fields: [users_preferences.userId],
    references: [users.id],
  }),
}));

export const usersActivityRelations = relations(users_activity, ({ one }) => ({
  user: one(users, {
    fields: [users_activity.userId],
    references: [users.id],
  }),
}));

export const usersProfilesRelations = relations(users_profiles, ({ one }) => ({
  user: one(users, {
    fields: [users_profiles.userId],
    references: [users.id],
  }),
}));

// ============= ZOD SCHEMAS =============
// Admin Module Schemas
export const insertAdminModuleSchema = createInsertSchema(admin_modules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAdminSettingSchema = createInsertSchema(admin_settings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAdminLogSchema = createInsertSchema(admin_logs).omit({
  id: true,
  timestamp: true,
});

// Admin Module Permission Schemas
export const insertAdminModulePermissionSchema = createInsertSchema(admin_module_permissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAdminUserOverrideSchema = createInsertSchema(admin_user_overrides).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// User Module Schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserSessionSchema = createInsertSchema(users_sessions).omit({
  id: true,
  createdAt: true,
});

export const insertUserPreferencesSchema = createInsertSchema(users_preferences).omit({
  id: true,
  updatedAt: true,
});

export const insertUserActivitySchema = createInsertSchema(users_activity).omit({
  id: true,
  timestamp: true,
});

export const insertUserProfileSchema = createInsertSchema(users_profiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});


// ============= TYPES =============
// Admin Module Types
export type AdminModule = typeof admin_modules.$inferSelect;
export type InsertAdminModule = z.infer<typeof insertAdminModuleSchema>;

export type AdminSetting = typeof admin_settings.$inferSelect;
export type InsertAdminSetting = z.infer<typeof insertAdminSettingSchema>;

export type AdminLog = typeof admin_logs.$inferSelect;
export type InsertAdminLog = z.infer<typeof insertAdminLogSchema>;

// User Module Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

// Code Review Module Schemas
export const insertCodereviewProjectSchema = createInsertSchema(codereview_projects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCodereviewReviewSchema = createInsertSchema(codereview_reviews).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertCodereviewResultSchema = createInsertSchema(codereview_results).omit({
  id: true,
  createdAt: true,
});

export const insertCodereviewCommentSchema = createInsertSchema(codereview_comments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCodereviewTemplateSchema = createInsertSchema(codereview_templates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCodereviewMetricSchema = createInsertSchema(codereview_metrics).omit({
  id: true,
  createdAt: true,
});

// Code Review Module Types
export type CodereviewProject = typeof codereview_projects.$inferSelect;
export type InsertCodereviewProject = z.infer<typeof insertCodereviewProjectSchema>;

export type CodereviewReview = typeof codereview_reviews.$inferSelect;
export type InsertCodereviewReview = z.infer<typeof insertCodereviewReviewSchema>;

export type CodereviewResult = typeof codereview_results.$inferSelect;
export type InsertCodereviewResult = z.infer<typeof insertCodereviewResultSchema>;

export type CodereviewComment = typeof codereview_comments.$inferSelect;
export type InsertCodereviewComment = z.infer<typeof insertCodereviewCommentSchema>;

export type CodereviewTemplate = typeof codereview_templates.$inferSelect;
export type InsertCodereviewTemplate = z.infer<typeof insertCodereviewTemplateSchema>;

export type CodereviewMetric = typeof codereview_metrics.$inferSelect;
export type InsertCodereviewMetric = z.infer<typeof insertCodereviewMetricSchema>;

// Admin Module Access Control Types
export type AdminModulePermission = typeof admin_module_permissions.$inferSelect;
export type InsertAdminModulePermission = z.infer<typeof insertAdminModulePermissionSchema>;

export type AdminUserOverride = typeof admin_user_overrides.$inferSelect;
export type InsertAdminUserOverride = z.infer<typeof insertAdminUserOverrideSchema>;

// Additional Users Module Types
export type UserSession = typeof users_sessions.$inferSelect;
export type InsertUserSession = z.infer<typeof insertUserSessionSchema>;

export type UserPreferences = typeof users_preferences.$inferSelect;
export type InsertUserPreferences = z.infer<typeof insertUserPreferencesSchema>;

export type UserActivity = typeof users_activity.$inferSelect;
export type InsertUserActivity = z.infer<typeof insertUserActivitySchema>;

export type UserProfile = typeof users_profiles.$inferSelect;
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;

// Security helper types
export type UserWithoutPassword = Omit<User, 'password'>;

// Access control computation result
export interface ModuleAccessResult {
  hasAccess: boolean;
  reason: 'role_permission' | 'user_override' | 'module_disabled';
}
