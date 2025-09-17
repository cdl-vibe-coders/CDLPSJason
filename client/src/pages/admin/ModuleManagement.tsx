import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { 
  Database, 
  Settings, 
  Plus, 
  Eye, 
  Edit, 
  Trash2, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  Activity
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CreateModuleForm } from "@/components/settings/CreateModuleForm";

interface Module {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  version: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  stats?: {
    userCount: number;
    lastActivity: string | null;
    deploymentStatus: 'active' | 'inactive' | 'error';
  };
}

export default function ModuleManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createModuleOpen, setCreateModuleOpen] = useState(false);

  const { data: modules = [], isLoading, error } = useQuery<Module[]>({
    queryKey: ['/api/admin/modules'],
  });

  const toggleModuleMutation = useMutation({
    mutationFn: async ({ moduleId, isActive }: { moduleId: string; isActive: boolean }) => {
      const response = await fetch(`/api/admin/modules/${moduleId}/toggle`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      if (!response.ok) throw new Error('Failed to toggle module status');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/modules'] });
      toast({
        title: "Module Status Updated",
        description: "The module status has been changed successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update module status. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (error) {
    return (
      <div className="space-y-6" data-testid="module-management-error">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Failed to load modules. Please refresh the page or contact support.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="module-management">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Module Management</h2>
          <p className="text-muted-foreground">
            Create, configure, and manage system modules
          </p>
        </div>
        
        <Dialog open={createModuleOpen} onOpenChange={setCreateModuleOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-module" className="gap-2">
              <Plus className="h-4 w-4" />
              Create Module
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Module</DialogTitle>
            </DialogHeader>
            <CreateModuleForm 
              onSuccess={() => {
                setCreateModuleOpen(false);
                queryClient.invalidateQueries({ queryKey: ['/api/admin/modules'] });
                toast({
                  title: "Module Created",
                  description: "The new module has been created successfully.",
                });
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card data-testid="card-total-modules">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Modules</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-modules-total">
              {isLoading ? <Skeleton className="h-8 w-16" /> : modules.length}
            </div>
            <p className="text-xs text-muted-foreground">
              System components
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-active-modules">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Modules</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-modules-active">
              {isLoading ? <Skeleton className="h-8 w-16" /> : modules.filter(m => m.isActive).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Currently running
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-inactive-modules">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive Modules</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-modules-inactive">
              {isLoading ? <Skeleton className="h-8 w-16" /> : modules.filter(m => !m.isActive).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Stopped or paused
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-module-versions">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Latest Version</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-latest-version">
              {isLoading ? <Skeleton className="h-8 w-16" /> : "v1.0"}
            </div>
            <p className="text-xs text-muted-foreground">
              System version
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Modules List */}
      <Card data-testid="card-modules-list">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            All Modules
          </CardTitle>
          <CardDescription>
            Manage your system modules and their configurations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-96" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-8 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : modules.length === 0 ? (
            <div className="text-center py-12" data-testid="no-modules">
              <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No modules found</h3>
              <p className="text-muted-foreground mb-4">
                Get started by creating your first module
              </p>
              <Dialog open={createModuleOpen} onOpenChange={setCreateModuleOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-create-first-module">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Module
                  </Button>
                </DialogTrigger>
              </Dialog>
            </div>
          ) : (
            <div className="space-y-4">
              {modules.map((module) => (
                <div 
                  key={module.id} 
                  className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                  data-testid={`module-item-${module.name}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold" data-testid={`module-name-${module.name}`}>
                        {module.displayName}
                      </h3>
                      <Badge 
                        variant={module.isActive ? "default" : "secondary"}
                        data-testid={`module-status-${module.name}`}
                      >
                        {module.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <Badge variant="outline" data-testid={`module-version-${module.name}`}>
                        {module.version}
                      </Badge>
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-2" data-testid={`module-description-${module.name}`}>
                      {module.description || "No description available"}
                    </p>
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span data-testid={`module-created-${module.name}`}>
                        Created: {new Date(module.createdAt).toLocaleDateString()}
                      </span>
                      {module.stats && (
                        <>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {module.stats.userCount} users
                          </span>
                          {module.stats.lastActivity && (
                            <span className="flex items-center gap-1">
                              <Activity className="h-3 w-3" />
                              Last activity: {new Date(module.stats.lastActivity).toLocaleDateString()}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <label htmlFor={`toggle-${module.id}`} className="text-sm font-medium">
                        {module.isActive ? "Active" : "Inactive"}
                      </label>
                      <Switch
                        id={`toggle-${module.id}`}
                        checked={module.isActive}
                        onCheckedChange={(checked) => 
                          toggleModuleMutation.mutate({ moduleId: module.id, isActive: checked })
                        }
                        disabled={toggleModuleMutation.isPending}
                        data-testid={`toggle-module-${module.name}`}
                      />
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="outline" 
                        size="sm"
                        data-testid={`button-view-${module.name}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        data-testid={`button-edit-${module.name}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}