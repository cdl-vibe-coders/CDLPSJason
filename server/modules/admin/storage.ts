import { BaseModuleStorage } from "../../storage/BaseModuleStorage";
import type { ModuleStorage } from "../../types/module";
import { 
  admin_modules, admin_settings, admin_logs, admin_module_permissions, admin_user_overrides,
  type AdminModule, type InsertAdminModule,
  type AdminSetting, type InsertAdminSetting,
  type AdminLog, type InsertAdminLog,
  type AdminModulePermission, type InsertAdminModulePermission,
  type AdminUserOverride, type InsertAdminUserOverride
} from "./schema";
import { eq, and, desc, sql } from "drizzle-orm";
import type { BaseUser } from "@shared/core-schema";

// ============= ADMIN MODULE STORAGE =============

export class AdminModuleStorage extends BaseModuleStorage {
  constructor() {
    super("admin", "admin_");
  }

  // ============= INITIALIZATION =============

  async initialize(): Promise<void> {
    console.log(`Initializing ${this.moduleId} module storage...`);
    
    try {
      // Create module registry table if it doesn't exist (shared infrastructure)
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS module_registry (
          module_id VARCHAR PRIMARY KEY,
          namespace VARCHAR NOT NULL,
          initialized_at TIMESTAMP DEFAULT NOW(),
          version VARCHAR DEFAULT '1.0.0'
        )
      `);

      // Record this module's initialization
      await this.recordModuleInitialization();
      
      console.log(`✅ ${this.moduleId} module storage initialized`);
    } catch (error) {
      console.error(`Failed to initialize ${this.moduleId} module storage:`, error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    console.log(`Cleaning up ${this.moduleId} module storage...`);
    // Clean up any resources, close connections if needed
    // For now, just log as we're using shared db connection
  }

  // ============= MODULE MANAGEMENT =============

  async getAllModules(): Promise<AdminModule[]> {
    return await this.executeQuery(() => 
      this.db.select().from(admin_modules).orderBy(admin_modules.createdAt)
    );
  }

  async getModule(id: string): Promise<AdminModule | undefined> {
    const [module] = await this.executeQuery(() =>
      this.db.select().from(admin_modules).where(eq(admin_modules.id, id))
    );
    return module;
  }

  async getModuleByName(name: string): Promise<AdminModule | undefined> {
    const [module] = await this.executeQuery(() =>
      this.db.select().from(admin_modules).where(eq(admin_modules.name, name))
    );
    return module;
  }

  async createModule(moduleData: InsertAdminModule): Promise<AdminModule> {
    const [module] = await this.executeQuery(() =>
      this.db
        .insert(admin_modules)
        .values({
          ...moduleData,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning()
    );
    return module;
  }

  async updateModule(id: string, updates: Partial<AdminModule>): Promise<AdminModule | undefined> {
    const [module] = await this.executeQuery(() =>
      this.db
        .update(admin_modules)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(admin_modules.id, id))
        .returning()
    );
    return module;
  }

  async toggleModuleStatus(id: string, isActive: boolean): Promise<AdminModule | undefined> {
    return this.updateModule(id, { isActive });
  }

  // ============= SETTINGS MANAGEMENT =============

  async getModuleSettings(moduleId: string): Promise<AdminSetting[]> {
    return await this.executeQuery(() =>
      this.db
        .select()
        .from(admin_settings)
        .where(eq(admin_settings.moduleId, moduleId))
        .orderBy(admin_settings.key)
    );
  }

  async getModuleSetting(moduleId: string, key: string): Promise<AdminSetting | undefined> {
    const [setting] = await this.executeQuery(() =>
      this.db
        .select()
        .from(admin_settings)
        .where(
          and(
            eq(admin_settings.moduleId, moduleId),
            eq(admin_settings.key, key)
          )
        )
    );
    return setting;
  }

  async createModuleSetting(setting: InsertAdminSetting): Promise<AdminSetting> {
    const [newSetting] = await this.executeQuery(() =>
      this.db
        .insert(admin_settings)
        .values({
          ...setting,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning()
    );
    return newSetting;
  }

  async updateModuleSetting(moduleId: string, key: string, value: any): Promise<AdminSetting | undefined> {
    const [setting] = await this.executeQuery(() =>
      this.db
        .update(admin_settings)
        .set({ value, updatedAt: new Date() })
        .where(
          and(
            eq(admin_settings.moduleId, moduleId),
            eq(admin_settings.key, key)
          )
        )
        .returning()
    );
    return setting;
  }

  async deleteModuleSetting(moduleId: string, key: string): Promise<boolean> {
    const result = await this.executeQuery(() =>
      this.db
        .delete(admin_settings)
        .where(
          and(
            eq(admin_settings.moduleId, moduleId),
            eq(admin_settings.key, key)
          )
        )
    );
    return result.rowCount > 0;
  }

  // ============= LOGGING =============

  async createLog(log: InsertAdminLog): Promise<AdminLog> {
    const [newLog] = await this.executeQuery(() =>
      this.db
        .insert(admin_logs)
        .values({
          ...log,
          timestamp: new Date(),
        })
        .returning()
    );
    return newLog;
  }

  async getModuleLogs(moduleId: string, limit: number = 50): Promise<AdminLog[]> {
    return await this.executeQuery(() =>
      this.db
        .select()
        .from(admin_logs)
        .where(eq(admin_logs.moduleId, moduleId))
        .orderBy(desc(admin_logs.timestamp))
        .limit(limit)
    );
  }

  async getUserLogs(userId: string, limit: number = 50): Promise<AdminLog[]> {
    return await this.executeQuery(() =>
      this.db
        .select()
        .from(admin_logs)
        .where(eq(admin_logs.userId, userId))
        .orderBy(desc(admin_logs.timestamp))
        .limit(limit)
    );
  }

  // ============= PERMISSION MANAGEMENT =============

  async getModulePermissions(moduleId: string): Promise<AdminModulePermission[]> {
    return await this.executeQuery(() =>
      this.db
        .select()
        .from(admin_module_permissions)
        .where(eq(admin_module_permissions.moduleId, moduleId))
    );
  }

  async getRolePermissions(role: string): Promise<AdminModulePermission[]> {
    return await this.executeQuery(() =>
      this.db
        .select()
        .from(admin_module_permissions)
        .where(eq(admin_module_permissions.role, role))
    );
  }

  async createRolePermission(permission: InsertAdminModulePermission): Promise<AdminModulePermission> {
    const [newPermission] = await this.executeQuery(() =>
      this.db
        .insert(admin_module_permissions)
        .values({
          ...permission,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning()
    );
    return newPermission;
  }

  async updateRolePermission(moduleId: string, role: string, canAccess: boolean): Promise<AdminModulePermission | undefined> {
    const [permission] = await this.executeQuery(() =>
      this.db
        .update(admin_module_permissions)
        .set({ canAccess, updatedAt: new Date() })
        .where(
          and(
            eq(admin_module_permissions.moduleId, moduleId),
            eq(admin_module_permissions.role, role)
          )
        )
        .returning()
    );
    return permission;
  }

  async deleteRolePermission(moduleId: string, role: string): Promise<boolean> {
    const result = await this.executeQuery(() =>
      this.db
        .delete(admin_module_permissions)
        .where(
          and(
            eq(admin_module_permissions.moduleId, moduleId),
            eq(admin_module_permissions.role, role)
          )
        )
    );
    return result.rowCount > 0;
  }

  // ============= USER OVERRIDE MANAGEMENT =============

  async getUserModuleOverrides(userId: string): Promise<AdminUserOverride[]> {
    return await this.executeQuery(() =>
      this.db
        .select()
        .from(admin_user_overrides)
        .where(eq(admin_user_overrides.userId, userId))
    );
  }

  async getModuleOverrides(moduleId: string): Promise<AdminUserOverride[]> {
    return await this.executeQuery(() =>
      this.db
        .select()
        .from(admin_user_overrides)
        .where(eq(admin_user_overrides.moduleId, moduleId))
    );
  }

  async createUserModuleOverride(override: InsertAdminUserOverride): Promise<AdminUserOverride> {
    const [newOverride] = await this.executeQuery(() =>
      this.db
        .insert(admin_user_overrides)
        .values({
          ...override,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning()
    );
    return newOverride;
  }

  async updateUserModuleOverride(userId: string, moduleId: string, enabled: boolean): Promise<AdminUserOverride | undefined> {
    const [override] = await this.executeQuery(() =>
      this.db
        .update(admin_user_overrides)
        .set({ enabled, updatedAt: new Date() })
        .where(
          and(
            eq(admin_user_overrides.userId, userId),
            eq(admin_user_overrides.moduleId, moduleId)
          )
        )
        .returning()
    );
    return override;
  }

  async deleteUserModuleOverride(userId: string, moduleId: string): Promise<boolean> {
    const result = await this.executeQuery(() =>
      this.db
        .delete(admin_user_overrides)
        .where(
          and(
            eq(admin_user_overrides.userId, userId),
            eq(admin_user_overrides.moduleId, moduleId)
          )
        )
    );
    return result.rowCount > 0;
  }

  // ============= ACCESS CONTROL COMPUTATION =============
  
  /**
   * Check if a user has access to a module
   * Note: This method needs user data from the users module
   * In a distributed setup, this would call the users service
   */
  async checkModuleAccess(userId: string, moduleId: string, userRole?: string): Promise<{hasAccess: boolean, reason: string}> {
    try {
      // Check if module exists and is active
      const module = await this.getModule(moduleId);
      if (!module) {
        return { hasAccess: false, reason: 'module_not_found' };
      }
      
      if (!module.isActive) {
        return { hasAccess: false, reason: 'module_disabled' };
      }

      // Check for user-specific override first
      const override = await this.executeQuery(() =>
        this.db
          .select()
          .from(admin_user_overrides)
          .where(
            and(
              eq(admin_user_overrides.userId, userId),
              eq(admin_user_overrides.moduleId, moduleId)
            )
          )
      );

      if (override.length > 0) {
        return { 
          hasAccess: override[0].enabled, 
          reason: override[0].enabled ? 'user_override_enabled' : 'user_override_disabled' 
        };
      }

      // Check role-based permissions
      if (userRole) {
        const rolePermission = await this.executeQuery(() =>
          this.db
            .select()
            .from(admin_module_permissions)
            .where(
              and(
                eq(admin_module_permissions.moduleId, moduleId),
                eq(admin_module_permissions.role, userRole)
              )
            )
        );

        if (rolePermission.length > 0) {
          return {
            hasAccess: rolePermission[0].canAccess,
            reason: rolePermission[0].canAccess ? 'role_permission_granted' : 'role_permission_denied'
          };
        }
      }

      // Default: no access
      return { hasAccess: false, reason: 'no_permission_defined' };

    } catch (error) {
      console.error(`Error checking module access for user ${userId}, module ${moduleId}:`, error);
      return { hasAccess: false, reason: 'access_check_error' };
    }
  }

  /**
   * Get all modules a user has access to
   * Note: This method needs user data from the users module
   */
  async getUserAccessibleModules(userId: string, userRole?: string): Promise<AdminModule[]> {
    try {
      const allModules = await this.getAllModules();
      const accessibleModules: AdminModule[] = [];

      for (const module of allModules) {
        const accessCheck = await this.checkModuleAccess(userId, module.id, userRole);
        if (accessCheck.hasAccess) {
          accessibleModules.push(module);
        }
      }

      return accessibleModules;
    } catch (error) {
      console.error(`Error getting accessible modules for user ${userId}:`, error);
      return [];
    }
  }
}