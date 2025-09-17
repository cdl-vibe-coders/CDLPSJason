import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============= USERS MODULE SCHEMA =============
// Namespace: users_*
// This module owns all users_* prefixed tables (including the main 'users' table)

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

// User activity tracking
export const users_activity = pgTable("users_activity", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  details: jsonb("details"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  timestamp: timestamp("timestamp").notNull().default(sql`now()`),
});

// User profile information
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

// ============= RELATIONS =============
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
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

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

// User with all related data
export type UserWithProfile = User & {
  profile?: UserProfile;
  preferences?: UserPreferences;
};