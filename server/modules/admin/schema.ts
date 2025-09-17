import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, jsonb, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============= ADMIN MODULE SCHEMA =============
// Namespace: admin_*
// This module owns all admin_* prefixed tables

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
  userId: varchar("user_id").notNull(), // Reference to user but no FK constraint (cross-module reference)
  action: varchar("action", { length: 100 }).notNull(),
  details: jsonb("details"),
  timestamp: timestamp("timestamp").notNull().default(sql`now()`),
});

// Cross-module permission management tables owned by admin module
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
  userId: varchar("user_id").notNull(), // Reference to user but no FK constraint
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
  // Note: No relation to users table since it's in different module
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
  // Note: No relation to users table since it's in different module
}));

// ============= ZOD SCHEMAS =============
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

// ============= TYPES =============
export type AdminModule = typeof admin_modules.$inferSelect;
export type InsertAdminModule = z.infer<typeof insertAdminModuleSchema>;

export type AdminSetting = typeof admin_settings.$inferSelect;
export type InsertAdminSetting = z.infer<typeof insertAdminSettingSchema>;

export type AdminLog = typeof admin_logs.$inferSelect;
export type InsertAdminLog = z.infer<typeof insertAdminLogSchema>;

export type AdminModulePermission = typeof admin_module_permissions.$inferSelect;
export type InsertAdminModulePermission = z.infer<typeof insertAdminModulePermissionSchema>;

export type AdminUserOverride = typeof admin_user_overrides.$inferSelect;
export type InsertAdminUserOverride = z.infer<typeof insertAdminUserOverrideSchema>;