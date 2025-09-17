import { z } from "zod";
import type { 
  AdminModule, AdminSetting, AdminLog, 
  ModuleRolePermission, UserModuleOverride,
  UserWithoutPassword
} from "@shared/schema";

// ============= REQUEST/RESPONSE TYPES =============

// Dashboard Stats
export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalModules: number;
  activeModules: number;
  recentLogsCount: number;
  systemHealth: 'healthy' | 'warning' | 'error';
}

// Module Management
export interface ModuleWithStats extends AdminModule {
  totalUsers: number;
  activeUsers: number;
  settingsCount: number;
  recentActivity: AdminLog[];
}

// Role Permission Management
export interface RolePermissionSummary {
  role: string;
  moduleId: string;
  moduleName: string;
  canAccess: boolean;
  updatedAt: Date;
}

// User Override Management
export interface UserOverrideSummary {
  userId: string;
  username: string;
  moduleId: string;
  moduleName: string;
  enabled: boolean;
  updatedAt: Date;
}

// System Health Check
export interface SystemHealth {
  database: 'connected' | 'disconnected';
  modules: {
    name: string;
    status: 'active' | 'inactive' | 'error';
    lastCheck: Date;
  }[];
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
}

// ============= VALIDATION SCHEMAS =============

// Module toggle schema
export const moduleToggleSchema = z.object({
  isActive: z.boolean()
});

// Role permission schema
export const rolePermissionUpdateSchema = z.object({
  canAccess: z.boolean()
});

// User override schema  
export const userOverrideUpdateSchema = z.object({
  enabled: z.boolean()
});

// Dashboard filters
export const dashboardFiltersSchema = z.object({
  timeRange: z.enum(['24h', '7d', '30d', '90d']).optional().default('24h'),
  moduleId: z.string().optional(),
  userId: z.string().optional()
});

// ============= ERROR TYPES =============

export class AdminModuleError extends Error {
  constructor(
    message: string,
    public readonly code: 'MODULE_NOT_FOUND' | 'PERMISSION_DENIED' | 'VALIDATION_ERROR' | 'SYSTEM_ERROR',
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = 'AdminModuleError';
  }
}

// ============= AUDIT LOG TYPES =============

export interface AuditLogEntry {
  id: string;
  action: string;
  userId: string;
  username: string;
  moduleId?: string;
  moduleName?: string;
  details: Record<string, any>;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

// ============= EXPORT TYPES =============

export type ModuleToggleRequest = z.infer<typeof moduleToggleSchema>;
export type RolePermissionUpdateRequest = z.infer<typeof rolePermissionUpdateSchema>;
export type UserOverrideUpdateRequest = z.infer<typeof userOverrideUpdateSchema>;
export type DashboardFilters = z.infer<typeof dashboardFiltersSchema>;