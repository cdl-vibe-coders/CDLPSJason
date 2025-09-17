import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { User, UserPlus, Search, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { AdminModule, UserModuleOverride } from "@shared/schema";

interface UserOverridesProps {
  modules: AdminModule[];
  isLoading: boolean;
}

export function UserOverrides({ modules, isLoading }: UserOverridesProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [newUserId, setNewUserId] = useState<string>("");
  const [selectedModule, setSelectedModule] = useState<string>("");
  const [searchUserId, setSearchUserId] = useState<string>("");

  // Fetch user overrides for selected user
  const { 
    data: userOverrides = [], 
    isLoading: overridesLoading 
  } = useQuery({
    queryKey: ['/api/settings/users', selectedUserId, 'module-overrides'],
    enabled: !!selectedUserId
  });

  // Create user override mutation
  const createOverrideMutation = useMutation({
    mutationFn: async ({ userId, moduleId, enabled }: { userId: string; moduleId: string; enabled: boolean }) => {
      const response = await apiRequest('POST', `/api/settings/users/${userId}/module-overrides`, { moduleId, enabled });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/users', selectedUserId, 'module-overrides'] });
      setNewUserId("");
      setSelectedModule("");
      toast({
        title: "Override Created",
        description: "User module override has been created successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create override: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  });

  // Update user override mutation
  const updateOverrideMutation = useMutation({
    mutationFn: async ({ userId, moduleId, enabled }: { userId: string; moduleId: string; enabled: boolean }) => {
      const response = await apiRequest('PUT', `/api/settings/users/${userId}/module-overrides/${moduleId}`, { enabled });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/users', selectedUserId, 'module-overrides'] });
      toast({
        title: "Override Updated",
        description: "User module override has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update override: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  });

  // Delete user override mutation
  const deleteOverrideMutation = useMutation({
    mutationFn: async ({ userId, moduleId }: { userId: string; moduleId: string }) => {
      const response = await apiRequest('DELETE', `/api/settings/users/${userId}/module-overrides/${moduleId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/users', selectedUserId, 'module-overrides'] });
      toast({
        title: "Override Deleted",
        description: "User module override has been deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete override: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  });

  const getExistingModuleIds = () => {
    return userOverrides.map((override: UserModuleOverride) => override.moduleId);
  };

  const getAvailableModules = () => {
    const existingModuleIds = getExistingModuleIds();
    return modules.filter(module => !existingModuleIds.includes(module.id));
  };

  const handleCreateOverride = () => {
    if (!selectedUserId || !selectedModule) return;
    
    createOverrideMutation.mutate({
      userId: selectedUserId,
      moduleId: selectedModule,
      enabled: true
    });
  };

  const handleSearchUser = () => {
    if (searchUserId.trim()) {
      setSelectedUserId(searchUserId.trim());
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="user-overrides-loading">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="user-overrides">
      {/* User Search */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Find User</CardTitle>
          <CardDescription>
            Enter a user ID to view and manage their module access overrides.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Enter user ID (e.g., user-123)"
                value={searchUserId}
                onChange={(e) => setSearchUserId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchUser()}
                data-testid="input-search-user"
              />
            </div>
            <Button
              onClick={handleSearchUser}
              disabled={!searchUserId.trim()}
              data-testid="button-search-user"
              className="gap-2"
            >
              <Search className="h-4 w-4" />
              Search
            </Button>
          </div>
          {selectedUserId && (
            <div className="mt-4">
              <Alert>
                <User className="h-4 w-4" />
                <AlertDescription>
                  Managing overrides for user: <code className="px-1 py-0.5 bg-muted rounded text-sm">{selectedUserId}</code>
                </AlertDescription>
              </Alert>
            </div>
          )}
        </CardContent>
      </Card>

      {!selectedUserId && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8" data-testid="no-user-selected">
              <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No User Selected</h3>
              <p className="text-muted-foreground">
                Search for a user above to view and manage their module access overrides.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedUserId && (
        <>
          {/* Add New Override */}
          {getAvailableModules().length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Add Module Override</CardTitle>
                <CardDescription>
                  Grant or deny access to a specific module for this user, overriding their role permissions.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <Select value={selectedModule} onValueChange={setSelectedModule} data-testid="select-override-module">
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a module" />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableModules().map((module) => (
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
                  <Button
                    onClick={handleCreateOverride}
                    disabled={!selectedModule || createOverrideMutation.isPending}
                    data-testid="button-add-override"
                    className="gap-2"
                  >
                    <UserPlus className="h-4 w-4" />
                    Add Override
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Current Overrides */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Current Overrides</CardTitle>
              <CardDescription>
                Module access overrides for this user. These settings override role-based permissions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {overridesLoading ? (
                <div className="space-y-3" data-testid="overrides-loading">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-6 w-12" />
                    </div>
                  ))}
                </div>
              ) : userOverrides.length === 0 ? (
                <div className="text-center py-8" data-testid="no-overrides">
                  <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Overrides Set</h3>
                  <p className="text-muted-foreground">
                    This user has no module access overrides. Their access is determined by role permissions only.
                  </p>
                </div>
              ) : (
                <div className="space-y-3" data-testid="overrides-list">
                  {userOverrides.map((override: UserModuleOverride) => {
                    const module = modules.find(m => m.id === override.moduleId);
                    return (
                      <div 
                        key={override.id} 
                        className="flex items-center justify-between p-4 border rounded-lg"
                        data-testid={`override-${override.moduleId}`}
                      >
                        <div>
                          <div className="font-medium" data-testid={`override-module-${override.moduleId}`}>
                            {module?.displayName || override.moduleId}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {module?.description || "Module description not available"}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge 
                            variant={override.enabled ? "default" : "secondary"}
                            data-testid={`override-status-${override.moduleId}`}
                          >
                            {override.enabled ? "Allowed" : "Denied"}
                          </Badge>
                          <Switch
                            checked={override.enabled}
                            onCheckedChange={(enabled) => {
                              updateOverrideMutation.mutate({
                                userId: selectedUserId,
                                moduleId: override.moduleId,
                                enabled
                              });
                            }}
                            disabled={updateOverrideMutation.isPending}
                            data-testid={`switch-override-${override.moduleId}`}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              deleteOverrideMutation.mutate({
                                userId: selectedUserId,
                                moduleId: override.moduleId
                              });
                            }}
                            disabled={deleteOverrideMutation.isPending}
                            data-testid={`button-delete-override-${override.moduleId}`}
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

          {getAvailableModules().length === 0 && userOverrides.length > 0 && (
            <Alert>
              <AlertDescription>
                This user has overrides for all available modules. You can modify existing overrides above.
              </AlertDescription>
            </Alert>
          )}
        </>
      )}
    </div>
  );
}