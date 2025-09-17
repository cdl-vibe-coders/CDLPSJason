import type { Express, Request, Response } from "express";
import { adminController } from "./controller";
import { 
  moduleToggleSchema, 
  rolePermissionUpdateSchema, 
  userOverrideUpdateSchema,
  dashboardFiltersSchema
} from "./types";
import { insertAdminModuleSchema, insertModuleRolePermissionSchema, insertUserModuleOverrideSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { requireAuth, requireAdmin } from "../../middleware/auth";

export function registerAdminRoutes(app: Express) {
  // ============= DASHBOARD =============
  
  // Get dashboard statistics
  app.get("/api/admin/dashboard/stats", requireAdmin, async (req: Request, res: Response) => {
    try {
      const filters = dashboardFiltersSchema.parse(req.query);
      const stats = await adminController.getDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error("Dashboard stats error:", error);
      res.status(500).json({ error: "Failed to fetch dashboard statistics" });
    }
  });
  
  // Get system health
  app.get("/api/admin/system/health", requireAdmin, async (req: Request, res: Response) => {
    try {
      const health = await adminController.getSystemHealth();
      res.json(health);
    } catch (error) {
      console.error("System health error:", error);
      res.status(500).json({ error: "Failed to check system health" });
    }
  });

  // ============= MODULE MANAGEMENT =============
  
  // Get all modules with statistics
  app.get("/api/admin/modules", requireAdmin, async (req: Request, res: Response) => {
    try {
      const modules = await adminController.getAllModulesWithStats();
      res.json(modules);
    } catch (error) {
      console.error("Error fetching modules:", error);
      res.status(500).json({ error: "Failed to fetch modules" });
    }
  });

  // Get single module by ID with stats
  app.get("/api/admin/modules/:moduleId", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { moduleId } = req.params;
      const module = await adminController.getModuleById(moduleId);
      res.json(module);
    } catch (error) {
      console.error("Error fetching module:", error);
      const message = error instanceof Error ? error.message : "Failed to fetch module";
      const statusCode = message === "Module not found" ? 404 : 500;
      res.status(statusCode).json({ error: message });
    }
  });

  // Create new module
  app.post("/api/admin/modules", requireAdmin, async (req: Request, res: Response) => {
    try {
      const validation = insertAdminModuleSchema.safeParse(req.body);
      
      if (!validation.success) {
        const validationError = fromZodError(validation.error);
        return res.status(400).json({ error: validationError.message });
      }
      
      const module = await adminController.createModule(validation.data, req.user!.id);
      res.status(201).json(module);
    } catch (error) {
      console.error("Error creating module:", error);
      const message = error instanceof Error ? error.message : "Failed to create module";
      const statusCode = message.includes("already exists") ? 409 : 500;
      res.status(statusCode).json({ error: message });
    }
  });

  // Update module
  app.put("/api/admin/modules/:moduleId", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { moduleId } = req.params;
      const updateSchema = insertAdminModuleSchema.partial();
      const validation = updateSchema.safeParse(req.body);
      
      if (!validation.success) {
        const validationError = fromZodError(validation.error);
        return res.status(400).json({ error: validationError.message });
      }
      
      const module = await adminController.updateModule(moduleId, validation.data, req.user!.id);
      res.json(module);
    } catch (error) {
      console.error("Error updating module:", error);
      const message = error instanceof Error ? error.message : "Failed to update module";
      const statusCode = message === "Module not found" ? 404 : 500;
      res.status(statusCode).json({ error: message });
    }
  });

  // Toggle module status
  app.put("/api/admin/modules/:moduleId/toggle", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { moduleId } = req.params;
      const validation = moduleToggleSchema.safeParse(req.body);
      
      if (!validation.success) {
        const validationError = fromZodError(validation.error);
        return res.status(400).json({ error: validationError.message });
      }
      
      const module = await adminController.toggleModuleStatus(moduleId, validation.data.isActive, req.user!.id);
      res.json(module);
    } catch (error) {
      console.error("Error toggling module status:", error);
      const message = error instanceof Error ? error.message : "Failed to toggle module status";
      const statusCode = message === "Module not found" ? 404 : 500;
      res.status(statusCode).json({ error: message });
    }
  });

  // ============= ROLE PERMISSIONS =============
  
  // Get role permissions for a module
  app.get("/api/admin/modules/:moduleId/permissions", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { moduleId } = req.params;
      const permissions = await adminController.getModulePermissions(moduleId);
      res.json(permissions);
    } catch (error) {
      console.error("Error fetching module permissions:", error);
      res.status(500).json({ error: "Failed to fetch module permissions" });
    }
  });

  // Get all permissions for a role
  app.get("/api/admin/roles/:role/permissions", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { role } = req.params;
      const permissions = await adminController.getRolePermissions(role);
      res.json(permissions);
    } catch (error) {
      console.error("Error fetching role permissions:", error);
      res.status(500).json({ error: "Failed to fetch role permissions" });
    }
  });

  // Set role permission for a module
  app.post("/api/admin/modules/:moduleId/permissions", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { moduleId } = req.params;
      const validation = insertModuleRolePermissionSchema.safeParse({
        ...req.body,
        moduleId
      });
      
      if (!validation.success) {
        const validationError = fromZodError(validation.error);
        return res.status(400).json({ error: validationError.message });
      }
      
      const permission = await adminController.createRolePermission(validation.data, req.user!.id);
      res.status(201).json(permission);
    } catch (error) {
      console.error("Error creating role permission:", error);
      const message = error instanceof Error ? error.message : "Failed to create role permission";
      const statusCode = message.includes("already exists") ? 409 : 500;
      res.status(statusCode).json({ error: message });
    }
  });

  // Update role permission for a module
  app.put("/api/admin/modules/:moduleId/permissions/:role", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { moduleId, role } = req.params;
      const validation = rolePermissionUpdateSchema.safeParse(req.body);
      
      if (!validation.success) {
        const validationError = fromZodError(validation.error);
        return res.status(400).json({ error: validationError.message });
      }
      
      const permission = await adminController.updateRolePermission(
        moduleId, 
        role, 
        validation.data.canAccess, 
        req.user!.id
      );
      res.json(permission);
    } catch (error) {
      console.error("Error updating role permission:", error);
      const message = error instanceof Error ? error.message : "Failed to update role permission";
      const statusCode = message === "Role permission not found" ? 404 : 500;
      res.status(statusCode).json({ error: message });
    }
  });

  // Delete role permission
  app.delete("/api/admin/modules/:moduleId/permissions/:role", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { moduleId, role } = req.params;
      const success = await adminController.deleteRolePermission(moduleId, role, req.user!.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting role permission:", error);
      const message = error instanceof Error ? error.message : "Failed to delete role permission";
      const statusCode = message === "Role permission not found" ? 404 : 500;
      res.status(statusCode).json({ error: message });
    }
  });

  // ============= USER MODULE OVERRIDES =============
  
  // Get user's module overrides
  app.get("/api/admin/users/:userId/module-overrides", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const overrides = await adminController.getUserModuleOverrides(userId);
      res.json(overrides);
    } catch (error) {
      console.error("Error fetching user module overrides:", error);
      res.status(500).json({ error: "Failed to fetch user module overrides" });
    }
  });

  // Get module overrides for all users
  app.get("/api/admin/modules/:moduleId/user-overrides", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { moduleId } = req.params;
      const overrides = await adminController.getModuleUserOverrides(moduleId);
      res.json(overrides);
    } catch (error) {
      console.error("Error fetching module user overrides:", error);
      res.status(500).json({ error: "Failed to fetch module user overrides" });
    }
  });

  // Create user module override
  app.post("/api/admin/users/:userId/module-overrides", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const validation = insertUserModuleOverrideSchema.safeParse({
        ...req.body,
        userId
      });
      
      if (!validation.success) {
        const validationError = fromZodError(validation.error);
        return res.status(400).json({ error: validationError.message });
      }
      
      const override = await adminController.createUserModuleOverride(validation.data, req.user!.id);
      res.status(201).json(override);
    } catch (error) {
      console.error("Error creating user module override:", error);
      const message = error instanceof Error ? error.message : "Failed to create user module override";
      const statusCode = message.includes("already exists") ? 409 : 500;
      res.status(statusCode).json({ error: message });
    }
  });

  // Update user module override
  app.put("/api/admin/users/:userId/module-overrides/:moduleId", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId, moduleId } = req.params;
      const validation = userOverrideUpdateSchema.safeParse(req.body);
      
      if (!validation.success) {
        const validationError = fromZodError(validation.error);
        return res.status(400).json({ error: validationError.message });
      }
      
      const override = await adminController.updateUserModuleOverride(
        userId, 
        moduleId, 
        validation.data.enabled, 
        req.user!.id
      );
      res.json(override);
    } catch (error) {
      console.error("Error updating user module override:", error);
      const message = error instanceof Error ? error.message : "Failed to update user module override";
      const statusCode = message === "User module override not found" ? 404 : 500;
      res.status(statusCode).json({ error: message });
    }
  });

  // Delete user module override
  app.delete("/api/admin/users/:userId/module-overrides/:moduleId", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId, moduleId } = req.params;
      const success = await adminController.deleteUserModuleOverride(userId, moduleId, req.user!.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting user module override:", error);
      const message = error instanceof Error ? error.message : "Failed to delete user module override";
      const statusCode = message === "User module override not found" ? 404 : 500;
      res.status(statusCode).json({ error: message });
    }
  });

  // ============= ACCESS CONTROL UTILITIES =============
  
  // Check user access to a module
  app.get("/api/admin/users/:userId/modules/:moduleId/access", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId, moduleId } = req.params;
      const access = await adminController.checkUserModuleAccess(userId, moduleId);
      res.json(access);
    } catch (error) {
      console.error("Error checking module access:", error);
      res.status(500).json({ error: "Failed to check module access" });
    }
  });

  // Get user's accessible modules
  app.get("/api/admin/users/:userId/accessible-modules", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const modules = await adminController.getUserAccessibleModules(userId);
      res.json(modules);
    } catch (error) {
      console.error("Error fetching accessible modules:", error);
      res.status(500).json({ error: "Failed to fetch accessible modules" });
    }
  });

  // ============= LOGGING =============
  
  // Get module logs
  app.get("/api/admin/modules/:moduleId/logs", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { moduleId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const logs = await adminController.getModuleLogs(moduleId, limit);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching module logs:", error);
      res.status(500).json({ error: "Failed to fetch module logs" });
    }
  });

  // Get user logs
  app.get("/api/admin/users/:userId/logs", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const logs = await adminController.getUserLogs(userId, limit);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching user logs:", error);
      res.status(500).json({ error: "Failed to fetch user logs" });
    }
  });
}