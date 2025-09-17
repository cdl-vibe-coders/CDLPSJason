// ============= SHARED CONTRACTS BETWEEN MODULES =============
// This file defines interfaces that modules can use to communicate
// without directly depending on each other's implementations

import type { z } from "zod";

// ============= COMMON TYPES =============

export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BaseUser {
  id: string;
  username: string;
  email?: string;
  role: string;
  isActive: boolean;
}

// ============= MODULE CONTRACTS =============

export interface UserContract {
  // What the users module exposes
  exports: {
    getUserById(userId: string): Promise<BaseUser | undefined>;
    getUserByUsername(username: string): Promise<BaseUser | undefined>;
    verifyUserAccess(userId: string, resource: string): Promise<boolean>;
    createUser(userData: CreateUserRequest): Promise<BaseUser>;
  };
}

export interface AdminContract {
  // What the admin module exposes
  exports: {
    logAdminAction(action: AdminActionLog): Promise<void>;
    getModuleSettings(moduleId: string): Promise<ModuleSettings>;
    checkModulePermission(userId: string, moduleId: string): Promise<boolean>;
  };
}

// ============= REQUEST/RESPONSE TYPES =============

export interface CreateUserRequest {
  username: string;
  email?: string;
  password: string;
  role?: string;
}

export interface AdminActionLog {
  userId: string;
  moduleId: string;
  action: string;
  details?: Record<string, any>;
  timestamp?: Date;
}

export interface ModuleSettings {
  [key: string]: any;
}

// ============= ERROR TYPES =============

export class ModuleError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly moduleId: string,
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = 'ModuleError';
  }
}

export class AuthenticationError extends ModuleError {
  constructor(message: string, moduleId: string, details?: Record<string, any>) {
    super(message, 'AUTHENTICATION_ERROR', moduleId, details);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends ModuleError {
  constructor(message: string, moduleId: string, details?: Record<string, any>) {
    super(message, 'AUTHORIZATION_ERROR', moduleId, details);
    this.name = 'AuthorizationError';
  }
}

export class ValidationError extends ModuleError {
  constructor(message: string, moduleId: string, details?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', moduleId, details);
    this.name = 'ValidationError';
  }
}

// ============= MODULE COMMUNICATION =============

/**
 * Service registry for inter-module communication
 */
export interface ModuleServiceRegistry {
  registerService<T>(moduleId: string, service: T): void;
  getService<T>(moduleId: string): T | undefined;
  hasService(moduleId: string): boolean;
}

/**
 * Event system for loosely coupled module communication
 */
export interface ModuleEventBus {
  emit(event: ModuleEvent): Promise<void>;
  on(eventType: string, handler: ModuleEventHandler): void;
  off(eventType: string, handler: ModuleEventHandler): void;
}

export interface ModuleEvent {
  type: string;
  moduleId: string;
  data: any;
  timestamp: Date;
}

export type ModuleEventHandler = (event: ModuleEvent) => Promise<void> | void;

// ============= CONFIGURATION TYPES =============

export interface DatabaseConfig {
  url: string;
  namespace: string;
  maxConnections?: number;
  ssl?: boolean;
}

export interface ModuleConfig {
  database: DatabaseConfig;
  api: {
    prefix: string;
    version: string;
  };
  features: {
    [featureName: string]: boolean;
  };
  settings: {
    [key: string]: any;
  };
}

// ============= VALIDATION SCHEMAS =============

// These would be implemented by each module for type safety
export interface ContractValidationSchema {
  CreateUserRequest: z.ZodSchema<CreateUserRequest>;
  AdminActionLog: z.ZodSchema<AdminActionLog>;
  ModuleSettings: z.ZodSchema<ModuleSettings>;
}