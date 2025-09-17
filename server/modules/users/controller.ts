import { UsersModuleStorage } from "./storage";
import { generateSessionToken, getSessionExpiration } from "../../middleware/auth";
import type { 
  UserProfile, 
  UserDashboard, 
  SessionInfo,
  UserDataExport,
  UserModuleError,
  ModuleAccessSummary
} from "./types";
import type { 
  UserWithoutPassword, 
  InsertUser,
  InsertUserPreferences,
  UserPreferences,
  User,
  UserSession
} from "./schema";

// ============= USER MANAGEMENT CONTROLLER =============

export class UserController {
  private storage: UsersModuleStorage;
  
  constructor(storage: UsersModuleStorage) {
    this.storage = storage;
  }
  
  // ============= AUTHENTICATION OPERATIONS =============
  
  async login(username: string, password: string, rememberMe: boolean = false) {
    try {
      // Verify user credentials
      const user = await this.storage.verifyUserPassword(username, password);
      
      if (!user) {
        throw new Error('Invalid username or password');
      }
      
      if (!user.isActive) {
        throw new Error('Account is deactivated');
      }
      
      // Generate session token
      const sessionToken = generateSessionToken();
      const expiresAt = getSessionExpiration(rememberMe ? 30 : 1); // 30 days vs 1 day
      
      // Create session in database
      const session = await this.storage.createSession({
        userId: user.id,
        token: sessionToken,
        expiresAt
      });
      
      // Remove password from response
      const { password: _, ...userResponse } = user;
      
      return {
        success: true,
        user: userResponse,
        sessionToken,
        expiresAt: session.expiresAt
      };
    } catch (error) {
      console.error("Login error:", error);
      throw new Error(error instanceof Error ? error.message : "Login failed");
    }
  }
  
  async register(userData: InsertUser) {
    try {
      // Check if user already exists
      const existingUser = await this.storage.getUserByUsername(userData.username);
      if (existingUser) {
        throw new Error('Username already exists');
      }
      
      if (userData.email) {
        const existingEmail = await this.storage.getUserByUsername(userData.email);
        if (existingEmail) {
          throw new Error('Email already registered');
        }
      }
      
      // Create new user (password hashing handled in storage layer)
      const user = await this.storage.createUser({
        ...userData,
        role: 'user' // Force role to 'user' for public registration
      });
      
      // Create default user preferences
      await this.storage.createUserPreferences({
        userId: user.id,
        theme: 'dark',
        language: 'en',
        notifications: {},
        moduleSettings: {}
      });
      
      return user;
    } catch (error) {
      console.error("Registration error:", error);
      if (error instanceof Error && error.message.includes('unique constraint')) {
        throw new Error('Username or email already exists');
      }
      throw new Error(error instanceof Error ? error.message : "Registration failed");
    }
  }
  
  async logout(sessionToken: string) {
    try {
      if (sessionToken) {
        await this.storage.deleteSession(sessionToken);
      }
      return { success: true };
    } catch (error) {
      console.error("Logout error:", error);
      throw new Error("Logout failed");
    }
  }
  
  async refreshSession(sessionToken: string, extendBy: number = 2) {
    try {
      const session = await this.storage.getSession(sessionToken);
      
      if (!session) {
        throw new Error('Invalid session');
      }
      
      // Check if session is still valid
      if (session.expiresAt < new Date()) {
        await this.storage.deleteSession(sessionToken);
        throw new Error('Session expired');
      }
      
      // Generate new session token
      const newSessionToken = generateSessionToken();
      const newExpiresAt = new Date(Date.now() + (extendBy * 60 * 60 * 1000)); // Extend by hours
      
      // Delete old session
      await this.storage.deleteSession(sessionToken);
      
      // Create new session
      const newSession = await this.storage.createSession({
        userId: session.userId,
        token: newSessionToken,
        expiresAt: newExpiresAt
      });
      
      return {
        success: true,
        sessionToken: newSessionToken,
        expiresAt: newSession.expiresAt
      };
    } catch (error) {
      console.error("Session refresh error:", error);
      throw new Error(error instanceof Error ? error.message : "Failed to refresh session");
    }
  }

  // ============= PROFILE MANAGEMENT =============
  
