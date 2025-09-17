import { z } from "zod";
import type { 
  User, UserWithoutPassword, UserPreferences, 
  UserSession, UserModuleOverride,
  AdminModule
} from "@shared/schema";

// ============= REQUEST/RESPONSE TYPES =============

// User Profile
export interface UserProfile extends UserWithoutPassword {
  preferences?: UserPreferences;
  moduleAccess: AdminModule[];
  lastLoginAt?: Date;
  sessionCount: number;
}

// User Dashboard
export interface UserDashboard {
  user: UserWithoutPassword;
  availableModules: AdminModule[];
  preferences: UserPreferences;
  recentActivity: UserActivity[];
  notifications: UserNotification[];
}

// User Activity
export interface UserActivity {
  id: string;
  action: string;
  moduleId?: string;
  moduleName?: string;
  timestamp: Date;
  details?: Record<string, any>;
}

// User Notifications
export interface UserNotification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
  moduleId?: string;
}

// Session Information
export interface SessionInfo {
  id: string;
  token: string; // Only for current session
  expiresAt: Date;
  createdAt: Date;
  isActive: boolean;
  device?: string;
  ip?: string;
}

// ============= VALIDATION SCHEMAS =============

// User registration schema (public registration)
export const publicRegistrationSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(50),
  email: z.string().email("Invalid email format").optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

// User login schema
export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional().default(false)
});

// Profile update schema
export const profileUpdateSchema = z.object({
  email: z.string().email("Invalid email format").optional(),
  // Note: username and role changes require admin privileges
});

// Password change schema
export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "New passwords don't match",
  path: ["confirmPassword"]
});

// User preferences update schema
export const preferencesUpdateSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  language: z.string().min(2).max(10).optional(),
  notifications: z.record(z.any()).optional(),
  moduleSettings: z.record(z.any()).optional(),
});

// Session management schema
export const sessionRefreshSchema = z.object({
  extendBy: z.number().min(1).max(24).optional().default(2) // hours
});

// ============= ERROR TYPES =============

export class UserModuleError extends Error {
  constructor(
    message: string,
    public readonly code: 'USER_NOT_FOUND' | 'INVALID_CREDENTIALS' | 'PERMISSION_DENIED' | 'VALIDATION_ERROR' | 'SESSION_EXPIRED',
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = 'UserModuleError';
  }
}

// ============= PRIVACY TYPES =============

// Data export format
export interface UserDataExport {
  profile: UserWithoutPassword;
  preferences: UserPreferences;
  activityHistory: UserActivity[];
  sessions: Omit<SessionInfo, 'token'>[];
  moduleAccess: {
    moduleId: string;
    moduleName: string;
    accessLevel: string;
    grantedAt: Date;
  }[];
  exportedAt: Date;
}

// Account deletion request
export interface AccountDeletionRequest {
  userId: string;
  reason?: string;
  scheduledAt: Date;
  requestedAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
}

// ============= MODULE ACCESS TYPES =============

export interface ModuleAccessRequest {
  moduleId: string;
  reason?: string;
  requestedAt: Date;
  status: 'pending' | 'approved' | 'denied';
}

export interface ModuleAccessSummary {
  moduleId: string;
  moduleName: string;
  displayName: string;
  description: string;
  hasAccess: boolean;
  accessSource: 'role' | 'override';
  canRequest: boolean;
}

// ============= EXPORT TYPES =============

export type PublicRegistrationRequest = z.infer<typeof publicRegistrationSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;
export type ProfileUpdateRequest = z.infer<typeof profileUpdateSchema>;
export type PasswordChangeRequest = z.infer<typeof passwordChangeSchema>;
export type PreferencesUpdateRequest = z.infer<typeof preferencesUpdateSchema>;
export type SessionRefreshRequest = z.infer<typeof sessionRefreshSchema>;