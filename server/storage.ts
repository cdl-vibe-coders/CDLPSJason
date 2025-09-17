import { 
  users, admin_modules, admin_settings, admin_logs, user_sessions, user_preferences,
  module_role_permissions, user_module_overrides,
  type User, type InsertUser, type UserWithoutPassword,
  type AdminModule, type InsertAdminModule,
  type AdminSetting, type InsertAdminSetting,
  type AdminLog, type InsertAdminLog,
  type UserSession, type InsertUserSession,
  type UserPreferences, type InsertUserPreferences,
  type ModuleRolePermission, type InsertModuleRolePermission,
  type UserModuleOverride, type InsertUserModuleOverride,
  type ModuleAccessResult
} from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcrypt";
import { createHash } from "crypto";

const SALT_ROUNDS = 12;

// Comprehensive storage interface for all modules
export interface IStorage {
  // User management with security
  getUser(id: string): Promise<UserWithoutPassword | undefined>;
  getUserByUsername(username: string): Promise<UserWithoutPassword | undefined>;
  getUserForLogin(username: string): Promise<User | undefined>; // Only for login verification
  createUser(user: InsertUser): Promise<UserWithoutPassword>;
  updateUser(id: string, updates: Partial<Omit<User, 'password'>>): Promise<UserWithoutPassword | undefined>;
  updateUserPassword(id: string, newPassword: string): Promise<boolean>;
  verifyUserPassword(username: string, password: string): Promise<User | null>;
  
  // Session management with secure tokens
  createSession(session: InsertUserSession): Promise<UserSession>;
  getSession(token: string): Promise<UserSession | undefined>;
  deleteSession(token: string): Promise<boolean>;
  cleanExpiredSessions(): Promise<number>;
  
  // User preferences
  getUserPreferences(userId: string): Promise<UserPreferences | undefined>;
  createUserPreferences(preferences: InsertUserPreferences): Promise<UserPreferences>;
  updateUserPreferences(userId: string, updates: Partial<UserPreferences>): Promise<UserPreferences | undefined>;
  
  // Module management
  getAllModules(): Promise<AdminModule[]>;
  getModule(id: string): Promise<AdminModule | undefined>;
  createModule(module: InsertAdminModule): Promise<AdminModule>;
  updateModule(id: string, updates: Partial<AdminModule>): Promise<AdminModule | undefined>;
  toggleModuleStatus(id: string, isActive: boolean): Promise<AdminModule | undefined>;
  
  // Settings management
  getModuleSettings(moduleId: string): Promise<AdminSetting[]>;
  getModuleSetting(moduleId: string, key: string): Promise<AdminSetting | undefined>;
  createModuleSetting(setting: InsertAdminSetting): Promise<AdminSetting>;
  updateModuleSetting(moduleId: string, key: string, value: any): Promise<AdminSetting | undefined>;
  deleteModuleSetting(moduleId: string, key: string): Promise<boolean>;
  
  // Logging
  createLog(log: InsertAdminLog): Promise<AdminLog>;
  getModuleLogs(moduleId: string, limit?: number): Promise<AdminLog[]>;
  getUserLogs(userId: string, limit?: number): Promise<AdminLog[]>;
  
  // Role-based access control
  getModuleRolePermissions(moduleId: string): Promise<ModuleRolePermission[]>;
  getRolePermissions(role: string): Promise<ModuleRolePermission[]>;
  createRolePermission(permission: InsertModuleRolePermission): Promise<ModuleRolePermission>;
  updateRolePermission(moduleId: string, role: string, canAccess: boolean): Promise<ModuleRolePermission | undefined>;
  deleteRolePermission(moduleId: string, role: string): Promise<boolean>;
  
  // User module overrides
  getUserModuleOverrides(userId: string): Promise<UserModuleOverride[]>;
  getModuleOverrides(moduleId: string): Promise<UserModuleOverride[]>;
  createUserModuleOverride(override: InsertUserModuleOverride): Promise<UserModuleOverride>;
  updateUserModuleOverride(userId: string, moduleId: string, enabled: boolean): Promise<UserModuleOverride | undefined>;
  deleteUserModuleOverride(userId: string, moduleId: string): Promise<boolean>;
  
