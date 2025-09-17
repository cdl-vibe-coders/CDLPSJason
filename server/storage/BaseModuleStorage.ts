import { db } from "../db";
import type { ModuleStorage } from "../types/module";
import { sql } from "drizzle-orm";

// ============= BASE MODULE STORAGE CLASS =============

export abstract class BaseModuleStorage implements ModuleStorage {
  public readonly namespace: string;
  public readonly moduleId: string;
  protected readonly db = db;

  constructor(moduleId: string, namespace: string) {
    this.moduleId = moduleId;
    this.namespace = namespace;
  }

  // ============= ABSTRACT METHODS =============
  
  /**
   * Initialize module-specific database tables and schema
   */
  abstract initialize(): Promise<void>;

  /**
   * Clean up module-specific resources
   */
  abstract cleanup(): Promise<void>;

  // ============= COMMON METHODS =============

  async healthCheck(): Promise<boolean> {
    try {
      // Basic database connectivity check
      await this.db.execute(sql`SELECT 1`);
      
      // Module-specific health checks can override this
      return await this.performModuleHealthCheck();
    } catch (error) {
      console.error(`Health check failed for module ${this.moduleId}:`, error);
      return false;
    }
  }

  /**
   * Override this method for module-specific health checks
   */
  protected async performModuleHealthCheck(): Promise<boolean> {
    return true; // Default implementation
  }

  // ============= UTILITY METHODS =============

  /**
   * Get a table name with the module's namespace prefix
   */
  protected getTableName(tableName: string): string {
    return `${this.namespace}${tableName}`;
  }

  /**
   * Execute a query with module-specific error handling
   */
  protected async executeQuery<T>(queryFn: () => Promise<T>): Promise<T> {
    try {
      return await queryFn();
    } catch (error) {
      console.error(`Query error in module ${this.moduleId}:`, error);
      throw new Error(`Database operation failed in module ${this.moduleId}`);
    }
  }

  /**
   * Check if a table exists in the database
   */
  protected async tableExists(tableName: string): Promise<boolean> {
    try {
      const fullTableName = this.getTableName(tableName);
      const result = await this.db.execute(
        sql`SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = ${fullTableName}
        )`
      );
      return (result[0] as any)?.exists === true;
    } catch {
      return false;
    }
  }

  /**
   * Create module initialization record
   */
  protected async recordModuleInitialization(): Promise<void> {
    try {
      await this.db.execute(
        sql`INSERT INTO module_registry 
            (module_id, namespace, initialized_at, version) 
            VALUES (${this.moduleId}, ${this.namespace}, NOW(), '1.0.0')
            ON CONFLICT (module_id) DO UPDATE SET 
            initialized_at = NOW()`
      );
    } catch (error) {
      console.warn(`Failed to record module initialization for ${this.moduleId}:`, error);
      // Non-critical error, don't throw
    }
  }
}

// ============= MODULE STORAGE FACTORY =============

export interface ModuleStorageFactory<T extends ModuleStorage> {
  create(moduleId: string, namespace: string): T;
}

/**
 * Registry for module storage factories
 */
export class ModuleStorageRegistry {
  private static factories = new Map<string, ModuleStorageFactory<any>>();

  static register<T extends ModuleStorage>(
    moduleId: string, 
    factory: ModuleStorageFactory<T>
  ): void {
    this.factories.set(moduleId, factory);
  }

  static create<T extends ModuleStorage>(
    moduleId: string, 
    namespace: string
  ): T | undefined {
    const factory = this.factories.get(moduleId);
    return factory?.create(moduleId, namespace);
  }

  static has(moduleId: string): boolean {
    return this.factories.has(moduleId);
  }
}