import type { Express } from "express";
import type { 
  ModuleManifest, 
  RegisteredModule, 
  ModuleBootstrapResult, 
  ModuleBootstrapFunction,
  ModuleDeploymentConfig,
  DeploymentMode
} from "../types/module";
import { communicationHub } from "../communication/ModuleServiceRegistry";
import { InterModuleAPIFactory } from "../communication/InterModuleAPI";

// ============= DYNAMIC MODULE REGISTRY =============

export class DynamicModuleRegistry {
  private modules = new Map<string, RegisteredModule>();
  private app?: Express;
  private communicationHub = communicationHub;
  private apiFactory: InterModuleAPIFactory;
  private deploymentMode: DeploymentMode = 'monolith';

  constructor(deploymentMode: DeploymentMode = 'monolith') {
    this.deploymentMode = deploymentMode;
    const { serviceRegistry, eventBus } = this.communicationHub.getCommunicationContext();
    this.apiFactory = new InterModuleAPIFactory(serviceRegistry, eventBus);
    
    console.log(`🏗️ Dynamic Module Registry initialized in ${deploymentMode} mode`);
  }

  // ============= MODULE DISCOVERY =============

  /**
   * Discover modules by scanning for bootstrap functions
   */
  async discoverModules(): Promise<void> {
    console.log("🔍 Discovering modules...");

    // Built-in modules discovery
    const builtInModules = [
      {
        id: 'admin',
        bootstrapPath: '../modules/admin/bootstrap'
      },
      {
        id: 'users', 
        bootstrapPath: '../modules/users/bootstrap'
      },
      {
        id: 'codereview',
        bootstrapPath: '../modules/codereview/bootstrap'
      }
    ];

    for (const moduleInfo of builtInModules) {
      try {
        // Dynamic import of the bootstrap module
        const bootstrapModule = await import(moduleInfo.bootstrapPath);
        const manifest: ModuleManifest = bootstrapModule[`${moduleInfo.id}Manifest`];
        const bootstrapFn: ModuleBootstrapFunction = bootstrapModule[`bootstrap${moduleInfo.id.charAt(0).toUpperCase() + moduleInfo.id.slice(1)}Module`];
        
        if (!manifest || !bootstrapFn) {
          console.warn(`⚠️ Module ${moduleInfo.id} missing manifest or bootstrap function`);
          continue;
        }

        // Register the discovered module
        const registeredModule: RegisteredModule = {
          ...manifest,
          isEnabled: true,
          isLoaded: false,
          isHealthy: false,
          deploymentConfig: this.getModuleDeploymentConfig(manifest),
          lastHealthCheck: undefined
        };

        this.modules.set(manifest.id, registeredModule);
        console.log(`✅ Discovered module: ${manifest.displayName} (${manifest.version})`);

      } catch (error) {
        console.error(`❌ Failed to discover module ${moduleInfo.id}:`, error);
      }
    }

    // TODO: Add support for external module discovery
    // This could scan node_modules for packages with specific patterns
    // or read from a modules.json configuration file
    
    console.log(`📦 Discovery complete: ${this.modules.size} modules found`);
  }

  // ============= MODULE LOADING =============

