import { Router } from "express";
import type { ModuleBootstrapResult, ModuleManifest, ModuleLifecycle } from "../../types/module";
import { AdminModuleStorage } from "./storage";
import { createAdminController } from "./controller";

// ============= ADMIN MODULE MANIFEST =============

export const adminManifest: ModuleManifest = {
  id: "admin",
  name: "admin",
  displayName: "Admin Dashboard",
  description: "Administrative functionality for system management and module oversight",
  version: "1.0.0",
  apiPrefix: "/api/admin",
  dbNamespace: "admin_",
  dependencies: [], // Admin module has no dependencies
  requiredRole: "admin",
  isCore: true,
  capabilities: [
    {
      id: "module_management",
      name: "Module Management",
      description: "Create, update, and manage system modules",
      endpoints: ["/modules", "/modules/:id", "/modules/:id/toggle"]
    },
    {
      id: "role_permissions",
      name: "Role Permissions",
      description: "Manage role-based permissions for modules",
      endpoints: ["/permissions", "/permissions/roles/:role"]
    },
    {
      id: "user_overrides", 
      name: "User Overrides",
      description: "Manage user-specific module access overrides",
      endpoints: ["/overrides", "/overrides/users/:userId"]
    },
    {
      id: "system_monitoring",
      name: "System Monitoring", 
      description: "Monitor system health and performance",
      endpoints: ["/dashboard", "/health", "/logs"]
    }
  ]
};

// ============= ADMIN MODULE BOOTSTRAP =============

export async function bootstrapAdminModule(): Promise<ModuleBootstrapResult> {
  console.log("🔧 Bootstrapping Admin Module...");

  // Create isolated storage (initialization handled in lifecycle)
  const storage = new AdminModuleStorage();

  // Create controller with injected storage
  const controller = createAdminController(storage);

  // Create router with all admin endpoints
  const router = Router();

  // ============= DASHBOARD ROUTES =============
  
  router.get("/dashboard", async (req, res) => {
    try {
      const stats = await controller.getDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error("Dashboard stats error:", error);
      res.status(500).json({ error: "Failed to fetch dashboard statistics" });
    }
  });

  router.get("/health", async (req, res) => {
    try {
      const health = await controller.getSystemHealth();
      res.json(health);
    } catch (error) {
      console.error("System health error:", error);
      res.status(500).json({ error: "Failed to check system health" });
    }
  });

  // ============= MODULE MANAGEMENT ROUTES =============

  router.get("/modules", async (req, res) => {
    try {
      const modules = await controller.getAllModulesWithStats();
      res.json(modules);
    } catch (error) {
      console.error("Get modules error:", error);
      res.status(500).json({ error: "Failed to fetch modules" });
    }
  });

  router.get("/modules/:id", async (req, res) => {
    try {
      const module = await controller.getModuleById(req.params.id);
      res.json(module);
    } catch (error) {
      console.error("Get module error:", error);
      res.status(404).json({ error: "Module not found" });
    }
  });

  router.post("/modules", async (req, res) => {
    try {
      const adminUserId = req.user?.id || "system"; // TODO: Extract from auth middleware
      const module = await controller.createModule(req.body, adminUserId);
      res.status(201).json(module);
    } catch (error) {
      console.error("Create module error:", error);
      const status = error instanceof Error && error.message.includes("already exists") ? 409 : 500;
      res.status(status).json({ error: error instanceof Error ? error.message : "Failed to create module" });
    }
  });

  router.put("/modules/:id", async (req, res) => {
    try {
      const adminUserId = req.user?.id || "system";
      const module = await controller.updateModule(req.params.id, req.body, adminUserId);
      res.json(module);
    } catch (error) {
      console.error("Update module error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update module" });
    }
  });

  router.post("/modules/:id/toggle", async (req, res) => {
    try {
      const adminUserId = req.user?.id || "system";
      const { isActive } = req.body;
      const module = await controller.toggleModuleStatus(req.params.id, isActive, adminUserId);
      res.json(module);
    } catch (error) {
      console.error("Toggle module error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to toggle module status" });
    }
  });

  // ============= PERMISSION MANAGEMENT ROUTES =============

  router.get("/permissions/modules/:moduleId", async (req, res) => {
    try {
      const permissions = await controller.getModulePermissions(req.params.moduleId);
      res.json(permissions);
    } catch (error) {
      console.error("Get module permissions error:", error);
      res.status(500).json({ error: "Failed to fetch module permissions" });
    }
  });

  router.get("/permissions/roles/:role", async (req, res) => {
    try {
      const permissions = await controller.getRolePermissions(req.params.role);
      res.json(permissions);
    } catch (error) {
      console.error("Get role permissions error:", error);
      res.status(500).json({ error: "Failed to fetch role permissions" });
    }
  });

  router.post("/permissions", async (req, res) => {
    try {
      const adminUserId = req.user?.id || "system";
      const permission = await controller.createRolePermission(req.body, adminUserId);
      res.status(201).json(permission);
    } catch (error) {
      console.error("Create permission error:", error);
      const status = error instanceof Error && error.message.includes("already exists") ? 409 : 500;
      res.status(status).json({ error: error instanceof Error ? error.message : "Failed to create permission" });
    }
  });

  // ============= USER OVERRIDE ROUTES =============

  router.get("/overrides/users/:userId", async (req, res) => {
    try {
      const overrides = await controller.getUserModuleOverrides(req.params.userId);
      res.json(overrides);
    } catch (error) {
      console.error("Get user overrides error:", error);
      res.status(500).json({ error: "Failed to fetch user overrides" });
    }
  });

  router.get("/overrides/modules/:moduleId", async (req, res) => {
    try {
      const overrides = await controller.getModuleUserOverrides(req.params.moduleId);
      res.json(overrides);
    } catch (error) {
      console.error("Get module overrides error:", error);
      res.status(500).json({ error: "Failed to fetch module overrides" });
    }
  });

  // ============= LOGGING ROUTES =============

  router.get("/logs/modules/:moduleId", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const logs = await controller.getModuleLogs(req.params.moduleId, limit);
      res.json(logs);
    } catch (error) {
      console.error("Get module logs error:", error);
      res.status(500).json({ error: "Failed to fetch module logs" });
    }
  });

  router.get("/logs/users/:userId", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const logs = await controller.getUserLogs(req.params.userId, limit);
      res.json(logs);
    } catch (error) {
      console.error("Get user logs error:", error);
      res.status(500).json({ error: "Failed to fetch user logs" });
    }
  });

  // ============= MODULE LIFECYCLE =============

  const lifecycle: ModuleLifecycle = {
    onInit: async () => {
      console.log("🎯 Admin module initializing...");
      await storage.initialize();
      console.log("✅ Admin module database initialized");
    },

    onStart: async () => {
      console.log("🟢 Admin module started");
    },

    onStop: async () => {
      console.log("🟡 Admin module stopping...");
    },

    onHealthCheck: async () => {
      const isHealthy = await storage.healthCheck();
      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        message: isHealthy ? 'Admin module operating normally' : 'Admin module database issues',
        details: {
          storage: isHealthy ? 'connected' : 'disconnected',
          timestamp: new Date().toISOString()
        }
      };
    },

    onDestroy: async () => {
      console.log("🔴 Admin module destroying...");
      await storage.cleanup();
    }
  };

  console.log("✅ Admin Module bootstrapped successfully");

  return {
    router,
    lifecycle,
    manifest: adminManifest,
    storage
  };
}