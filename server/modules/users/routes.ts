import type { Express, Request, Response } from "express";
import { userController } from "./controller";
import { 
  publicRegistrationSchema, 
  loginSchema, 
  profileUpdateSchema, 
  passwordChangeSchema,
  preferencesUpdateSchema,
  sessionRefreshSchema
} from "./types";
import { fromZodError } from "zod-validation-error";
import { requireAuth } from "../../middleware/auth";

export function registerUsersRoutes(app: Express) {
  // ============= AUTHENTICATION =============
  
  // Login
  app.post("/api/users/auth/login", async (req: Request, res: Response) => {
    try {
      const validation = loginSchema.safeParse(req.body);
      
      if (!validation.success) {
        const validationError = fromZodError(validation.error);
        return res.status(400).json({ error: validationError.message });
      }
      
      const { username, password, rememberMe } = validation.data;
      const result = await userController.login(username, password, rememberMe);
      
      // Set secure session cookie
      res.cookie('session', result.sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        expires: result.expiresAt,
        path: '/'
      });
      
      res.json(result);
    } catch (error) {
      console.error("Login error:", error);
      const message = error instanceof Error ? error.message : "Login failed";
      const statusCode = message.includes("Invalid") || message.includes("deactivated") ? 401 : 500;
      res.status(statusCode).json({ error: message });
    }
  });

  // Register (public)
  app.post("/api/users/auth/register", async (req: Request, res: Response) => {
    try {
      const validation = publicRegistrationSchema.safeParse(req.body);
      
      if (!validation.success) {
        const validationError = fromZodError(validation.error);
        return res.status(400).json({ error: validationError.message });
      }
      
      const { username, email, password } = validation.data;
      const user = await userController.register({ username, email, password });
      
      // Auto-login after registration
      const loginResult = await userController.login(username, password, false);
      
      // Set secure session cookie
      res.cookie('session', loginResult.sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        expires: loginResult.expiresAt,
        path: '/'
      });
      
      res.status(201).json({
        success: true,
        user,
        sessionToken: loginResult.sessionToken // For API clients
      });
    } catch (error) {
      console.error("Registration error:", error);
      const message = error instanceof Error ? error.message : "Registration failed";
      const statusCode = message.includes("already exists") ? 409 : 500;
      res.status(statusCode).json({ error: message });
    }
  });

  // Logout
  app.post("/api/users/auth/logout", async (req: Request, res: Response) => {
    try {
      // Get session token from cookie or header
      const sessionToken = req.cookies?.session || 
        (req.headers.authorization?.startsWith('Bearer ') ? 
         req.headers.authorization.substring(7) : null);
      
      await userController.logout(sessionToken);
      
      // Clear session cookie
      res.clearCookie('session', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/'
      });
      
      res.json({ success: true, message: "Logged out successfully" });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ error: "Logout failed" });
    }
  });

  // Get current user
  app.get("/api/users/auth/me", async (req: Request, res: Response) => {
    try {
      // Get session token from cookie or header
      const sessionToken = req.cookies?.session || 
        (req.headers.authorization?.startsWith('Bearer ') ? 
         req.headers.authorization.substring(7) : null);
      
      if (!sessionToken) {
        return res.status(401).json({ error: "No session found" });
      }
      
      const user = await userController.validateSession(sessionToken);
      
      if (!user) {
        res.clearCookie('session');
        return res.status(401).json({ error: "Session expired or invalid" });
      }
      
      res.json({ user });
    } catch (error) {
      console.error("Get current user error:", error);
      res.status(500).json({ error: "Failed to get user information" });
    }
  });

  // Refresh session
  app.post("/api/users/auth/refresh", async (req: Request, res: Response) => {
    try {
      const sessionToken = req.cookies?.session || 
        (req.headers.authorization?.startsWith('Bearer ') ? 
         req.headers.authorization.substring(7) : null);
      
      if (!sessionToken) {
        return res.status(401).json({ error: "No session to refresh" });
      }
      
      const validation = sessionRefreshSchema.safeParse(req.body);
      const extendBy = validation.success ? validation.data.extendBy : 2;
      
      const result = await userController.refreshSession(sessionToken, extendBy);
      
      // Set new cookie
      res.cookie('session', result.sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        expires: result.expiresAt,
        path: '/'
      });
      
      res.json(result);
    } catch (error) {
      console.error("Session refresh error:", error);
      const message = error instanceof Error ? error.message : "Failed to refresh session";
      const statusCode = message.includes("expired") || message.includes("Invalid") ? 401 : 500;
      res.status(statusCode).json({ error: message });
    }
  });

  // ============= PROFILE MANAGEMENT =============
  
  // Get user profile
  app.get("/api/users/profile", requireAuth, async (req: Request, res: Response) => {
    try {
      const profile = await userController.getUserProfile(req.user!.id);
      res.json(profile);
    } catch (error) {
      console.error("Get user profile error:", error);
      const message = error instanceof Error ? error.message : "Failed to get user profile";
      const statusCode = message === "User not found" ? 404 : 500;
      res.status(statusCode).json({ error: message });
    }
  });

  // Update user profile
  app.put("/api/users/profile", requireAuth, async (req: Request, res: Response) => {
    try {
      const validation = profileUpdateSchema.safeParse(req.body);
      
      if (!validation.success) {
        const validationError = fromZodError(validation.error);
        return res.status(400).json({ error: validationError.message });
      }
      
      const user = await userController.updateUserProfile(req.user!.id, validation.data);
      res.json(user);
    } catch (error) {
      console.error("Update user profile error:", error);
      const message = error instanceof Error ? error.message : "Failed to update user profile";
      const statusCode = message === "User not found" ? 404 : 500;
      res.status(statusCode).json({ error: message });
    }
  });

  // Change password
  app.put("/api/users/profile/password", requireAuth, async (req: Request, res: Response) => {
    try {
      const validation = passwordChangeSchema.safeParse(req.body);
      
      if (!validation.success) {
        const validationError = fromZodError(validation.error);
        return res.status(400).json({ error: validationError.message });
      }
      
      const { currentPassword, newPassword } = validation.data;
      const result = await userController.changeUserPassword(req.user!.id, currentPassword, newPassword);
      res.json(result);
    } catch (error) {
      console.error("Change password error:", error);
      const message = error instanceof Error ? error.message : "Failed to change password";
      res.status(500).json({ error: message });
    }
  });

  // Get user dashboard
  app.get("/api/users/dashboard", requireAuth, async (req: Request, res: Response) => {
    try {
      const dashboard = await userController.getUserDashboard(req.user!.id);
      res.json(dashboard);
    } catch (error) {
      console.error("Get user dashboard error:", error);
      const message = error instanceof Error ? error.message : "Failed to get user dashboard";
      const statusCode = message === "User not found" ? 404 : 500;
      res.status(statusCode).json({ error: message });
    }
  });

  // ============= USER PREFERENCES =============
  
  // Get user preferences
  app.get("/api/users/preferences", requireAuth, async (req: Request, res: Response) => {
    try {
      const preferences = await userController.getUserPreferences(req.user!.id);
      res.json(preferences);
    } catch (error) {
      console.error("Get user preferences error:", error);
      res.status(500).json({ error: "Failed to get user preferences" });
    }
  });

  // Update user preferences
  app.put("/api/users/preferences", requireAuth, async (req: Request, res: Response) => {
    try {
      const validation = preferencesUpdateSchema.safeParse(req.body);
      
      if (!validation.success) {
        const validationError = fromZodError(validation.error);
        return res.status(400).json({ error: validationError.message });
      }
      
      const preferences = await userController.updateUserPreferences(req.user!.id, validation.data);
      res.json(preferences);
    } catch (error) {
      console.error("Update user preferences error:", error);
      res.status(500).json({ error: "Failed to update user preferences" });
    }
  });

  // ============= MODULE ACCESS =============
  
  // Get user's accessible modules
  app.get("/api/users/modules", requireAuth, async (req: Request, res: Response) => {
    try {
      const modules = await userController.getUserAccessibleModules(req.user!.id);
      res.json({
        modules,
        user: {
          id: req.user!.id,
          username: req.user!.username,
          role: req.user!.role
        }
      });
    } catch (error) {
      console.error("Get user accessible modules error:", error);
      res.status(500).json({ error: "Failed to get accessible modules" });
    }
  });

  // Check access to a specific module
  app.get("/api/users/modules/:moduleId/access", requireAuth, async (req: Request, res: Response) => {
    try {
      const { moduleId } = req.params;
      const access = await userController.checkUserModuleAccess(req.user!.id, moduleId);
      res.json(access);
    } catch (error) {
      console.error("Check user module access error:", error);
      res.status(500).json({ error: "Failed to check module access" });
    }
  });

  // Get module access summary
  app.get("/api/users/modules/summary", requireAuth, async (req: Request, res: Response) => {
    try {
      const summary = await userController.getModuleAccessSummary(req.user!.id);
      res.json(summary);
    } catch (error) {
      console.error("Get module access summary error:", error);
      res.status(500).json({ error: "Failed to get module access summary" });
    }
  });

  // ============= SESSION MANAGEMENT =============
  
  // Get user sessions
  app.get("/api/users/sessions", requireAuth, async (req: Request, res: Response) => {
    try {
      const sessions = await userController.getUserSessions(req.user!.id);
      res.json(sessions);
    } catch (error) {
      console.error("Get user sessions error:", error);
      res.status(500).json({ error: "Failed to get user sessions" });
    }
  });

  // ============= DATA EXPORT & PRIVACY =============
  
  // Export user data (GDPR compliance)
  app.get("/api/users/export", requireAuth, async (req: Request, res: Response) => {
    try {
      const exportData = await userController.exportUserData(req.user!.id);
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="user-data-${req.user!.username}-${new Date().toISOString().split('T')[0]}.json"`);
      
      res.json(exportData);
    } catch (error) {
      console.error("Export user data error:", error);
      const message = error instanceof Error ? error.message : "Failed to export user data";
      const statusCode = message === "User not found" ? 404 : 500;
      res.status(statusCode).json({ error: message });
    }
  });

  // Request account deletion (GDPR compliance)
  app.post("/api/users/delete-account", requireAuth, async (req: Request, res: Response) => {
    try {
      const { reason } = req.body;
      const result = await userController.requestAccountDeletion(req.user!.id, reason);
      res.json(result);
    } catch (error) {
      console.error("Request account deletion error:", error);
      res.status(500).json({ error: "Failed to request account deletion" });
    }
  });
}