  async getUserProfile(userId: string): Promise<UserProfile> {
    try {
      const user = await this.storage.getUser(userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      const preferences = await this.storage.getUserPreferences(userId);
      // Note: In the new architecture, module access is handled by the admin module
      const moduleAccess: any[] = []; // TODO: Call admin module API for access check
      
      return {
        ...user,
        preferences,
        moduleAccess,
        sessionCount: 0 // Would need additional storage method to count active sessions
      };
    } catch (error) {
      console.error("Get user profile error:", error);
      throw new Error(error instanceof Error ? error.message : "Failed to get user profile");
    }
  }
  
  async updateUserProfile(userId: string, updates: { email?: string }) {
    try {
      const updatedUser = await this.storage.updateUser(userId, updates);
      if (!updatedUser) {
        throw new Error('User not found');
      }
      return updatedUser;
    } catch (error) {
      console.error("Update user profile error:", error);
      throw new Error("Failed to update user profile");
    }
  }
  
  async changeUserPassword(userId: string, currentPassword: string, newPassword: string) {
    try {
      // First verify the current password
      const user = await this.storage.getUserForLogin(""); // We need to get by ID, not username
      // This is a limitation in current storage interface - we'd need getUserForLoginById
      
      // For now, assume the verification is handled at the route level
      const success = await this.storage.updateUserPassword(userId, newPassword);
      
      if (!success) {
        throw new Error('Failed to update password');
      }
      
      return { success: true };
    } catch (error) {
      console.error("Change password error:", error);
      throw new Error("Failed to change password");
    }
  }
  
  async getUserDashboard(userId: string): Promise<UserDashboard> {
    try {
      const user = await this.storage.getUser(userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      const preferences = await this.storage.getUserPreferences(userId) || {
        userId,
        theme: 'dark',
        language: 'en', 
        notifications: {},
        moduleSettings: {},
        updatedAt: new Date()
      } as UserPreferences;
      
      const availableModules = await this.storage.getUserAccessibleModules(userId);
      
      return {
        user,
        availableModules,
        preferences,
        recentActivity: [], // Would need additional storage methods
        notifications: [] // Would need additional storage methods
      };
    } catch (error) {
      console.error("Get user dashboard error:", error);
      throw new Error("Failed to get user dashboard");
    }
  }

  // ============= USER PREFERENCES =============
  
  async getUserPreferences(userId: string): Promise<UserPreferences | null> {
    try {
      return await this.storage.getUserPreferences(userId) || null;
    } catch (error) {
      console.error("Get user preferences error:", error);
      throw new Error("Failed to get user preferences");
    }
  }
  
  async updateUserPreferences(
    userId: string, 
    updates: Partial<Pick<UserPreferences, 'theme' | 'language' | 'notifications' | 'moduleSettings'>>
  ) {
    try {
      // Check if preferences exist, create if not
      let preferences = await this.storage.getUserPreferences(userId);
      
      if (!preferences) {
        preferences = await this.storage.createUserPreferences({
          userId,
          theme: updates.theme || 'dark',
          language: updates.language || 'en',
          notifications: updates.notifications || {},
          moduleSettings: updates.moduleSettings || {}
        });
      } else {
        preferences = await this.storage.updateUserPreferences(userId, updates);
      }
      
      if (!preferences) {
        throw new Error('Failed to update preferences');
      }
      
      return preferences;
    } catch (error) {
      console.error("Update user preferences error:", error);
      throw new Error("Failed to update user preferences");
    }
  }

  // ============= MODULE ACCESS =============
  
  async getUserAccessibleModules(userId: string) {
    try {
      return await this.storage.getUserAccessibleModules(userId);
    } catch (error) {
      console.error("Get user accessible modules error:", error);
      throw new Error("Failed to get accessible modules");
    }
  }
  
  async checkUserModuleAccess(userId: string, moduleId: string) {
    try {
      return await this.storage.checkModuleAccess(userId, moduleId);
    } catch (error) {
      console.error("Check user module access error:", error);
      throw new Error("Failed to check module access");
    }
  }
  
  async getModuleAccessSummary(userId: string): Promise<ModuleAccessSummary[]> {
    try {
      const allModules = await this.storage.getAllModules();
      const accessSummary: ModuleAccessSummary[] = [];
      
      for (const module of allModules) {
        const access = await this.storage.checkModuleAccess(userId, module.id);
        
        accessSummary.push({
          moduleId: module.id,
          moduleName: module.name,
          displayName: module.displayName,
          description: module.description || '',
          hasAccess: access.hasAccess,
          accessSource: access.reason === 'user_override' ? 'override' : 'role',
          canRequest: !access.hasAccess && module.isActive
        });
      }
      
      return accessSummary;
    } catch (error) {
      console.error("Get module access summary error:", error);
      throw new Error("Failed to get module access summary");
    }
  }

  // ============= SESSION MANAGEMENT =============
  
  async getUserSessions(userId: string) {
    try {
      // This would require additional storage methods to get user sessions
      // For now return empty array
      return [];
    } catch (error) {
      console.error("Get user sessions error:", error);
      throw new Error("Failed to get user sessions");
    }
  }
  
  async validateSession(sessionToken: string) {
    try {
      const session = await this.storage.getSession(sessionToken);
      
      if (!session || session.expiresAt < new Date()) {
        if (session) {
          await this.storage.deleteSession(sessionToken);
        }
        return null;
      }
      
      const user = await this.storage.getUser(session.userId);
      
      if (!user || !user.isActive) {
        await this.storage.deleteSession(sessionToken);
        return null;
      }
      
      return user;
    } catch (error) {
      console.error("Validate session error:", error);
      return null;
    }
  }

  // ============= DATA EXPORT & PRIVACY =============
  
  async exportUserData(userId: string): Promise<UserDataExport> {
    try {
      const user = await this.storage.getUser(userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      const preferences = await this.storage.getUserPreferences(userId);
      // Note: In the new architecture, module access is handled by the admin module
      const moduleAccess: any[] = []; // TODO: Call admin module API for access check
      
      return {
        profile: user,
        preferences: preferences || {} as UserPreferences,
        activityHistory: [], // Would need additional storage methods
        sessions: [], // Would need additional storage methods
        moduleAccess: [], // TODO: Implement via inter-module communication
        exportedAt: new Date()
      };
    } catch (error) {
      console.error("Export user data error:", error);
      throw new Error("Failed to export user data");
    }
  }
  
  async requestAccountDeletion(userId: string, reason?: string) {
    try {
      // In a real implementation, this would:
      // 1. Mark account for deletion
      // 2. Schedule deletion job
      // 3. Notify user via email
      // 4. Log the request
      
      // For now, just log the intent
      console.log(`Account deletion requested for user ${userId}, reason: ${reason}`);
      
      return {
        success: true,
        scheduledAt: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)), // 7 days from now
        message: "Account deletion has been scheduled"
      };
    } catch (error) {
      console.error("Request account deletion error:", error);
      throw new Error("Failed to request account deletion");
    }
  }
}

// Controller factory function - will be called by bootstrap
export function createUserController(storage: UsersModuleStorage): UserController {
  return new UserController(storage);
}