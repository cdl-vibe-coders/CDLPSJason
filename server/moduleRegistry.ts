// ============= NEW DYNAMIC MODULE REGISTRY INTEGRATION =============
// This file integrates the new dynamic module registry system

import { DynamicModuleRegistry, initializeModules as initDynamic } from "./registry/DynamicModuleRegistry";
import type { Express } from "express";
import type { DeploymentMode } from "./types/module";

// Global registry instance for backward compatibility
let registryInstance: DynamicModuleRegistry;

// ============= BACKWARD COMPATIBILITY LAYER =============

export const moduleRegistry = {
  async performHealthCheck() {
    if (!registryInstance) {
      throw new Error("Module registry not initialized");
    }
    
    const health = await registryInstance.performHealthCheck();
    return {
      healthy: health.healthy === health.total,
      modules: registryInstance.getAllModules().map(module => ({
        id: module.id,
        name: module.name,
        status: module.isHealthy ? 'healthy' : 'unhealthy',
        enabled: module.isEnabled,
        loaded: module.isLoaded
      }))
    };
  },

  getModuleStatus() {
    if (!registryInstance) {
      return {};
    }
    return registryInstance.getModuleStatus();
  },

  getEnabledModules() {
    if (!registryInstance) {
      return [];
    }
    return registryInstance.getEnabledModules();
  },

  async enableModule(moduleId: string) {
    if (!registryInstance) {
      return false;
    }
    return await registryInstance.enableModule(moduleId);
  },

  async disableModule(moduleId: string) {
    if (!registryInstance) {
      return false;
    }
    return await registryInstance.disableModule(moduleId);
  }
};

// ============= NEW INITIALIZATION FUNCTION =============

export async function initializeModules(app: Express, deploymentMode: DeploymentMode = 'monolith'): Promise<DynamicModuleRegistry> {
  console.log(`🔧 Initializing new dynamic module system in ${deploymentMode} mode...`);
  
  // Initialize the new dynamic registry
  registryInstance = await initDynamic(app, deploymentMode);
  
  console.log("✅ Dynamic module system initialized successfully");
  return registryInstance;
}

// ============= EXPORT NEW TYPES =============

export type { ModuleManifest, RegisteredModule, ModuleBootstrapResult } from "./types/module";
export { DynamicModuleRegistry };