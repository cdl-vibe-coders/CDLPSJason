import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Settings, Edit, MoreVertical } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import type { AdminModule } from "@shared/schema";

interface ModuleListProps {
  modules: AdminModule[];
  isLoading: boolean;
}

export function ModuleList({ modules, isLoading }: ModuleListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const toggleModuleMutation = useMutation({
    mutationFn: async ({ moduleId, isActive }: { moduleId: string; isActive: boolean }) => {
      const response = await apiRequest('PUT', `/api/settings/modules/${moduleId}/toggle`, { isActive });
      return response.json();
    },
    onSuccess: (_, { isActive }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/modules'] });
      toast({
        title: `Module ${isActive ? 'Enabled' : 'Disabled'}`,
        description: `The module has been ${isActive ? 'enabled' : 'disabled'} successfully.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to toggle module: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="module-list-loading">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-48" />
                </div>
                <Skeleton className="h-6 w-12" />
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    );
  }

  if (modules.length === 0) {
    return (
      <div className="text-center py-8" data-testid="module-list-empty">
        <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No Modules Found</h3>
        <p className="text-muted-foreground">
          Create your first module to get started with the modular backend system.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="module-list">
      {modules.map((module) => (
        <Card key={module.id} data-testid={`module-card-${module.id}`}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <CardTitle className="text-lg" data-testid={`module-name-${module.id}`}>
                    {module.displayName}
                  </CardTitle>
                  <Badge 
                    variant={module.isActive ? "default" : "secondary"}
                    data-testid={`module-status-${module.id}`}
                  >
                    {module.isActive ? "Active" : "Disabled"}
                  </Badge>
                  <Badge variant="outline" data-testid={`module-version-${module.id}`}>
                    v{module.version}
                  </Badge>
                </div>
                <CardDescription data-testid={`module-description-${module.id}`}>
                  {module.description || "No description provided"}
                </CardDescription>
                <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                  <span data-testid={`module-created-${module.id}`}>
                    Created {format(new Date(module.createdAt), "MMM d, yyyy")}
                  </span>
                  <span data-testid={`module-updated-${module.id}`}>
                    Updated {format(new Date(module.updatedAt), "MMM d, yyyy")}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {module.isActive ? "Enabled" : "Disabled"}
                  </span>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <div>
                        <Switch
                          checked={module.isActive}
                          disabled={toggleModuleMutation.isPending}
                          data-testid={`switch-module-${module.id}`}
                        />
                      </div>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {module.isActive ? "Disable" : "Enable"} Module
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {module.isActive
                            ? `Disabling "${module.displayName}" will prevent all users from accessing this module. Are you sure you want to continue?`
                            : `Enabling "${module.displayName}" will make it available to users based on their role permissions.`
                          }
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel data-testid={`button-cancel-toggle-${module.id}`}>
                          Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => {
                            toggleModuleMutation.mutate({
                              moduleId: module.id,
                              isActive: !module.isActive
                            });
                          }}
                          data-testid={`button-confirm-toggle-${module.id}`}
                        >
                          {module.isActive ? "Disable" : "Enable"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      data-testid={`button-module-actions-${module.id}`}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem data-testid={`button-edit-module-${module.id}`}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Module
                    </DropdownMenuItem>
                    <DropdownMenuItem data-testid={`button-view-permissions-${module.id}`}>
                      <Settings className="h-4 w-4 mr-2" />
                      View Permissions
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}