  /**
   * Load a specific module
   */
  async loadModule(moduleId: string): Promise<boolean> {
    const module = this.modules.get(moduleId);
    if (!module) {
      console.error(`Module ${moduleId} not found in registry`);
      return false;
    }

    if (module.isLoaded) {
      console.log(`Module ${moduleId} already loaded`);
      return true;
    }

    try {
      console.log(`🔄 Loading module: ${module.displayName}...`);

      // Check dependencies first
      const depsSatisfied = await this.checkDependencies(module);
      if (!depsSatisfied) {
        throw new Error("Dependencies not satisfied");
      }

      // Load the module's bootstrap function
      const bootstrapModule = await import(`../modules/${moduleId}/bootstrap`);
      const bootstrapFn: ModuleBootstrapFunction = bootstrapModule[`bootstrap${moduleId.charAt(0).toUpperCase() + moduleId.slice(1)}Module`];
      
      if (!bootstrapFn) {
        throw new Error(`Bootstrap function not found for module ${moduleId}`);
      }

      // Execute bootstrap
      const result: ModuleBootstrapResult = await bootstrapFn();
      
      // Update module record
      module.router = result.router;
      module.lifecycle = result.lifecycle;
      module.storage = result.storage;
      module.isLoaded = true;
      module.loadError = undefined;

      // Register module in communication hub
      this.communicationHub.getServiceRegistry().registerService(moduleId, {
        storage: result.storage,
        lifecycle: result.lifecycle,
        manifest: result.manifest
      });

      // Set up module routes if we have an app instance
      if (this.app && module.router) {
        this.app.use(module.apiPrefix, module.router);
        console.log(`🛣️ Routes registered: ${module.apiPrefix}/*`);
      }

      // Run lifecycle initialization
      if (module.lifecycle?.onInit) {
        await module.lifecycle.onInit();
      }

      console.log(`✅ Module loaded successfully: ${module.displayName}`);
      return true;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      module.loadError = errorMessage;
      module.isLoaded = false;
      
      console.error(`❌ Failed to load module ${moduleId}:`, errorMessage);
      return false;
    }
  }

  /**
   * Load all enabled modules
   */
  async loadAllModules(app: Express): Promise<void> {
    this.app = app;
    console.log("🚀 Loading all enabled modules...");

    const enabledModules = Array.from(this.modules.values())
      .filter(module => module.isEnabled)
      .sort((a, b) => a.dependencies.length - b.dependencies.length); // Load dependencies first

    const results = await Promise.allSettled(
      enabledModules.map(module => this.loadModule(module.id))
    );

    const successful = results.filter(result => result.status === 'fulfilled' && result.value === true).length;
    const failed = results.length - successful;

    console.log(`📊 Module loading complete: ${successful} successful, ${failed} failed`);

    // Start all loaded modules
    await this.startAllModules();
  }

  // ============= MODULE LIFECYCLE MANAGEMENT =============

  /**
   * Start all loaded modules
   */
  async startAllModules(): Promise<void> {
    console.log("▶️ Starting all loaded modules...");

    for (const [moduleId, module] of this.modules) {
      if (module.isLoaded && module.lifecycle?.onStart) {
        try {
          await module.lifecycle.onStart();
          console.log(`▶️ Started: ${module.displayName}`);
        } catch (error) {
          console.error(`❌ Failed to start module ${moduleId}:`, error);
        }
      }
    }

    console.log("✅ All modules started");
  }

  /**
   * Stop all modules gracefully
   */
  async stopAllModules(): Promise<void> {
    console.log("⏹️ Stopping all modules...");

    for (const [moduleId, module] of this.modules) {
      if (module.isLoaded && module.lifecycle?.onStop) {
        try {
          await module.lifecycle.onStop();
          console.log(`⏹️ Stopped: ${module.displayName}`);
        } catch (error) {
          console.error(`❌ Failed to stop module ${moduleId}:`, error);
        }
      }
    }

    // Shutdown communication hub
    await this.communicationHub.shutdown();
    console.log("✅ All modules stopped");
  }

  // ============= MODULE HEALTH MANAGEMENT =============

  /**
   * Perform health check on all modules
   */
  async performHealthCheck(): Promise<{healthy: number, unhealthy: number, total: number}> {
    console.log("🏥 Performing health checks...");

    let healthy = 0;
    let unhealthy = 0;

    for (const [moduleId, module] of this.modules) {
      if (!module.isLoaded) {
        unhealthy++;
        continue;
      }

      try {
        if (module.lifecycle?.onHealthCheck) {
          const healthStatus = await module.lifecycle.onHealthCheck();
          module.isHealthy = healthStatus.status === 'healthy';
          module.lastHealthCheck = new Date();
          
          if (module.isHealthy) {
            healthy++;
          } else {
            unhealthy++;
            console.warn(`⚠️ Module ${moduleId} unhealthy: ${healthStatus.message}`);
          }
        } else {
          // If no health check, assume healthy if loaded
          module.isHealthy = true;
          module.lastHealthCheck = new Date();
          healthy++;
        }
      } catch (error) {
        module.isHealthy = false;
        module.lastHealthCheck = new Date();
        unhealthy++;
        console.error(`❌ Health check failed for ${moduleId}:`, error);
      }
    }

    const total = this.modules.size;
    console.log(`🏥 Health check complete: ${healthy}/${total} healthy`);

    return { healthy, unhealthy, total };
  }

