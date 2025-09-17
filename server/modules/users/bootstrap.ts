import { Router } from "express";
import type { ModuleBootstrapResult, ModuleManifest, ModuleLifecycle } from "../../types/module";
import { UsersModuleStorage } from "./storage";
import { createUserController } from "./controller";

// ============= USERS MODULE MANIFEST =============

export const usersManifest: ModuleManifest = {
  id: "users",
  name: "users",
  displayName: "User Management",
  description: "User authentication, profiles, and session management",
  version: "1.0.0",
  apiPrefix: "/api/users",
  dbNamespace: "users_",
  dependencies: [], // Users module has no dependencies
  requiredRole: "user", // Base access level
  isCore: true,
  capabilities: [
    {
      id: "authentication",
      name: "Authentication",
      description: "User login, registration, and session management",
      endpoints: ["/login", "/register", "/logout", "/refresh"]
    },
    {
      id: "profile_management",
      name: "Profile Management", 
      description: "User profile and preferences management",
      endpoints: ["/profile", "/preferences", "/password"]
    },
    {
      id: "session_management",
      name: "Session Management",
      description: "Manage user sessions and activity tracking",
      endpoints: ["/sessions", "/activity"]
    },
    {
      id: "data_privacy",
      name: "Data Privacy",
      description: "Data export and account deletion capabilities",
      endpoints: ["/export", "/delete-account"]
    }
  ]
};

// ============= USERS MODULE BOOTSTRAP =============

