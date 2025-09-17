import type { Express } from "express";
import { createServer, type Server } from "http";
import { initializeModules, DynamicModuleRegistry } from "./registry/DynamicModuleRegistry";
import type { DeploymentMode } from "./types/module";
import { registerNavigationRoutes } from "./routes/navigation";

export async function registerRoutes(app: Express, deploymentMode: DeploymentMode = 'monolith'): Promise<{server: Server, registry: DynamicModuleRegistry}> {
  console.log(`\n🚀 Starting Express.js Modular Backend Architecture in ${deploymentMode} mode...`);
  
  // ============= LEGACY ROUTE COMPATIBILITY =============
  // For backward compatibility, we'll maintain some core routes
  // These will be replaced as modules are fully tested

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "healthy", 
      timestamp: new Date().toISOString(),
      architecture: "modular"
    });
  });

  let registry: DynamicModuleRegistry;

  // ============= DYNAMIC MODULE LOADING =============
  console.log("📦 Initializing dynamic module registry...");
  
  try {
    // Initialize the dynamic module registry
    registry = await initializeModules(app, deploymentMode);
    
    console.log("✅ All modules loaded successfully");
    
    // Register navigation routes
    registerNavigationRoutes(app);
    console.log("🗺️ Navigation routes registered");
    
    // Log registered routes summary
    const enabledModules = registry.getEnabledModules();
    console.log("\n📋 Active Module Summary:");
    enabledModules.forEach(module => {
      console.log(`   • ${module.displayName} (${module.version}) - ${module.apiPrefix}/*`);
    });
    
  } catch (error) {
    console.error("❌ Module initialization failed:", error);
    throw new Error("Critical: Unable to initialize module system");
  }

  // ============= ERROR HANDLING MIDDLEWARE =============
  
  // Module-aware error handler
  app.use("/api", (error: any, req: any, res: any, next: any) => {
    console.error("Module route error:", {
      path: req.path,
      method: req.method,
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({ 
      error: "Internal server error",
      path: req.path,
      timestamp: new Date().toISOString()
    });
  });

  // Module registry health check endpoint
  app.get("/api/system/modules", async (req, res) => {
    try {
      const healthCheck = await registry.performHealthCheck();
      res.json({
        deploymentMode,
        ...healthCheck,
        registry: registry.getModuleStatus()
      });
    } catch (error) {
      console.error("Module health check error:", error);
      res.status(500).json({ error: "Failed to check module health" });
    }
  });

  // 404 handler for API routes
  app.use("/api/*", (req, res) => {
    const moduleStatus = registry.getModuleStatus();
    
    res.status(404).json({ 
      error: "API endpoint not found",
      path: req.path,
      deploymentMode,
      availableModules: Object.keys(moduleStatus).filter(key => moduleStatus[key].enabled),
      suggestion: "Check if the required module is enabled and loaded"
    });
  });

  // ============= DEVELOPMENT TOOLS =============
  
  if (process.env.NODE_ENV !== 'production') {
    // Development endpoint to reload modules
    app.post("/api/system/reload-modules", async (req, res) => {
      try {
        console.log("🔄 Reloading modules...");
        await registry.stopAllModules();
        registry = await initializeModules(app, deploymentMode);
        res.json({ success: true, message: "Modules reloaded successfully" });
      } catch (error) {
        console.error("Module reload error:", error);
        res.status(500).json({ error: "Failed to reload modules" });
      }
    });

    // Development endpoint to toggle module status
    app.post("/api/system/modules/:moduleId/toggle", async (req, res) => {
      try {
        const { moduleId } = req.params;
        const { enabled } = req.body;
        
        let result: boolean;
        if (enabled) {
          result = await registry.enableModule(moduleId);
        } else {
          result = await registry.disableModule(moduleId);
        }
        
        if (result) {
          res.json({ success: true, moduleId, enabled });
        } else {
          res.status(400).json({ error: "Failed to toggle module" });
        }
      } catch (error) {
        console.error("Module toggle error:", error);
        res.status(500).json({ error: "Failed to toggle module" });
      }
    });
  }

  console.log("🌐 Creating HTTP server...");
  const httpServer = createServer(app);

  console.log("🎉 Modular backend architecture initialized successfully!\n");
  
  return { server: httpServer, registry };

  // Graceful shutdown handler
  process.on('SIGTERM', async () => {
    console.log('🛑 SIGTERM received, shutting down gracefully...');
    await registry.stopAllModules();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('🛑 SIGINT received, shutting down gracefully...');
    await registry.stopAllModules();
    process.exit(0);
  });
}