  // ============= DEPENDENCY MANAGEMENT =============

  private async checkDependencies(module: RegisteredModule): Promise<boolean> {
    for (const depId of module.dependencies) {
      const dependency = this.modules.get(depId);
      
      if (!dependency) {
        console.error(`Dependency ${depId} not found for module ${module.id}`);
        return false;
      }

      if (!dependency.isEnabled) {
        console.error(`Dependency ${depId} is disabled for module ${module.id}`);
        return false;
      }

      if (!dependency.isLoaded) {
        console.log(`Loading dependency ${depId} for module ${module.id}...`);
        const loaded = await this.loadModule(depId);
        if (!loaded) {
          console.error(`Failed to load dependency ${depId} for module ${module.id}`);
          return false;
        }
      }
    }

    return true;
  }

  // ============= DEPLOYMENT CONFIGURATION =============

  private getModuleDeploymentConfig(manifest: ModuleManifest): ModuleDeploymentConfig {
    const config: ModuleDeploymentConfig = {
      mode: this.deploymentMode
    };

    if (this.deploymentMode === 'distributed') {
      // In distributed mode, each module would run on its own port
      const portMap: Record<string, number> = {
        'admin': 3001,
        'users': 3002,
        // Add more modules as needed
      };

      config.port = portMap[manifest.id] || 3000;
      config.host = '0.0.0.0';
      config.serviceUrl = `http://localhost:${config.port}`;
    }

    return config;
  }

  // ============= REGISTRY QUERIES =============

  getModule(moduleId: string): RegisteredModule | undefined {
    return this.modules.get(moduleId);
  }

  getAllModules(): RegisteredModule[] {
    return Array.from(this.modules.values());
  }

  getEnabledModules(): RegisteredModule[] {
    return Array.from(this.modules.values()).filter(m => m.isEnabled);
  }

  getLoadedModules(): RegisteredModule[] {
    return Array.from(this.modules.values()).filter(m => m.isLoaded);
  }

  getModuleStatus(): Record<string, {enabled: boolean, loaded: boolean, healthy: boolean}> {
    const status: Record<string, {enabled: boolean, loaded: boolean, healthy: boolean}> = {};
    
    for (const [id, module] of this.modules) {
      status[id] = {
        enabled: module.isEnabled,
        loaded: module.isLoaded,
        healthy: module.isHealthy
      };
    }

    return status;
  }

  // ============= MODULE CONTROL =============

  async enableModule(moduleId: string): Promise<boolean> {
    const module = this.modules.get(moduleId);
    if (!module) return false;

    module.isEnabled = true;
    
    // If we have an app instance, try to load the module
    if (this.app && !module.isLoaded) {
      return await this.loadModule(moduleId);
    }

    return true;
  }

  async disableModule(moduleId: string): Promise<boolean> {
    const module = this.modules.get(moduleId);
    if (!module) return false;

    if (module.isCore) {
      console.warn(`Cannot disable core module: ${moduleId}`);
      return false;
    }

    module.isEnabled = false;

    // Stop the module if it's running
    if (module.isLoaded && module.lifecycle?.onStop) {
      try {
        await module.lifecycle.onStop();
      } catch (error) {
        console.error(`Error stopping module ${moduleId}:`, error);
      }
    }

    module.isLoaded = false;
    module.isHealthy = false;

    return true;
  }

  getAPIFactory(): InterModuleAPIFactory {
    return this.apiFactory;
  }
}

// ============= MODULE INITIALIZATION FUNCTION =============

export async function initializeModules(app: Express, deploymentMode: DeploymentMode = 'monolith'): Promise<DynamicModuleRegistry> {
  const registry = new DynamicModuleRegistry(deploymentMode);
  
  // Discover available modules
  await registry.discoverModules();
  
  // Load all modules
  await registry.loadAllModules(app);
  
  return registry;
}