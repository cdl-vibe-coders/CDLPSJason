import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Users, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { AdminModule, ModuleRolePermission } from "@shared/schema";

interface RolePermissionsProps {
  modules: AdminModule[];
  isLoading: boolean;
}

const AVAILABLE_ROLES = [
  { value: "admin", label: "Administrator", description: "Full system access" },
  { value: "user", label: "User", description: "Standard user access" },
  { value: "guest", label: "Guest", description: "Limited read-only access" },
];

export function RolePermissions({ modules, isLoading }: RolePermissionsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedModule, setSelectedModule] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("");

  // Fetch permissions for selected module
  const { 
    data: permissions = [], 
    isLoading: permissionsLoading 
  } = useQuery({
    queryKey: ['/api/settings/modules', selectedModule, 'permissions'],
    enabled: !!selectedModule
  });

  // Create role permission mutation
  const createPermissionMutation = useMutation({
    mutationFn: async ({ moduleId, role, canAccess }: { moduleId: string; role: string; canAccess: boolean }) => {
      const response = await apiRequest('POST', `/api/settings/modules/${moduleId}/permissions`, { role, canAccess });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/modules', selectedModule, 'permissions'] });
      setSelectedRole("");
      toast({
        title: "Permission Created",
        description: "Role permission has been created successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create permission: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  });

  // Update role permission mutation
  const updatePermissionMutation = useMutation({
    mutationFn: async ({ moduleId, role, canAccess }: { moduleId: string; role: string; canAccess: boolean }) => {
      const response = await apiRequest('PUT', `/api/settings/modules/${moduleId}/permissions/${role}`, { canAccess });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/modules', selectedModule, 'permissions'] });
      toast({
        title: "Permission Updated",
        description: "Role permission has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update permission: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  });

  // Delete role permission mutation
  const deletePermissionMutation = useMutation({
    mutationFn: async ({ moduleId, role }: { moduleId: string; role: string }) => {
      const response = await apiRequest('DELETE', `/api/settings/modules/${moduleId}/permissions/${role}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/modules', selectedModule, 'permissions'] });
      toast({
        title: "Permission Deleted",
        description: "Role permission has been deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete permission: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  });

  const getExistingRoles = () => {
    return permissions.map((p: ModuleRolePermission) => p.role);
  };

  const getAvailableRoles = () => {
    const existingRoles = getExistingRoles();
    return AVAILABLE_ROLES.filter(role => !existingRoles.includes(role.value));
  };

  const handleCreatePermission = () => {
    if (!selectedModule || !selectedRole) return;
    
    createPermissionMutation.mutate({
      moduleId: selectedModule,
      role: selectedRole,
      canAccess: true
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="role-permissions-loading">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="role-permissions">
      {/* Module Selection */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <label className="text-sm font-medium mb-2 block">Select Module</label>
          <Select value={selectedModule} onValueChange={setSelectedModule} data-testid="select-module">
            <SelectTrigger>
              <SelectValue placeholder="Choose a module to manage permissions" />
            </SelectTrigger>
            <SelectContent>
              {modules.map((module) => (
                <SelectItem key={module.id} value={module.id}>
                  <div className="flex items-center gap-2">
                    <span>{module.displayName}</span>
                    <Badge variant={module.isActive ? "default" : "secondary"} className="text-xs">
                      {module.isActive ? "Active" : "Disabled"}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!selectedModule && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8" data-testid="no-module-selected">
              <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Select a Module</h3>
              <p className="text-muted-foreground">
                Choose a module from the dropdown above to manage its role permissions.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedModule && (
        <>
          {/* Add New Permission */}
          {getAvailableRoles().length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Add Role Permission</CardTitle>
                <CardDescription>
                  Grant access to this module for a specific user role.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <Select value={selectedRole} onValueChange={setSelectedRole} data-testid="select-role">
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a role" />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableRoles().map((role) => (
                          <SelectItem key={role.value} value={role.value}>
                            <div>
                              <div className="font-medium">{role.label}</div>
                              <div className="text-sm text-muted-foreground">{role.description}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handleCreatePermission}
                    disabled={!selectedRole || createPermissionMutation.isPending}
                    data-testid="button-add-permission"
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Permission
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Current Permissions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Current Permissions</CardTitle>
              <CardDescription>
                Manage which roles have access to this module.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {permissionsLoading ? (
                <div className="space-y-3" data-testid="permissions-loading">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                      <Skeleton className="h-5 w-24" />
                      <Skeleton className="h-6 w-12" />
                    </div>
                  ))}
                </div>
              ) : permissions.length === 0 ? (
                <div className="text-center py-8" data-testid="no-permissions">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Permissions Set</h3>
                  <p className="text-muted-foreground">
                    This module has no role-based permissions configured. Add permissions above to control access.
                  </p>
                </div>
              ) : (
                <div className="space-y-3" data-testid="permissions-list">
                  {permissions.map((permission: ModuleRolePermission) => {
                    const roleInfo = AVAILABLE_ROLES.find(r => r.value === permission.role);
                    return (
                      <div 
                        key={permission.id} 
                        className="flex items-center justify-between p-4 border rounded-lg"
                        data-testid={`permission-${permission.role}`}
                      >
                        <div>
                          <div className="font-medium" data-testid={`permission-role-${permission.role}`}>
                            {roleInfo?.label || permission.role}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {roleInfo?.description || "Custom role"}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge 
                            variant={permission.canAccess ? "default" : "secondary"}
                            data-testid={`permission-status-${permission.role}`}
                          >
                            {permission.canAccess ? "Allowed" : "Denied"}
                          </Badge>
                          <Switch
                            checked={permission.canAccess}
                            onCheckedChange={(canAccess) => {
                              updatePermissionMutation.mutate({
                                moduleId: selectedModule,
                                role: permission.role,
                                canAccess
                              });
                            }}
                            disabled={updatePermissionMutation.isPending}
                            data-testid={`switch-permission-${permission.role}`}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              deletePermissionMutation.mutate({
                                moduleId: selectedModule,
                                role: permission.role
                              });
                            }}
                            disabled={deletePermissionMutation.isPending}
                            data-testid={`button-delete-permission-${permission.role}`}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {getAvailableRoles().length === 0 && permissions.length > 0 && (
            <Alert>
              <AlertDescription>
                All available roles have been configured for this module. You can modify existing permissions above.
              </AlertDescription>
            </Alert>
          )}
        </>
      )}
    </div>
  );
}