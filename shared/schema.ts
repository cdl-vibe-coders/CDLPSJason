import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, jsonb, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============= ADMIN MODULE SCHEMA =============
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
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  action: varchar("action", { length: 100 }).notNull(),
  details: jsonb("details"),
  timestamp: timestamp("timestamp").notNull().default(sql`now()`),
});

// ============= USERS MODULE SCHEMA =============
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

export const user_sessions = pgTable("user_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const user_preferences = pgTable("user_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  theme: varchar("theme", { length: 20 }).notNull().default("dark"),
  language: varchar("language", { length: 10 }).notNull().default("en"),
  notifications: jsonb("notifications").notNull().default('{}'),
  moduleSettings: jsonb("module_settings").notNull().default('{}'),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// ============= ROLE-BASED ACCESS CONTROL SCHEMA =============
export const module_role_permissions = pgTable("module_role_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  moduleId: varchar("module_id").references(() => admin_modules.id, { onDelete: "cascade" }).notNull(),
  role: varchar("role", { length: 50 }).notNull(),
  canAccess: boolean("can_access").notNull().default(false),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, (table) => {
  return {
    moduleRoleUnique: unique("module_role_permissions_module_role_unique").on(table.moduleId, table.role),
  };
});

export const user_module_overrides = pgTable("user_module_overrides", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  moduleId: varchar("module_id").references(() => admin_modules.id, { onDelete: "cascade" }).notNull(),
  enabled: boolean("enabled").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, (table) => {
  return {
    userModuleUnique: unique("user_module_overrides_user_module_unique").on(table.userId, table.moduleId),
  };
});

// ============= RELATIONS =============
export const adminModulesRelations = relations(admin_modules, ({ many }) => ({
  settings: many(admin_settings),
  logs: many(admin_logs),
  rolePermissions: many(module_role_permissions),
  userOverrides: many(user_module_overrides),
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
  user: one(users, {
    fields: [admin_logs.userId],
    references: [users.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(user_sessions),
  preferences: many(user_preferences),
  logs: many(admin_logs),
  moduleOverrides: many(user_module_overrides),
}));

export const userSessionsRelations = relations(user_sessions, ({ one }) => ({
  user: one(users, {
    fields: [user_sessions.userId],
    references: [users.id],
  }),
}));

export const userPreferencesRelations = relations(user_preferences, ({ one }) => ({
  user: one(users, {
    fields: [user_preferences.userId],
    references: [users.id],
  }),
}));

export const moduleRolePermissionsRelations = relations(module_role_permissions, ({ one }) => ({
  module: one(admin_modules, {
    fields: [module_role_permissions.moduleId],
    references: [admin_modules.id],
  }),
}));

export const userModuleOverridesRelations = relations(user_module_overrides, ({ one }) => ({
  user: one(users, {
    fields: [user_module_overrides.userId],
    references: [users.id],
  }),
  module: one(admin_modules, {
    fields: [user_module_overrides.moduleId],
    references: [admin_modules.id],
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

// User Module Schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserSessionSchema = createInsertSchema(user_sessions).omit({
  id: true,
  createdAt: true,
});

export const insertUserPreferencesSchema = createInsertSchema(user_preferences).omit({
  id: true,
  updatedAt: true,
});

// Role-based Access Control Schemas
export const insertModuleRolePermissionSchema = createInsertSchema(module_role_permissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserModuleOverrideSchema = createInsertSchema(user_module_overrides).omit({
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

export type UserSession = typeof user_sessions.$inferSelect;
export type InsertUserSession = z.infer<typeof insertUserSessionSchema>;

export type UserPreferences = typeof user_preferences.$inferSelect;
export type InsertUserPreferences = z.infer<typeof insertUserPreferencesSchema>;

// Role-based Access Control Types
export type ModuleRolePermission = typeof module_role_permissions.$inferSelect;
export type InsertModuleRolePermission = z.infer<typeof insertModuleRolePermissionSchema>;

export type UserModuleOverride = typeof user_module_overrides.$inferSelect;
export type InsertUserModuleOverride = z.infer<typeof insertUserModuleOverrideSchema>;

// Security helper types
export type UserWithoutPassword = Omit<User, 'password'>;

// Access control computation result
export interface ModuleAccessResult {
  hasAccess: boolean;
  reason: 'role_permission' | 'user_override' | 'module_disabled';
}
