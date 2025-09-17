import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Shield, 
  Users, 
  Database, 
  AlertTriangle,
  CheckCircle,
  X,
  Settings,
  Lock,
  Unlock
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RolePermission {
  id: string;
  role: string;
  moduleId: string;
  moduleName: string;
  moduleDisplayName: string;
  canAccess: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  updatedAt: string;
}

interface Module {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  isActive: boolean;
}

const USER_ROLES = ['admin', 'manager', 'user', 'viewer'] as const;

export default function RolePermissions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<string>('admin');

  const { data: modules = [], isLoading: modulesLoading } = useQuery<Module[]>({
    queryKey: ['/api/admin/modules'],
  });

  const { data: permissions = [], isLoading: permissionsLoading } = useQuery<RolePermission[]>({
    queryKey: ['/api/admin/roles', selectedRole, 'permissions'],
  });

  const updatePermissionMutation = useMutation({
    mutationFn: async ({ 
      moduleId, 
      role, 
      permissionType, 
      value 
    }: { 
      moduleId: string; 
      role: string; 
      permissionType: string; 
      value: boolean; 
    }) => {
      const response = await fetch(`/api/admin/modules/${moduleId}/permissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          role, 
          [permissionType]: value 
        }),
      });
      if (!response.ok) throw new Error('Failed to update permission');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/roles', selectedRole, 'permissions'] });
      toast({
        title: "Permission Updated",
        description: "The role permission has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update permission. Please try again.",
        variant: "destructive",
      });
    },
  });

  const isLoading = modulesLoading || permissionsLoading;

  const getPermissionForModule = (moduleId: string) => {
    return permissions.find(p => p.moduleId === moduleId);
  };

  const hasAnyAccess = (moduleId: string) => {
    const permission = getPermissionForModule(moduleId);
    return permission?.canAccess || false;
  };

  const updatePermission = (moduleId: string, permissionType: string, value: boolean) => {
    updatePermissionMutation.mutate({
      moduleId,
      role: selectedRole,
      permissionType,
      value,
    });
  };

  return (
    <div className="space-y-6" data-testid="role-permissions">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Role Permissions</h2>
        <p className="text-muted-foreground">
          Configure role-based access control for system modules
        </p>
      </div>

      {/* Role Selection Tabs */}
      <Tabs value={selectedRole} onValueChange={setSelectedRole} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          {USER_ROLES.map((role) => (
            <TabsTrigger 
              key={role} 
              value={role} 
              className="capitalize"
              data-testid={`tab-role-${role}`}
            >
              <Shield className="h-4 w-4 mr-2" />
              {role}
            </TabsTrigger>
          ))}
        </TabsList>

        {USER_ROLES.map((role) => (
          <TabsContent key={role} value={role} className="space-y-6">
            {/* Role Overview */}
            <Card data-testid={`card-role-overview-${role}`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  {role.charAt(0).toUpperCase() + role.slice(1)} Role Permissions
                </CardTitle>
                <CardDescription>
                  Manage module access and operation permissions for {role} users
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Modules with Access</span>
                      <span className="text-sm text-muted-foreground" data-testid={`stat-accessible-modules-${role}`}>
                        {isLoading ? <Skeleton className="h-4 w-8" /> : permissions.filter(p => p.canAccess).length}
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Create Permissions</span>
                      <span className="text-sm text-muted-foreground" data-testid={`stat-create-permissions-${role}`}>
                        {isLoading ? <Skeleton className="h-4 w-8" /> : permissions.filter(p => p.canCreate).length}
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Delete Permissions</span>
                      <span className="text-sm text-muted-foreground" data-testid={`stat-delete-permissions-${role}`}>
                        {isLoading ? <Skeleton className="h-4 w-8" /> : permissions.filter(p => p.canDelete).length}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Permissions Matrix */}
            <Card data-testid={`card-permissions-matrix-${role}`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Module Permissions Matrix
                </CardTitle>
                <CardDescription>
                  Configure specific permissions for each module
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-2">
                          <Skeleton className="h-5 w-48" />
                          <Skeleton className="h-4 w-32" />
                        </div>
                        <div className="flex items-center gap-4">
                          <Skeleton className="h-6 w-12" />
                          <Skeleton className="h-6 w-12" />
                          <Skeleton className="h-6 w-12" />
                          <Skeleton className="h-6 w-12" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : modules.length === 0 ? (
                  <div className="text-center py-12" data-testid={`no-modules-${role}`}>
                    <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No modules found</h3>
                    <p className="text-muted-foreground">
                      Create modules to configure role permissions
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Table Header */}
                    <div className="grid grid-cols-6 gap-4 pb-2 border-b font-medium text-sm">
                      <div className="col-span-2">Module</div>
                      <div className="text-center">Access</div>
                      <div className="text-center">Create</div>
                      <div className="text-center">Update</div>
                      <div className="text-center">Delete</div>
                    </div>

                    {/* Permission Rows */}
                    {modules.map((module) => {
                      const permission = getPermissionForModule(module.id);
                      const hasAccess = hasAnyAccess(module.id);
                      
                      return (
                        <div 
                          key={module.id} 
                          className="grid grid-cols-6 gap-4 p-3 border rounded-lg hover-elevate"
                          data-testid={`permission-row-${role}-${module.name}`}
                        >
                          <div className="col-span-2">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                {module.isActive ? (
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                ) : (
                                  <X className="h-4 w-4 text-gray-400" />
                                )}
                                <div>
                                  <h3 className="font-medium" data-testid={`module-name-${role}-${module.name}`}>
                                    {module.displayName}
                                  </h3>
                                  <p className="text-sm text-muted-foreground">
                                    {module.description || "No description"}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex justify-center">
                            <Switch
                              checked={permission?.canAccess || false}
                              onCheckedChange={(checked) => updatePermission(module.id, 'canAccess', checked)}
                              disabled={updatePermissionMutation.isPending}
                              data-testid={`switch-access-${role}-${module.name}`}
                            />
                          </div>
                          
                          <div className="flex justify-center">
                            <Switch
                              checked={permission?.canCreate || false}
                              onCheckedChange={(checked) => updatePermission(module.id, 'canCreate', checked)}
                              disabled={updatePermissionMutation.isPending || !hasAccess}
                              data-testid={`switch-create-${role}-${module.name}`}
                            />
                          </div>
                          
                          <div className="flex justify-center">
                            <Switch
                              checked={permission?.canUpdate || false}
                              onCheckedChange={(checked) => updatePermission(module.id, 'canUpdate', checked)}
                              disabled={updatePermissionMutation.isPending || !hasAccess}
                              data-testid={`switch-update-${role}-${module.name}`}
                            />
                          </div>
                          
                          <div className="flex justify-center">
                            <Switch
                              checked={permission?.canDelete || false}
                              onCheckedChange={(checked) => updatePermission(module.id, 'canDelete', checked)}
                              disabled={updatePermissionMutation.isPending || !hasAccess}
                              data-testid={`switch-delete-${role}-${module.name}`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}