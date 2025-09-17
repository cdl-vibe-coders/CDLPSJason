import type { Express, Router } from "express";

// ============= MODULE MANIFEST INTERFACE =============

export interface ModuleManifest {
  id: string;
  name: string;
  displayName: string;
  description: string;
  version: string;
  apiPrefix: string; // e.g., '/api/admin', '/api/users'
  dbNamespace: string; // Table prefix e.g., 'admin_', 'users_'
  dependencies: string[]; // Module IDs this module depends on
  requiredRole?: string; // Minimum role required to access module endpoints
  isCore: boolean; // Core modules cannot be disabled
  capabilities: ModuleCapability[]; // What capabilities this module provides
}

export interface ModuleCapability {
  id: string;
  name: string;
  description: string;
  endpoints: string[]; // API endpoints this capability provides
}

// ============= MODULE LIFECYCLE INTERFACE =============

export interface ModuleLifecycle {
  onInit?: () => Promise<void>; // Called when module is first loaded
  onStart?: () => Promise<void>; // Called when module starts serving requests
  onStop?: () => Promise<void>; // Called when module stops serving requests
  onHealthCheck?: () => Promise<ModuleHealthStatus>; // Called for health checks
  onDestroy?: () => Promise<void>; // Called when module is being unloaded
}

export interface ModuleHealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  details?: Record<string, any>;
}

// ============= MODULE BOOTSTRAP INTERFACE =============

export interface ModuleBootstrapResult {
  router: Router; // Express router with module routes
  lifecycle: ModuleLifecycle; // Lifecycle hooks
  manifest: ModuleManifest; // Module manifest
  storage?: ModuleStorage; // Module's isolated storage instance
}

export type ModuleBootstrapFunction = () => Promise<ModuleBootstrapResult>;

// ============= MODULE STORAGE BASE =============

export interface ModuleStorage {
  readonly namespace: string; // Table prefix for this module
  readonly moduleId: string;
  
  // Core storage operations that all modules need
  initialize(): Promise<void>; // Set up module-specific tables
  healthCheck(): Promise<boolean>; // Check storage health
  cleanup(): Promise<void>; // Clean up resources
}

// ============= DEPLOYMENT MODES =============

export type DeploymentMode = 'monolith' | 'distributed';

export interface ModuleDeploymentConfig {
  mode: DeploymentMode;
  port?: number; // For distributed mode
  host?: string; // For distributed mode
  serviceUrl?: string; // URL when running as distributed service
}

// ============= MODULE REGISTRY TYPES =============

export interface RegisteredModule extends ModuleManifest {
  isEnabled: boolean;
  isLoaded: boolean;
  isHealthy: boolean;
  deploymentConfig: ModuleDeploymentConfig;
  router?: Router;
  lifecycle?: ModuleLifecycle;
  storage?: ModuleStorage;
  loadError?: string;
  lastHealthCheck?: Date;
}

// ============= INTER-MODULE COMMUNICATION =============

export interface ModuleContract {
  moduleId: string;
  version: string;
  exports: ModuleExport[]; // What this module exposes to others
  imports: ModuleImport[]; // What this module requires from others
}

export interface ModuleExport {
  name: string;
  type: 'endpoint' | 'event' | 'service';
  description: string;
  schema?: any; // JSON schema for the export
}

export interface ModuleImport {
  moduleId: string;
  name: string;
  required: boolean;
}