export async function bootstrapUsersModule(): Promise<ModuleBootstrapResult> {
  console.log("👤 Bootstrapping Users Module...");

  // Create isolated storage (initialization handled in lifecycle)
  const storage = new UsersModuleStorage();

  // Create controller with injected storage
  const controller = createUserController(storage);

  // Create router with all users endpoints
  const router = Router();

  // ============= AUTHENTICATION ROUTES =============
  
  router.post("/login", async (req, res) => {
    try {
      const { username, password, rememberMe } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }

      const result = await controller.login(username, password, rememberMe);
      
      // Set session cookie
      res.cookie('session_token', result.sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000, // 30 days or 1 day
        sameSite: 'lax'
      });

      res.json({
        success: true,
        user: result.user,
        expiresAt: result.expiresAt
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(401).json({ error: error instanceof Error ? error.message : "Login failed" });
    }
  });

  router.post("/register", async (req, res) => {
    try {
      const userData = req.body;
      
      if (!userData.username || !userData.password) {
        return res.status(400).json({ error: "Username and password are required" });
      }

      const user = await controller.register(userData);
      res.status(201).json(user);
    } catch (error) {
      console.error("Registration error:", error);
      const status = error instanceof Error && error.message.includes("already exists") ? 409 : 500;
      res.status(status).json({ error: error instanceof Error ? error.message : "Registration failed" });
    }
  });

  router.post("/logout", async (req, res) => {
    try {
      const sessionToken = req.cookies.session_token || req.headers.authorization?.replace('Bearer ', '');
      
      if (sessionToken) {
        await controller.logout(sessionToken);
      }

      res.clearCookie('session_token');
      res.json({ success: true });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ error: "Logout failed" });
    }
  });

  router.post("/refresh", async (req, res) => {
    try {
      const sessionToken = req.cookies.session_token || req.headers.authorization?.replace('Bearer ', '');
      
      if (!sessionToken) {
        return res.status(401).json({ error: "No session token provided" });
      }

      const extendBy = req.body.extendBy || 2; // hours
      const result = await controller.refreshSession(sessionToken, extendBy);

      // Update session cookie
      res.cookie('session_token', result.sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: extendBy * 60 * 60 * 1000, // hours to milliseconds
        sameSite: 'lax'
      });

      res.json(result);
    } catch (error) {
      console.error("Refresh session error:", error);
      res.status(401).json({ error: error instanceof Error ? error.message : "Session refresh failed" });
    }
  });

  // ============= PROFILE MANAGEMENT ROUTES =============

  router.get("/profile", async (req, res) => {
    try {
      const userId = req.user?.id; // TODO: Extract from auth middleware
      
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const profile = await controller.getUserProfile(userId);
      res.json(profile);
    } catch (error) {
      console.error("Get profile error:", error);
      res.status(500).json({ error: "Failed to fetch user profile" });
    }
  });

  router.put("/profile", async (req, res) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const updates = req.body;
      const updatedUser = await controller.updateUserProfile(userId, updates);
      res.json(updatedUser);
    } catch (error) {
      console.error("Update profile error:", error);
      res.status(500).json({ error: "Failed to update user profile" });
    }
  });

  router.put("/password", async (req, res) => {
    try {
      const userId = req.user?.id;
      const { currentPassword, newPassword } = req.body;
      
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Current password and new password are required" });
      }

      const result = await controller.changeUserPassword(userId, currentPassword, newPassword);
      res.json(result);
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to change password" });
    }
  });

  // ============= PREFERENCES ROUTES =============

  router.get("/preferences", async (req, res) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const preferences = await controller.getUserPreferences(userId);
      res.json(preferences);
    } catch (error) {
      console.error("Get preferences error:", error);
      res.status(500).json({ error: "Failed to fetch user preferences" });
    }
  });

  router.put("/preferences", async (req, res) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const updates = req.body;
      const preferences = await controller.updateUserPreferences(userId, updates);
      res.json(preferences);
    } catch (error) {
      console.error("Update preferences error:", error);
      res.status(500).json({ error: "Failed to update user preferences" });
    }
  });

  // ============= SESSION MANAGEMENT ROUTES =============

  router.get("/sessions", async (req, res) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const sessions = await controller.getUserSessions(userId);
      res.json(sessions);
    } catch (error) {
      console.error("Get sessions error:", error);
      res.status(500).json({ error: "Failed to fetch user sessions" });
    }
  });

  router.get("/activity", async (req, res) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const activity = await controller.getUserActivity(userId, limit);
      res.json(activity);
    } catch (error) {
      console.error("Get activity error:", error);
      res.status(500).json({ error: "Failed to fetch user activity" });
    }
  });

  // ============= DATA PRIVACY ROUTES =============

  router.get("/export", async (req, res) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const exportData = await controller.exportUserData(userId);
      res.json(exportData);
    } catch (error) {
      console.error("Export data error:", error);
      res.status(500).json({ error: "Failed to export user data" });
    }
  });

  router.post("/delete-account", async (req, res) => {
    try {
      const userId = req.user?.id;
      const { reason } = req.body;
      
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const result = await controller.requestAccountDeletion(userId, reason);
      res.json(result);
    } catch (error) {
      console.error("Delete account error:", error);
      res.status(500).json({ error: "Failed to request account deletion" });
    }
  });

  // ============= MODULE LIFECYCLE =============

  const lifecycle: ModuleLifecycle = {
    onInit: async () => {
      console.log("👤 Users module initializing...");
      await storage.initialize();
      console.log("✅ Users module database initialized");
    },

    onStart: async () => {
      console.log("🟢 Users module started");
      // Start session cleanup interval
      setInterval(async () => {
        try {
          await storage.cleanExpiredSessions();
        } catch (error) {
          console.error("Session cleanup error:", error);
        }
      }, 5 * 60 * 1000); // Every 5 minutes
    },

    onStop: async () => {
      console.log("🟡 Users module stopping...");
    },

    onHealthCheck: async () => {
      const isHealthy = await storage.healthCheck();
      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        message: isHealthy ? 'Users module operating normally' : 'Users module database issues',
        details: {
          storage: isHealthy ? 'connected' : 'disconnected',
          timestamp: new Date().toISOString()
        }
      };
    },

    onDestroy: async () => {
      console.log("🔴 Users module destroying...");
      await storage.cleanup();
    }
  };

  console.log("✅ Users Module bootstrapped successfully");

  return {
    router,
    lifecycle,
    manifest: usersManifest,
    storage
  };
}