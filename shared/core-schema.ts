import { z } from "zod";

// ============= SHARED CORE TYPES =============
// These types are shared between modules for contracts and communication
// No database tables are defined here - only interfaces and types

// ============= BASE ENTITY INTERFACES =============

export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditableEntity extends BaseEntity {
  createdBy?: string;
  updatedBy?: string;
}

// ============= USER INTERFACES (Contract Types) =============

export interface BaseUser {
  id: string;
  username: string;
  email?: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile {
  firstName?: string;
  lastName?: string;
  avatar?: string;
  bio?: string;
  timezone?: string;
}

export interface UserPreferences {
  theme: string;
  language: string;
  notifications: Record<string, any>;
  moduleSettings: Record<string, any>;
}

// ============= MODULE INTERFACES =============

export interface ModuleInfo {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  version: string;
  isActive: boolean;
}

export interface ModuleSettings {
  [key: string]: any;
}

// ============= PERMISSION INTERFACES =============

export interface PermissionCheck {
  userId: string;
  moduleId: string;
  action: string;
}

export interface PermissionResult {
  granted: boolean;
  reason: 'role_permission' | 'user_override' | 'module_disabled' | 'user_inactive';
}

// ============= VALIDATION SCHEMAS =============

export const userRoleSchema = z.enum(['admin', 'moderator', 'user', 'guest']);
export const moduleActionSchema = z.enum(['read', 'write', 'delete', 'admin']);
export const themeSchema = z.enum(['light', 'dark', 'auto']);
export const languageSchema = z.enum(['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh']);

// User creation schema for inter-module communication
export const createUserRequestSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email().optional(),
  password: z.string().min(6),
  role: userRoleSchema.default('user'),
});

export const updateUserRequestSchema = z.object({
  email: z.string().email().optional(),
  role: userRoleSchema.optional(),
  isActive: z.boolean().optional(),
});

export const userPreferencesUpdateSchema = z.object({
  theme: themeSchema.optional(),
  language: languageSchema.optional(),
  notifications: z.record(z.any()).optional(),
  moduleSettings: z.record(z.any()).optional(),
});

// Admin action logging schema
export const adminActionLogSchema = z.object({
  userId: z.string(),
  moduleId: z.string(),
  action: z.string(),
  details: z.record(z.any()).optional(),
});

// Module permission schema
export const modulePermissionSchema = z.object({
  moduleId: z.string(),
  role: userRoleSchema,
  canAccess: z.boolean(),
});

export const userModuleOverrideSchema = z.object({
  userId: z.string(),
  moduleId: z.string(),
  enabled: z.boolean(),
});

// ============= ERROR TYPES =============

export class CoreError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = 'CoreError';
  }
}

export class ValidationError extends CoreError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends CoreError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'AUTHENTICATION_ERROR', 401, details);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends CoreError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'AUTHORIZATION_ERROR', 403, details);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends CoreError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'NOT_FOUND', 404, details);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends CoreError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'CONFLICT', 409, details);
    this.name = 'ConflictError';
  }
}

// ============= TYPE EXPORTS =============

export type CreateUserRequest = z.infer<typeof createUserRequestSchema>;
export type UpdateUserRequest = z.infer<typeof updateUserRequestSchema>;
export type UserPreferencesUpdate = z.infer<typeof userPreferencesUpdateSchema>;
export type AdminActionLog = z.infer<typeof adminActionLogSchema>;
export type ModulePermission = z.infer<typeof modulePermissionSchema>;
export type UserModuleOverride = z.infer<typeof userModuleOverrideSchema>;

export type UserRole = z.infer<typeof userRoleSchema>;
export type ModuleAction = z.infer<typeof moduleActionSchema>;
export type Theme = z.infer<typeof themeSchema>;
export type Language = z.infer<typeof languageSchema>;