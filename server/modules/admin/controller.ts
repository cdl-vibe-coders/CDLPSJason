import { AdminModuleStorage } from "./storage";
import type { 
  DashboardStats, 
  ModuleWithStats, 
  SystemHealth,
  AdminModuleError,
  AuditLogEntry
} from "./types";
import type { 
  AdminModule, 
  InsertAdminModule,
  AdminModulePermission,
  InsertAdminModulePermission,
  AdminUserOverride,
  InsertAdminUserOverride 
} from "./schema";

// ============= ADMIN DASHBOARD CONTROLLER =============

export class AdminController {
  private storage: AdminModuleStorage;
  
  constructor(storage: AdminModuleStorage) {
    this.storage = storage;
  }
  
  // ============= DASHBOARD OPERATIONS =============
  
  async getDashboardStats(): Promise<DashboardStats> {
    try {
      // This would require additional storage methods for user counts
      // For now, return mock data that can be implemented later
      const modules = await this.storage.getAllModules();
      const activeModules = modules.filter(m => m.isActive);
      
      return {
        totalUsers: 0, // Placeholder - needs storage.getTotalUserCount()
        activeUsers: 0, // Placeholder - needs storage.getActiveUserCount()  
        totalModules: modules.length,
        activeModules: activeModules.length,
        recentLogsCount: 0, // Placeholder - needs storage.getRecentLogsCount()
        systemHealth: 'healthy'
      };
    } catch (error) {
      console.error('Dashboard stats error:', error);
      throw new Error('Failed to fetch dashboard statistics');
    }
  }

  async getSystemHealth(): Promise<SystemHealth> {
    try {
      const modules = await this.storage.getAllModules();
      
      return {
        database: 'connected',
        modules: modules.map(module => ({
          name: module.name,
          status: module.isActive ? 'active' : 'inactive',
          lastCheck: new Date()
        })),
        uptime: process.uptime(),
        memory: {
          used: process.memoryUsage().heapUsed,
          total: process.memoryUsage().heapTotal,
          percentage: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100
        }
      };
    } catch (error) {
      console.error('System health check error:', error);
      throw new Error('Failed to check system health');
    }
  }

  // ============= MODULE MANAGEMENT =============
  
  async getAllModulesWithStats(): Promise<ModuleWithStats[]> {
    try {
      const modules = await this.storage.getAllModules();
      
      // Enhance modules with stats (would need additional storage methods)
      const modulesWithStats: ModuleWithStats[] = await Promise.all(
        modules.map(async (module) => {
          const recentLogs = await this.storage.getModuleLogs(module.id, 5);
          
          return {
            ...module,
            totalUsers: 0, // Placeholder
            activeUsers: 0, // Placeholder  
            settingsCount: (await this.storage.getModuleSettings(module.id)).length,
            recentActivity: recentLogs
          };
        })
      );
      
      return modulesWithStats;
    } catch (error) {
      console.error('Get modules with stats error:', error);
      throw new Error('Failed to fetch modules with statistics');
    }
  }
  
  async getModuleById(moduleId: string): Promise<ModuleWithStats> {
    try {
      const module = await this.storage.getModule(moduleId);
      if (!module) {
        throw new Error('Module not found');
      }
      
      const recentLogs = await this.storage.getModuleLogs(module.id, 10);
      
      return {
        ...module,
        totalUsers: 0, // Placeholder
        activeUsers: 0, // Placeholder
        settingsCount: (await this.storage.getModuleSettings(module.id)).length,
        recentActivity: recentLogs
      };
    } catch (error) {
      console.error('Get module error:', error);
      throw new Error('Failed to fetch module details');
    }
  }
  
  async createModule(moduleData: InsertAdminModule, adminUserId: string) {
    try {
      const module = await this.storage.createModule(moduleData);
      
      // Log the creation
      await this.storage.createLog({
        moduleId: module.id,
        userId: adminUserId,
        action: "module_created",
        details: { name: module.name, version: module.version }
      });
      
      return module;
    } catch (error) {
      console.error('Create module error:', error);
      if (error instanceof Error && error.message.includes('unique constraint')) {
        throw new Error('Module name already exists');
      }
      throw new Error('Failed to create module');
    }
  }
  
  async updateModule(moduleId: string, updates: Partial<InsertAdminModule>, adminUserId: string) {
    try {
      const module = await this.storage.updateModule(moduleId, updates);
      if (!module) {
        throw new Error('Module not found');
      }
      
      // Log the update
      await this.storage.createLog({
        moduleId: module.id,
        userId: adminUserId,
        action: "module_updated",
        details: updates
      });
      
      return module;
    } catch (error) {
      console.error('Update module error:', error);
      throw new Error('Failed to update module');
    }
  }
  
  async toggleModuleStatus(moduleId: string, isActive: boolean, adminUserId: string) {
    try {
      const module = await this.storage.toggleModuleStatus(moduleId, isActive);
      if (!module) {
        throw new Error('Module not found');
      }
      
      // Log the toggle
      await this.storage.createLog({
        moduleId: module.id,
        userId: adminUserId,
        action: isActive ? "module_enabled" : "module_disabled",
        details: { previousStatus: !isActive, newStatus: isActive }
      });
      
      return module;
    } catch (error) {
      console.error('Toggle module status error:', error);
      throw new Error('Failed to toggle module status');
    }
  }

  // ============= ROLE PERMISSION MANAGEMENT =============
  
  async getModulePermissions(moduleId: string) {
    try {
      return await this.storage.getModulePermissions(moduleId);
    } catch (error) {
      console.error('Get module permissions error:', error);
      throw new Error('Failed to fetch module permissions');
    }
  }
  
