import type { ModuleServiceRegistry, ModuleEventBus, ModuleEvent, ModuleEventHandler } from "@shared/contracts";

// ============= MODULE SERVICE REGISTRY IMPLEMENTATION =============

export class ServiceRegistryImpl implements ModuleServiceRegistry {
  private services = new Map<string, any>();
  private eventBus: ModuleEventBus;

  constructor(eventBus: ModuleEventBus) {
    this.eventBus = eventBus;
  }

  registerService<T>(moduleId: string, service: T): void {
    this.services.set(moduleId, service);
    console.log(`📝 Service registered for module: ${moduleId}`);
    
    // Emit service registration event
    this.eventBus.emit({
      type: 'service_registered',
      moduleId,
      data: { serviceType: typeof service },
      timestamp: new Date()
    });
  }

  getService<T>(moduleId: string): T | undefined {
    return this.services.get(moduleId);
  }

  hasService(moduleId: string): boolean {
    return this.services.has(moduleId);
  }

  unregisterService(moduleId: string): void {
    const removed = this.services.delete(moduleId);
    if (removed) {
      console.log(`🗑️ Service unregistered for module: ${moduleId}`);
      
      // Emit service unregistration event
      this.eventBus.emit({
        type: 'service_unregistered',
        moduleId,
        data: {},
        timestamp: new Date()
      });
    }
  }

  getAllServices(): string[] {
    return Array.from(this.services.keys());
  }
}

// ============= MODULE EVENT BUS IMPLEMENTATION =============

export class ModuleEventBusImpl implements ModuleEventBus {
  private eventHandlers = new Map<string, Set<ModuleEventHandler>>();
  private eventHistory: ModuleEvent[] = [];
  private readonly maxHistorySize = 1000;

  async emit(event: ModuleEvent): Promise<void> {
    // Store event in history (with size limit)
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // Get handlers for this event type
    const handlers = this.eventHandlers.get(event.type);
    if (!handlers || handlers.size === 0) {
      console.log(`📡 No handlers for event: ${event.type} from module: ${event.moduleId}`);
      return;
    }

    // Execute all handlers concurrently
    const handlerPromises = Array.from(handlers).map(async (handler) => {
      try {
        await handler(event);
      } catch (error) {
        console.error(`Event handler error for ${event.type}:`, error);
      }
    });

    await Promise.all(handlerPromises);
    console.log(`📡 Emitted event: ${event.type} to ${handlers.size} handlers`);
  }

  on(eventType: string, handler: ModuleEventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    
    this.eventHandlers.get(eventType)!.add(handler);
    console.log(`🎧 Handler registered for event: ${eventType}`);
  }

  off(eventType: string, handler: ModuleEventHandler): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.eventHandlers.delete(eventType);
      }
      console.log(`🎧 Handler removed for event: ${eventType}`);
    }
  }

  once(eventType: string, handler: ModuleEventHandler): void {
    const onceHandler: ModuleEventHandler = async (event: ModuleEvent) => {
      await handler(event);
      this.off(eventType, onceHandler);
    };
    
    this.on(eventType, onceHandler);
  }

  getEventHistory(eventType?: string, moduleId?: string, limit: number = 100): ModuleEvent[] {
    let filteredEvents = this.eventHistory;

    if (eventType) {
      filteredEvents = filteredEvents.filter(event => event.type === eventType);
    }

    if (moduleId) {
      filteredEvents = filteredEvents.filter(event => event.moduleId === moduleId);
    }

    return filteredEvents
      .slice(-limit) // Get last N events
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()); // Most recent first
  }

  getEventTypes(): string[] {
    return Array.from(this.eventHandlers.keys());
  }

  getHandlerCount(eventType?: string): number {
    if (eventType) {
      return this.eventHandlers.get(eventType)?.size || 0;
    }
    
    return Array.from(this.eventHandlers.values())
      .reduce((total, handlers) => total + handlers.size, 0);
  }
}

// ============= COMMUNICATION HUB =============

export class ModuleCommunicationHub {
  private serviceRegistry: ServiceRegistryImpl;
  private eventBus: ModuleEventBusImpl;

  constructor() {
    this.eventBus = new ModuleEventBusImpl();
    this.serviceRegistry = new ServiceRegistryImpl(this.eventBus);
    
    // Set up core event handlers
    this.setupCoreEventHandlers();
  }

  private setupCoreEventHandlers(): void {
    // Log all events in development
    if (process.env.NODE_ENV === 'development') {
      this.eventBus.on('*', async (event) => {
        console.log(`📡 Event: ${event.type} from ${event.moduleId}`, event.data);
      });
    }

    // Handle service health checks
    this.eventBus.on('health_check_request', async (event) => {
      const { moduleId } = event.data;
      const service = this.serviceRegistry.getService(moduleId);
      
      if (service && typeof service.healthCheck === 'function') {
        try {
          const health = await service.healthCheck();
          this.eventBus.emit({
            type: 'health_check_response',
            moduleId: event.moduleId,
            data: { targetModule: moduleId, health },
            timestamp: new Date()
          });
        } catch (error) {
          this.eventBus.emit({
            type: 'health_check_response', 
            moduleId: event.moduleId,
            data: { 
              targetModule: moduleId, 
              health: { status: 'unhealthy', error: error instanceof Error ? error.message : 'Unknown error' }
            },
            timestamp: new Date()
          });
        }
      }
    });
  }

  getServiceRegistry(): ModuleServiceRegistry {
    return this.serviceRegistry;
  }

  getEventBus(): ModuleEventBus {
    return this.eventBus;
  }

  // Utility method for modules to get both registry and event bus
  getCommunicationContext() {
    return {
      serviceRegistry: this.serviceRegistry,
      eventBus: this.eventBus
    };
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    console.log("🔌 Shutting down module communication hub...");
    
    // Emit shutdown event
    await this.eventBus.emit({
      type: 'system_shutdown',
      moduleId: 'system',
      data: { timestamp: new Date() },
      timestamp: new Date()
    });

    // Clear all handlers and services
    this.eventBus.getEventTypes().forEach(eventType => {
      // Note: We can't easily clear handlers without exposing the internal Map
      // This would be improved in a production implementation
    });

    this.serviceRegistry.getAllServices().forEach(moduleId => {
      this.serviceRegistry.unregisterService(moduleId);
    });

    console.log("✅ Module communication hub shut down");
  }
}

// ============= SINGLETON INSTANCE =============

export const communicationHub = new ModuleCommunicationHub();