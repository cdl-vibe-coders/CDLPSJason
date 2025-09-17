import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { DynamicModuleRegistry } from "./DynamicModuleRegistry";
import type { DeploymentMode } from "../types/module";

// ============= STANDALONE MODULE RUNNER =============

export class StandaloneModuleRunner {
  private app: Express;
  private registry: DynamicModuleRegistry;
  private moduleId: string;
  private port: number;

  constructor(moduleId: string, port: number = 3000) {
    this.moduleId = moduleId;
    this.port = port;
    this.app = express();
    this.registry = new DynamicModuleRegistry('distributed');
    
    this.setupMiddleware();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: false }));
    this.app.use(cookieParser());

    // Request logging
    this.app.use((req, res, next) => {
      const start = Date.now();
      res.on("finish", () => {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
      });
      next();
    });
  }

  async start(): Promise<void> {
    try {
      console.log(`🚀 Starting standalone module: ${this.moduleId} on port ${this.port}`);

      // Discover modules
      await this.registry.discoverModules();
      
      // Load only the specific module we want to run
      const success = await this.registry.loadModule(this.moduleId);
      
      if (!success) {
        throw new Error(`Failed to load module: ${this.moduleId}`);
      }

      // Get the module and set up routes
      const module = this.registry.getModule(this.moduleId);
      if (module?.router) {
        // Mount the module's routes at the root level for standalone operation
        this.app.use('/', module.router);
        console.log(`📍 Module routes mounted at: /`);
      }

      // Health endpoint
      this.app.get('/health', async (req, res) => {
        try {
          const healthCheck = await this.registry.performHealthCheck();
          res.json({
            status: 'healthy',
            module: this.moduleId,
            port: this.port,
            timestamp: new Date().toISOString(),
            health: healthCheck
          });
        } catch (error) {
          res.status(500).json({
            status: 'unhealthy', 
            module: this.moduleId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      });

      // Start the server
      this.app.listen(this.port, '0.0.0.0', () => {
        console.log(`✅ Standalone module ${this.moduleId} running on port ${this.port}`);
        console.log(`🏥 Health check available at: http://localhost:${this.port}/health`);
      });

      // Graceful shutdown
      process.on('SIGTERM', () => this.shutdown());
      process.on('SIGINT', () => this.shutdown());

    } catch (error) {
      console.error(`❌ Failed to start standalone module ${this.moduleId}:`, error);
      process.exit(1);
    }
  }

  private async shutdown(): Promise<void> {
    console.log(`🛑 Shutting down standalone module: ${this.moduleId}`);
    
    try {
      await this.registry.stopAllModules();
      console.log(`✅ Module ${this.moduleId} shut down successfully`);
      process.exit(0);
    } catch (error) {
      console.error(`❌ Error during shutdown:`, error);
      process.exit(1);
    }
  }
}

// ============= STANDALONE ENTRY POINTS =============

/**
 * Run admin module as standalone service
 */
export async function runAdminStandalone(port: number = 3001): Promise<void> {
  const runner = new StandaloneModuleRunner('admin', port);
  await runner.start();
}

/**
 * Run users module as standalone service
 */
export async function runUsersStandalone(port: number = 3002): Promise<void> {
  const runner = new StandaloneModuleRunner('users', port);
  await runner.start();
}

// ============= CLI SUPPORT =============

if (require.main === module) {
  const moduleId = process.argv[2];
  const port = parseInt(process.argv[3]) || 3000;

  if (!moduleId) {
    console.error('Usage: node standalone.js <module-id> [port]');
    console.error('Example: node standalone.js admin 3001');
    process.exit(1);
  }

  const runner = new StandaloneModuleRunner(moduleId, port);
  runner.start().catch(error => {
    console.error('Failed to start standalone module:', error);
    process.exit(1);
  });
}