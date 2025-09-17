import type { Express, Request } from "express";
import { storage } from "../storage";
import { insertAdminModuleSchema, insertModuleRolePermissionSchema, insertUserModuleOverrideSchema } from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { requireAuth, requireAdmin } from "../middleware/auth";

export function registerSettingsRoutes(app: Express) {
  // ============= MODULE MANAGEMENT =============
  
  // Get all modules with status
  app.get("/api/settings/modules", requireAuth, async (req: Request, res) => {
    try {
      const modules = await storage.getAllModules();
      res.json(modules);
    } catch (error) {
      console.error("Error fetching modules:", error);
      res.status(500).json({ error: "Failed to fetch modules" });
    }
  });

  // Get single module by ID
  app.get("/api/settings/modules/:moduleId", requireAuth, async (req: Request, res) => {
    try {
      const { moduleId } = req.params;
      const module = await storage.getModule(moduleId);
      
      if (!module) {
        return res.status(404).json({ error: "Module not found" });
      }
      
      res.json(module);
    } catch (error) {
      console.error("Error fetching module:", error);
      res.status(500).json({ error: "Failed to fetch module" });
    }
  });

  // Create new module (admin only)
  app.post("/api/settings/modules", requireAdmin, async (req: Request, res) => {
    try {
      const validation = insertAdminModuleSchema.safeParse(req.body);
      
      if (!validation.success) {
        const validationError = fromZodError(validation.error);
        return res.status(400).json({ error: validationError.message });
      }
      
      const module = await storage.createModule(validation.data);
      
      // Log the creation
      await storage.createLog({
        moduleId: module.id,
        userId: req.user!.id,
        action: "module_created",
        details: { name: module.name, version: module.version }
      });
      
      res.status(201).json(module);
    } catch (error) {
      console.error("Error creating module:", error);
      if (error instanceof Error && error.message.includes('unique constraint')) {
        return res.status(409).json({ error: "Module name already exists" });
      }
      res.status(500).json({ error: "Failed to create module" });
    }
  });

  // Update module (admin only)
  app.put("/api/settings/modules/:moduleId", requireAdmin, async (req: Request, res) => {
    try {
      const { moduleId } = req.params;
      const updateSchema = insertAdminModuleSchema.partial();
      const validation = updateSchema.safeParse(req.body);
      
      if (!validation.success) {
        const validationError = fromZodError(validation.error);
        return res.status(400).json({ error: validationError.message });
      }
      
      const module = await storage.updateModule(moduleId, validation.data);
      
      if (!module) {
        return res.status(404).json({ error: "Module not found" });
      }
      
      // Log the update
      await storage.createLog({
        moduleId: module.id,
        userId: req.user!.id,
        action: "module_updated",
        details: validation.data
      });
      
      res.json(module);
    } catch (error) {
      console.error("Error updating module:", error);
      res.status(500).json({ error: "Failed to update module" });
    }
  });

  // Toggle module status (admin only)
  app.put("/api/settings/modules/:moduleId/toggle", requireAdmin, async (req: Request, res) => {
    try {
      const { moduleId } = req.params;
      const { isActive } = req.body;
      
      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ error: "isActive must be a boolean" });
      }
      
      const module = await storage.toggleModuleStatus(moduleId, isActive);
      
      if (!module) {
        return res.status(404).json({ error: "Module not found" });
      }
      
      // Log the toggle
      await storage.createLog({
        moduleId: module.id,
        userId: req.user!.id,
        action: isActive ? "module_enabled" : "module_disabled",
        details: { previousStatus: !isActive, newStatus: isActive }
      });
      
      res.json(module);
    } catch (error) {
      console.error("Error toggling module status:", error);
      res.status(500).json({ error: "Failed to toggle module status" });
    }
  });

  // ============= ROLE PERMISSIONS =============
  
  // Get role permissions for a module
  app.get("/api/settings/modules/:moduleId/permissions", requireAuth, async (req: Request, res) => {
    try {
      const { moduleId } = req.params;
      const permissions = await storage.getModuleRolePermissions(moduleId);
      res.json(permissions);
    } catch (error) {
      console.error("Error fetching module permissions:", error);
      res.status(500).json({ error: "Failed to fetch module permissions" });
    }
  });

  // Get all permissions for a role
  app.get("/api/settings/roles/:role/permissions", requireAuth, async (req: Request, res) => {
    try {
      const { role } = req.params;
      const permissions = await storage.getRolePermissions(role);
      res.json(permissions);
    } catch (error) {
      console.error("Error fetching role permissions:", error);
      res.status(500).json({ error: "Failed to fetch role permissions" });
    }
  });

  // Set role permission for a module (admin only)
  app.post("/api/settings/modules/:moduleId/permissions", requireAdmin, async (req: Request, res) => {
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
      
      const permission = await storage.createRolePermission(validation.data);
      
      // Log the permission change
      await storage.createLog({
        moduleId,
        userId: req.user!.id,
        action: "role_permission_created",
        details: { role: validation.data.role, canAccess: validation.data.canAccess }
      });
      
      res.status(201).json(permission);
    } catch (error) {
      console.error("Error creating role permission:", error);
      if (error instanceof Error && error.message.includes('unique constraint')) {
        return res.status(409).json({ error: "Role permission already exists for this module" });
      }
      res.status(500).json({ error: "Failed to create role permission" });
    }
  });

  // Update role permission for a module (admin only)
  app.put("/api/settings/modules/:moduleId/permissions/:role", requireAdmin, async (req: Request, res) => {
    try {
      const { moduleId, role } = req.params;
      const { canAccess } = req.body;
      
      if (typeof canAccess !== 'boolean') {
        return res.status(400).json({ error: "canAccess must be a boolean" });
      }
      
      const permission = await storage.updateRolePermission(moduleId, role, canAccess);
      
      if (!permission) {
        return res.status(404).json({ error: "Role permission not found" });
      }
      
      // Log the permission change
      await storage.createLog({
        moduleId,
        userId: req.user!.id,
        action: "role_permission_updated",
        details: { role, canAccess }
      });
      
      res.json(permission);
    } catch (error) {
      console.error("Error updating role permission:", error);
      res.status(500).json({ error: "Failed to update role permission" });
    }
  });

  // Delete role permission (admin only)
  app.delete("/api/settings/modules/:moduleId/permissions/:role", requireAdmin, async (req: Request, res) => {
    try {
      const { moduleId, role } = req.params;
      const success = await storage.deleteRolePermission(moduleId, role);
      
      if (!success) {
        return res.status(404).json({ error: "Role permission not found" });
      }
      
      // Log the deletion
      await storage.createLog({
        moduleId,
        userId: req.user!.id,
        action: "role_permission_deleted",
        details: { role }
      });
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting role permission:", error);
      res.status(500).json({ error: "Failed to delete role permission" });
    }
  });

  // ============= USER MODULE OVERRIDES =============
  
  // Get user's module overrides
  app.get("/api/settings/users/:userId/module-overrides", requireAuth, async (req: Request, res) => {
    try {
      const { userId } = req.params;
      
      // Users can only view their own overrides unless they're admin
      if (req.user!.role !== 'admin' && req.user!.id !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const overrides = await storage.getUserModuleOverrides(userId);
      res.json(overrides);
    } catch (error) {
      console.error("Error fetching user module overrides:", error);
      res.status(500).json({ error: "Failed to fetch user module overrides" });
    }
  });

  // Get module overrides for all users (admin only)
  app.get("/api/settings/modules/:moduleId/user-overrides", requireAdmin, async (req: Request, res) => {
    try {
      const { moduleId } = req.params;
      const overrides = await storage.getModuleOverrides(moduleId);
      res.json(overrides);
    } catch (error) {
      console.error("Error fetching module user overrides:", error);
      res.status(500).json({ error: "Failed to fetch module user overrides" });
    }
  });

  // Create user module override (admin only)
  app.post("/api/settings/users/:userId/module-overrides", requireAdmin, async (req: Request, res) => {
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
      
      const override = await storage.createUserModuleOverride(validation.data);
      
      // Log the override creation
      await storage.createLog({
        moduleId: validation.data.moduleId,
        userId: req.user!.id,
        action: "user_override_created",
        details: { targetUserId: userId, enabled: validation.data.enabled }
      });
      
      res.status(201).json(override);
    } catch (error) {
      console.error("Error creating user module override:", error);
      if (error instanceof Error && error.message.includes('unique constraint')) {
        return res.status(409).json({ error: "User override already exists for this module" });
      }
      res.status(500).json({ error: "Failed to create user module override" });
    }
  });

  // Update user module override (admin only)
  app.put("/api/settings/users/:userId/module-overrides/:moduleId", requireAdmin, async (req: Request, res) => {
    try {
      const { userId, moduleId } = req.params;
      const { enabled } = req.body;
      
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: "enabled must be a boolean" });
      }
      
      const override = await storage.updateUserModuleOverride(userId, moduleId, enabled);
      
      if (!override) {
        return res.status(404).json({ error: "User module override not found" });
      }
      
      // Log the override update
      await storage.createLog({
        moduleId,
        userId: req.user!.id,
        action: "user_override_updated",
        details: { targetUserId: userId, enabled }
      });
      
      res.json(override);
    } catch (error) {
      console.error("Error updating user module override:", error);
      res.status(500).json({ error: "Failed to update user module override" });
    }
  });

  // Delete user module override (admin only)
  app.delete("/api/settings/users/:userId/module-overrides/:moduleId", requireAdmin, async (req: Request, res) => {
    try {
      const { userId, moduleId } = req.params;
      const success = await storage.deleteUserModuleOverride(userId, moduleId);
      
      if (!success) {
        return res.status(404).json({ error: "User module override not found" });
      }
      
      // Log the override deletion
      await storage.createLog({
        moduleId,
        userId: req.user!.id,
        action: "user_override_deleted",
        details: { targetUserId: userId }
      });
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting user module override:", error);
      res.status(500).json({ error: "Failed to delete user module override" });
    }
  });

  // ============= ACCESS CONTROL UTILITIES =============
  
  // Check user access to a module
  app.get("/api/settings/users/:userId/modules/:moduleId/access", requireAuth, async (req: Request, res) => {
    try {
      const { userId, moduleId } = req.params;
      
      // Users can only check their own access unless they're admin
      if (req.user!.role !== 'admin' && req.user!.id !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const access = await storage.checkModuleAccess(userId, moduleId);
      res.json(access);
    } catch (error) {
      console.error("Error checking module access:", error);
      res.status(500).json({ error: "Failed to check module access" });
    }
  });

  // Get user's accessible modules
  app.get("/api/settings/users/:userId/accessible-modules", requireAuth, async (req: Request, res) => {
    try {
      const { userId } = req.params;
      
      // Users can only check their own accessible modules unless they're admin
      if (req.user!.role !== 'admin' && req.user!.id !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const modules = await storage.getUserAccessibleModules(userId);
      res.json(modules);
    } catch (error) {
      console.error("Error fetching accessible modules:", error);
      res.status(500).json({ error: "Failed to fetch accessible modules" });
    }
  });

  // ============= LOGGING =============
  
  // Get module logs (admin only)
  app.get("/api/settings/modules/:moduleId/logs", requireAdmin, async (req: Request, res) => {
    try {
      const { moduleId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const logs = await storage.getModuleLogs(moduleId, limit);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching module logs:", error);
      res.status(500).json({ error: "Failed to fetch module logs" });
    }
  });

  // Get user logs (admin only)
  app.get("/api/settings/users/:userId/logs", requireAdmin, async (req: Request, res) => {
    try {
      const { userId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const logs = await storage.getUserLogs(userId, limit);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching user logs:", error);
      res.status(500).json({ error: "Failed to fetch user logs" });
    }
  });
}