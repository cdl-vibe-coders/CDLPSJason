// ============= FRONTEND MODULE REGISTRY =============
// This registry provides metadata for all frontend modules in the system
// Each module entry defines how it should appear in navigation and its routing structure

import { Settings, Users, Shield, Database, Activity, LogOut } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavigationModule {
  id: string;
  name: string; // Module identifier used in URLs  
  displayName: string;
  description: string;
  icon: LucideIcon;
  defaultPath: string;
  subpages?: NavigationSubpage[];
}

export interface NavigationSubpage {
  path: string; // Relative to module path (e.g., "/dashboard") 
  displayName: string;
  icon?: LucideIcon;
  description?: string;
}

// ============= MODULE DEFINITIONS =============

export const adminModule: NavigationModule = {
  id: 'admin',
  name: 'admin',
  displayName: 'System Administration',
  description: 'Manage modules, permissions, and system settings',
  icon: Shield,
  defaultPath: '/admin',
  subpages: [
    {
      path: '/dashboard',
      displayName: 'Dashboard',
      icon: Activity,
      description: 'System overview and statistics'
    },
    {
      path: '/modules',
      displayName: 'Module Management',
      icon: Database,
      description: 'Create and configure system modules'
    },
    {
      path: '/permissions',
      displayName: 'Role Permissions',
      icon: Shield,
      description: 'Configure role-based module access'
    },
    {
      path: '/users',
      displayName: 'User Overrides',
      icon: Users,
      description: 'Manage individual user access overrides'
    },
    {
      path: '/logs',
      displayName: 'System Logs',
      icon: Activity,
      description: 'View system activity and audit trails'
    }
  ]
};

export const usersModule: NavigationModule = {
  id: 'users',
  name: 'users',
  displayName: 'User Management',
  description: 'Manage user accounts, profiles, and preferences',
  icon: Users,
  defaultPath: '/users',
  subpages: [
    {
      path: '/profile',
      displayName: 'My Profile',
      icon: Users,
      description: 'View and edit your profile information'
    },
    {
      path: '/preferences',
      displayName: 'Preferences',
      icon: Settings,
      description: 'Configure your account preferences'
    },
    {
      path: '/sessions',
      displayName: 'Active Sessions',
      icon: Activity,
      description: 'Manage your active login sessions'
    }
  ]
};

// ============= MODULE REGISTRY =============

export const moduleRegistry: Record<string, NavigationModule> = {
  admin: adminModule,
  users: usersModule
};

// Helper function to get module by name
export function getModule(moduleName: string): NavigationModule | undefined {
  return moduleRegistry[moduleName];
}

// Helper function to get all modules as array
export function getAllModules(): NavigationModule[] {
  return Object.values(moduleRegistry);
}

// Helper function to find a subpage within a module
export function findSubpage(moduleName: string, subpagePath: string): NavigationSubpage | undefined {
  const module = getModule(moduleName);
  return module?.subpages?.find(page => page.path === subpagePath);
}

// Helper function to get the full path for a module subpage
export function getFullPath(moduleName: string, subpagePath?: string): string {
  const module = getModule(moduleName);
  if (!module) return '/';
  
  if (!subpagePath) {
    return module.defaultPath;
  }
  
  return `${module.defaultPath}${subpagePath}`;
}