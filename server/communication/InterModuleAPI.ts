import type { 
  BaseUser, 
  CreateUserRequest, 
  AdminActionLog, 
  ModuleSettings,
  UserContract,
  AdminContract
} from "@shared/contracts";
import type { ModuleServiceRegistry, ModuleEventBus } from "@shared/contracts";

// ============= INTER-MODULE API IMPLEMENTATIONS =============

/**
 * Safe API wrapper for users module - used by other modules
 * This provides a contract-based way to interact with user data
 * without direct database access
 */
export class UsersModuleAPI implements UserContract['exports'] {
  private serviceRegistry: ModuleServiceRegistry;
  private eventBus: ModuleEventBus;

  constructor(serviceRegistry: ModuleServiceRegistry, eventBus: ModuleEventBus) {
    this.serviceRegistry = serviceRegistry;
    this.eventBus = eventBus;
  }

  async getUserById(userId: string): Promise<BaseUser | undefined> {
    const usersService = this.serviceRegistry.getService<any>('users');
    
    if (!usersService || !usersService.storage) {
      console.warn("Users service not available");
      return undefined;
    }

    try {
      const user = await usersService.storage.getUser(userId);
      
      // Emit event for audit trail
      await this.eventBus.emit({
        type: 'user_accessed',
        moduleId: 'users',
        data: { userId, accessedBy: 'inter-module-api' },
        timestamp: new Date()
      });

      return user ? {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      } : undefined;

    } catch (error) {
      console.error("Error getting user by ID:", error);
      return undefined;
    }
  }

  async getUserByUsername(username: string): Promise<BaseUser | undefined> {
    const usersService = this.serviceRegistry.getService<any>('users');
    
    if (!usersService || !usersService.storage) {
      console.warn("Users service not available");
      return undefined;
    }

    try {
      const user = await usersService.storage.getUserByUsername(username);
      
      // Emit event for audit trail
      await this.eventBus.emit({
        type: 'user_accessed',
        moduleId: 'users', 
        data: { username, accessedBy: 'inter-module-api' },
        timestamp: new Date()
      });

      return user ? {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      } : undefined;

    } catch (error) {
      console.error("Error getting user by username:", error);
      return undefined;
    }
  }

  async verifyUserAccess(userId: string, resource: string): Promise<boolean> {
    const usersService = this.serviceRegistry.getService<any>('users');
    
    if (!usersService || !usersService.storage) {
      console.warn("Users service not available");
      return false;
    }

    try {
      const user = await usersService.storage.getUser(userId);
      
      if (!user || !user.isActive) {
        return false;
      }

      // Basic role-based access control
      // This could be expanded with more sophisticated permission checking
      const accessMap: Record<string, string[]> = {
        'admin': ['admin', 'users', 'settings', 'logs'],
        'moderator': ['users', 'settings'],
        'user': ['profile', 'preferences']
      };

      const allowedResources = accessMap[user.role] || [];
      return allowedResources.includes(resource);

    } catch (error) {
      console.error("Error verifying user access:", error);
      return false;
    }
  }

  async createUser(userData: CreateUserRequest): Promise<BaseUser> {
    const usersService = this.serviceRegistry.getService<any>('users');
    
    if (!usersService || !usersService.storage) {
      throw new Error("Users service not available");
    }

    try {
      const user = await usersService.storage.createUser(userData);
      
      // Emit event for other modules to react to
      await this.eventBus.emit({
        type: 'user_created',
        moduleId: 'users',
        data: { 
          userId: user.id, 
          username: user.username, 
          role: user.role,
          createdBy: 'inter-module-api'
        },
        timestamp: new Date()
      });

      return {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      };

    } catch (error) {
      console.error("Error creating user:", error);
      throw error;
    }
  }
}

/**
 * Safe API wrapper for admin module - used by other modules
 */
export class AdminModuleAPI implements AdminContract['exports'] {
  private serviceRegistry: ModuleServiceRegistry;
  private eventBus: ModuleEventBus;

  constructor(serviceRegistry: ModuleServiceRegistry, eventBus: ModuleEventBus) {
    this.serviceRegistry = serviceRegistry;
    this.eventBus = eventBus;
  }

  async logAdminAction(action: AdminActionLog): Promise<void> {
    const adminService = this.serviceRegistry.getService<any>('admin');
    
    if (!adminService || !adminService.storage) {
      console.warn("Admin service not available - action not logged:", action);
      return;
    }

    try {
      await adminService.storage.createLog({
        moduleId: action.moduleId,
        userId: action.userId,
        action: action.action,
        details: action.details
      });

      // Emit event for real-time monitoring
      await this.eventBus.emit({
        type: 'admin_action_logged',
        moduleId: 'admin',
        data: action,
        timestamp: new Date()
      });

    } catch (error) {
      console.error("Error logging admin action:", error);
    }
  }

  async getModuleSettings(moduleId: string): Promise<ModuleSettings> {
    const adminService = this.serviceRegistry.getService<any>('admin');
    
    if (!adminService || !adminService.storage) {
      console.warn("Admin service not available");
      return {};
    }

    try {
      const settings = await adminService.storage.getModuleSettings(moduleId);
      
      // Convert settings array to key-value object
      const settingsObject: ModuleSettings = {};
      settings.forEach((setting: any) => {
        settingsObject[setting.key] = setting.value;
      });

      return settingsObject;

    } catch (error) {
      console.error("Error getting module settings:", error);
      return {};
    }
  }

  async checkModulePermission(userId: string, moduleId: string): Promise<boolean> {
    const adminService = this.serviceRegistry.getService<any>('admin');
    const usersAPI = new UsersModuleAPI(this.serviceRegistry, this.eventBus);
    
    if (!adminService || !adminService.storage) {
      console.warn("Admin service not available");
      return false;
    }

    try {
      // Get user information
      const user = await usersAPI.getUserById(userId);
      if (!user || !user.isActive) {
        return false;
      }

      // Check module permission using admin storage
      const accessCheck = await adminService.storage.checkModuleAccess(userId, moduleId, user.role);
      
      // Emit audit event
      await this.eventBus.emit({
        type: 'permission_checked',
        moduleId: 'admin',
        data: {
          userId,
          moduleId,
          result: accessCheck.hasAccess,
          reason: accessCheck.reason
        },
        timestamp: new Date()
      });

      return accessCheck.hasAccess;

    } catch (error) {
      console.error("Error checking module permission:", error);
      return false;
    }
  }
}

// ============= API FACTORY =============

export class InterModuleAPIFactory {
  private serviceRegistry: ModuleServiceRegistry;
  private eventBus: ModuleEventBus;
  private apis: Map<string, any> = new Map();

  constructor(serviceRegistry: ModuleServiceRegistry, eventBus: ModuleEventBus) {
    this.serviceRegistry = serviceRegistry;
    this.eventBus = eventBus;
  }

  getUsersAPI(): UsersModuleAPI {
    if (!this.apis.has('users')) {
      this.apis.set('users', new UsersModuleAPI(this.serviceRegistry, this.eventBus));
    }
    return this.apis.get('users');
  }

  getAdminAPI(): AdminModuleAPI {
    if (!this.apis.has('admin')) {
      this.apis.set('admin', new AdminModuleAPI(this.serviceRegistry, this.eventBus));
    }
    return this.apis.get('admin');
  }

  // Factory method for getting any module API
  getModuleAPI<T>(moduleId: string): T | undefined {
    return this.apis.get(moduleId);
  }

  // Register a custom module API
  registerModuleAPI<T>(moduleId: string, api: T): void {
    this.apis.set(moduleId, api);
  }
}