  async getRolePermissions(role: string) {
    try {
      return await this.storage.getRolePermissions(role);
    } catch (error) {
      console.error('Get role permissions error:', error);
      throw new Error('Failed to fetch role permissions');
    }
  }
  
  async createRolePermission(permissionData: InsertAdminModulePermission, adminUserId: string) {
    try {
      const permission = await this.storage.createRolePermission(permissionData);
      
      // Log the permission change
      await this.storage.createLog({
        moduleId: permissionData.moduleId,
        userId: adminUserId,
        action: "role_permission_created",
        details: { role: permissionData.role, canAccess: permissionData.canAccess }
      });
      
      return permission;
    } catch (error) {
      console.error('Create role permission error:', error);
      if (error instanceof Error && error.message.includes('unique constraint')) {
        throw new Error('Role permission already exists for this module');
      }
      throw new Error('Failed to create role permission');
    }
  }
  
  async updateRolePermission(moduleId: string, role: string, canAccess: boolean, adminUserId: string) {
    try {
      const permission = await this.storage.updateRolePermission(moduleId, role, canAccess);
      if (!permission) {
        throw new Error('Role permission not found');
      }
      
      // Log the permission change
      await this.storage.createLog({
        moduleId,
        userId: adminUserId,
        action: "role_permission_updated",
        details: { role, canAccess }
      });
      
      return permission;
    } catch (error) {
      console.error('Update role permission error:', error);
      throw new Error('Failed to update role permission');
    }
  }
  
  async deleteRolePermission(moduleId: string, role: string, adminUserId: string) {
    try {
      const success = await this.storage.deleteRolePermission(moduleId, role);
      if (!success) {
        throw new Error('Role permission not found');
      }
      
      // Log the deletion
      await this.storage.createLog({
        moduleId,
        userId: adminUserId,
        action: "role_permission_deleted",
        details: { role }
      });
      
      return success;
    } catch (error) {
      console.error('Delete role permission error:', error);
      throw new Error('Failed to delete role permission');
    }
  }

  // ============= USER MODULE OVERRIDES =============
  
  async getUserModuleOverrides(userId: string) {
    try {
      return await this.storage.getUserModuleOverrides(userId);
    } catch (error) {
      console.error('Get user module overrides error:', error);
      throw new Error('Failed to fetch user module overrides');
    }
  }
  
  async getModuleUserOverrides(moduleId: string) {
    try {
      return await this.storage.getModuleOverrides(moduleId);
    } catch (error) {
      console.error('Get module user overrides error:', error);
      throw new Error('Failed to fetch module user overrides');
    }
  }
  
  async createUserModuleOverride(overrideData: InsertAdminUserOverride, adminUserId: string) {
    try {
      const override = await this.storage.createUserModuleOverride(overrideData);
      
      // Log the override creation
      await this.storage.createLog({
        moduleId: overrideData.moduleId,
        userId: adminUserId,
        action: "user_override_created",
        details: { targetUserId: overrideData.userId, enabled: overrideData.enabled }
      });
      
      return override;
    } catch (error) {
      console.error('Create user module override error:', error);
      if (error instanceof Error && error.message.includes('unique constraint')) {
        throw new Error('User override already exists for this module');
      }
      throw new Error('Failed to create user module override');
    }
  }
  
  async updateUserModuleOverride(userId: string, moduleId: string, enabled: boolean, adminUserId: string) {
    try {
      const override = await this.storage.updateUserModuleOverride(userId, moduleId, enabled);
      if (!override) {
        throw new Error('User module override not found');
      }
      
      // Log the override update
      await this.storage.createLog({
        moduleId,
        userId: adminUserId,
        action: "user_override_updated",
        details: { targetUserId: userId, enabled }
      });
      
      return override;
    } catch (error) {
      console.error('Update user module override error:', error);
      throw new Error('Failed to update user module override');
    }
  }
  
  async deleteUserModuleOverride(userId: string, moduleId: string, adminUserId: string) {
    try {
      const success = await this.storage.deleteUserModuleOverride(userId, moduleId);
      if (!success) {
        throw new Error('User module override not found');
      }
      
      // Log the override deletion
      await this.storage.createLog({
        moduleId,
        userId: adminUserId,
        action: "user_override_deleted",
        details: { targetUserId: userId }
      });
      
      return success;
    } catch (error) {
      console.error('Delete user module override error:', error);
      throw new Error('Failed to delete user module override');
    }
  }

  // ============= ACCESS CONTROL UTILITIES =============
  
  async checkUserModuleAccess(userId: string, moduleId: string) {
    try {
      return await this.storage.checkModuleAccess(userId, moduleId);
    } catch (error) {
      console.error('Check user module access error:', error);
      throw new Error('Failed to check module access');
    }
  }
  
  async getUserAccessibleModules(userId: string) {
    try {
      return await this.storage.getUserAccessibleModules(userId);
    } catch (error) {
      console.error('Get user accessible modules error:', error);
      throw new Error('Failed to fetch accessible modules');
    }
  }

  // ============= LOGGING =============
  
  async getModuleLogs(moduleId: string, limit?: number) {
    try {
      return await this.storage.getModuleLogs(moduleId, limit);
    } catch (error) {
      console.error('Get module logs error:', error);
      throw new Error('Failed to fetch module logs');
    }
  }
  
  async getUserLogs(userId: string, limit?: number) {
    try {
      return await this.storage.getUserLogs(userId, limit);
    } catch (error) {
      console.error('Get user logs error:', error);
      throw new Error('Failed to fetch user logs');
    }
  }
}

// Controller factory function - will be called by bootstrap
export function createAdminController(storage: AdminModuleStorage): AdminController {
  return new AdminController(storage);
}