  // Access control computation
  checkModuleAccess(userId: string, moduleId: string): Promise<ModuleAccessResult>;
  getUserAccessibleModules(userId: string): Promise<AdminModule[]>;
}

export class DatabaseStorage implements IStorage {
  // ============= PASSWORD SECURITY =============
  private async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, SALT_ROUNDS);
  }
  
  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }
  
  private removePasswordField(user: User): UserWithoutPassword {
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
  
  // ============= SESSION TOKEN SECURITY =============
  private hashSessionToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  // ============= USER MANAGEMENT =============
  async getUser(id: string): Promise<UserWithoutPassword | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user ? this.removePasswordField(user) : undefined;
  }

  async getUserByUsername(username: string): Promise<UserWithoutPassword | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user ? this.removePasswordField(user) : undefined;
  }
  
  async getUserForLogin(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<UserWithoutPassword> {
    const hashedPassword = await this.hashPassword(insertUser.password);
    const [user] = await db
      .insert(users)
      .values({
        ...insertUser,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        role: insertUser.role || "user"
      })
      .returning();
    return this.removePasswordField(user);
  }

  async updateUser(id: string, updates: Partial<Omit<User, 'password'>>): Promise<UserWithoutPassword | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user ? this.removePasswordField(user) : undefined;
  }
  
  async updateUserPassword(id: string, newPassword: string): Promise<boolean> {
    const hashedPassword = await this.hashPassword(newPassword);
    const [user] = await db
      .update(users)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return !!user;
  }
  
  async verifyUserPassword(username: string, password: string): Promise<User | null> {
    const user = await this.getUserForLogin(username);
    if (!user || !user.isActive) return null;
    
    const isValid = await this.verifyPassword(password, user.password);
    return isValid ? user : null;
  }

  // ============= SESSION MANAGEMENT =============
  async createSession(insertSession: InsertUserSession): Promise<UserSession> {
    const hashedToken = this.hashSessionToken(insertSession.token);
    const [session] = await db
      .insert(user_sessions)
      .values({
        ...insertSession,
        token: hashedToken,
        createdAt: new Date()
      })
      .returning();
    return session;
  }
  
  async getSession(token: string): Promise<UserSession | undefined> {
    const hashedToken = this.hashSessionToken(token);
    const [session] = await db
      .select()
      .from(user_sessions)
      .where(eq(user_sessions.token, hashedToken));
    return session || undefined;
  }
  
  async deleteSession(token: string): Promise<boolean> {
    const hashedToken = this.hashSessionToken(token);
    const [deleted] = await db
      .delete(user_sessions)
      .where(eq(user_sessions.token, hashedToken))
      .returning();
    return !!deleted;
  }
  
  async cleanExpiredSessions(): Promise<number> {
    const deleted = await db
      .delete(user_sessions)
      .where(eq(user_sessions.expiresAt, new Date()))
      .returning();
    return deleted.length;
  }

  // ============= USER PREFERENCES =============
  async getUserPreferences(userId: string): Promise<UserPreferences | undefined> {
    const [preferences] = await db
      .select()
      .from(user_preferences)
      .where(eq(user_preferences.userId, userId));
    return preferences || undefined;
  }
  
  async createUserPreferences(insertPreferences: InsertUserPreferences): Promise<UserPreferences> {
    const [preferences] = await db
      .insert(user_preferences)
      .values({
        ...insertPreferences,
        updatedAt: new Date()
      })
      .returning();
    return preferences;
  }
  
  async updateUserPreferences(userId: string, updates: Partial<UserPreferences>): Promise<UserPreferences | undefined> {
    const [preferences] = await db
      .update(user_preferences)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(user_preferences.userId, userId))
      .returning();
    return preferences || undefined;
  }

  // ============= MODULE MANAGEMENT =============
  async getAllModules(): Promise<AdminModule[]> {
    return await db.select().from(admin_modules);
  }

  async getModule(id: string): Promise<AdminModule | undefined> {
    const [module] = await db.select().from(admin_modules).where(eq(admin_modules.id, id));
    return module || undefined;
  }

  async createModule(insertModule: InsertAdminModule): Promise<AdminModule> {
    const [module] = await db
      .insert(admin_modules)
      .values({
        ...insertModule,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
      })
      .returning();
    return module;
  }

  async updateModule(id: string, updates: Partial<AdminModule>): Promise<AdminModule | undefined> {
    const [module] = await db
      .update(admin_modules)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(admin_modules.id, id))
      .returning();
    return module || undefined;
  }

  async toggleModuleStatus(id: string, isActive: boolean): Promise<AdminModule | undefined> {
    const [module] = await db
      .update(admin_modules)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(admin_modules.id, id))
      .returning();
    return module || undefined;
  }

  // ============= SETTINGS MANAGEMENT =============
  async getModuleSettings(moduleId: string): Promise<AdminSetting[]> {
    return await db
      .select()
      .from(admin_settings)
      .where(eq(admin_settings.moduleId, moduleId));
  }
  
  async getModuleSetting(moduleId: string, key: string): Promise<AdminSetting | undefined> {
    const [setting] = await db
      .select()
      .from(admin_settings)
      .where(and(
        eq(admin_settings.moduleId, moduleId),
        eq(admin_settings.key, key)
      ));
    return setting || undefined;
  }
  
  async createModuleSetting(insertSetting: InsertAdminSetting): Promise<AdminSetting> {
    const [setting] = await db
      .insert(admin_settings)
      .values({
        ...insertSetting,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    return setting;
  }
  
  async updateModuleSetting(moduleId: string, key: string, value: any): Promise<AdminSetting | undefined> {
    const [setting] = await db
      .update(admin_settings)
      .set({ value, updatedAt: new Date() })
      .where(and(
        eq(admin_settings.moduleId, moduleId),
        eq(admin_settings.key, key)
      ))
      .returning();
    return setting || undefined;
  }
  
  async deleteModuleSetting(moduleId: string, key: string): Promise<boolean> {
    const [deleted] = await db
      .delete(admin_settings)
      .where(and(
        eq(admin_settings.moduleId, moduleId),
        eq(admin_settings.key, key)
      ))
      .returning();
    return !!deleted;
  }

  // ============= LOGGING =============
  async createLog(insertLog: InsertAdminLog): Promise<AdminLog> {
    const [log] = await db
      .insert(admin_logs)
      .values({
        ...insertLog,
        timestamp: new Date()
      })
      .returning();
    return log;
  }
  
  async getModuleLogs(moduleId: string, limit: number = 100): Promise<AdminLog[]> {
    return await db
      .select()
      .from(admin_logs)
      .where(eq(admin_logs.moduleId, moduleId))
      .limit(limit);
  }
  
  async getUserLogs(userId: string, limit: number = 100): Promise<AdminLog[]> {
    return await db
      .select()
      .from(admin_logs)
      .where(eq(admin_logs.userId, userId))
      .limit(limit);
  }

  // ============= ROLE-BASED ACCESS CONTROL =============
  async getModuleRolePermissions(moduleId: string): Promise<ModuleRolePermission[]> {
    return await db
      .select()
      .from(module_role_permissions)
      .where(eq(module_role_permissions.moduleId, moduleId));
  }
  
  async getRolePermissions(role: string): Promise<ModuleRolePermission[]> {
    return await db
      .select()
      .from(module_role_permissions)
      .where(eq(module_role_permissions.role, role));
  }
  
  async createRolePermission(insertPermission: InsertModuleRolePermission): Promise<ModuleRolePermission> {
    const [permission] = await db
      .insert(module_role_permissions)
      .values({
        ...insertPermission,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    return permission;
  }
  
  async updateRolePermission(moduleId: string, role: string, canAccess: boolean): Promise<ModuleRolePermission | undefined> {
    const [permission] = await db
      .update(module_role_permissions)
      .set({ canAccess, updatedAt: new Date() })
      .where(and(
        eq(module_role_permissions.moduleId, moduleId),
        eq(module_role_permissions.role, role)
      ))
      .returning();
    return permission || undefined;
  }
  
  async deleteRolePermission(moduleId: string, role: string): Promise<boolean> {
    const [deleted] = await db
      .delete(module_role_permissions)
      .where(and(
        eq(module_role_permissions.moduleId, moduleId),
        eq(module_role_permissions.role, role)
      ))
      .returning();
    return !!deleted;
  }

  // ============= USER MODULE OVERRIDES =============
  async getUserModuleOverrides(userId: string): Promise<UserModuleOverride[]> {
    return await db
      .select()
      .from(user_module_overrides)
      .where(eq(user_module_overrides.userId, userId));
  }
  
  async getModuleOverrides(moduleId: string): Promise<UserModuleOverride[]> {
    return await db
      .select()
      .from(user_module_overrides)
      .where(eq(user_module_overrides.moduleId, moduleId));
  }
  
  async createUserModuleOverride(insertOverride: InsertUserModuleOverride): Promise<UserModuleOverride> {
    const [override] = await db
      .insert(user_module_overrides)
      .values({
        ...insertOverride,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    return override;
  }
  
  async updateUserModuleOverride(userId: string, moduleId: string, enabled: boolean): Promise<UserModuleOverride | undefined> {
    const [override] = await db
      .update(user_module_overrides)
      .set({ enabled, updatedAt: new Date() })
      .where(and(
        eq(user_module_overrides.userId, userId),
        eq(user_module_overrides.moduleId, moduleId)
      ))
      .returning();
    return override || undefined;
  }
  
  async deleteUserModuleOverride(userId: string, moduleId: string): Promise<boolean> {
    const [deleted] = await db
      .delete(user_module_overrides)
      .where(and(
        eq(user_module_overrides.userId, userId),
        eq(user_module_overrides.moduleId, moduleId)
      ))
      .returning();
    return !!deleted;
  }

  // ============= ACCESS CONTROL COMPUTATION =============
  async checkModuleAccess(userId: string, moduleId: string): Promise<ModuleAccessResult> {
    // Get the module
    const module = await this.getModule(moduleId);
    if (!module || !module.isActive) {
      return { hasAccess: false, reason: 'module_disabled' };
    }
    
    // Check for user-specific override first (highest precedence)
    const [userOverride] = await db
      .select()
      .from(user_module_overrides)
      .where(and(
        eq(user_module_overrides.userId, userId),
        eq(user_module_overrides.moduleId, moduleId)
      ));
      
    if (userOverride) {
      return { 
        hasAccess: userOverride.enabled, 
        reason: 'user_override' 
      };
    }
    
    // Check role-based permission
    const user = await this.getUser(userId);
    if (!user) {
      return { hasAccess: false, reason: 'role_permission' };
    }
    
    const [rolePermission] = await db
      .select()
      .from(module_role_permissions)
      .where(and(
        eq(module_role_permissions.moduleId, moduleId),
        eq(module_role_permissions.role, user.role)
      ));
      
    const hasRoleAccess = rolePermission?.canAccess || false;
    return { 
      hasAccess: hasRoleAccess, 
      reason: 'role_permission' 
    };
  }
  
  async getUserAccessibleModules(userId: string): Promise<AdminModule[]> {
    const allModules = await this.getAllModules();
    const accessibleModules: AdminModule[] = [];
    
    for (const module of allModules) {
      const access = await this.checkModuleAccess(userId, module.id);
      if (access.hasAccess) {
        accessibleModules.push(module);
      }
    }
    
    return accessibleModules;
  }
}

export const storage = new DatabaseStorage();