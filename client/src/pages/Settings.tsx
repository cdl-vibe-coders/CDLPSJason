import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Settings as SettingsIcon, Users, Shield, Activity, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuthStatus, useIsAdmin, useAuth } from "@/hooks/useAuth";
import { LoginForm } from "@/components/LoginForm";
import { ModuleList } from "../components/settings/ModuleList";
import { RolePermissions } from "../components/settings/RolePermissions";  
import { UserOverrides } from "../components/settings/UserOverrides";
import { CreateModuleForm } from "../components/settings/CreateModuleForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createModuleOpen, setCreateModuleOpen] = useState(false);
  
  // Use proper authentication
  const { user, isLoading: authLoading, isAuthenticated } = useAuthStatus();
  const isAdmin = useIsAdmin();
  const { logout, isLoggingOut } = useAuth();
  
  // Show login form if not authenticated
  if (!isAuthenticated && !authLoading) {
    return <LoginForm />;
  }
  
  // Show loading spinner while checking authentication
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen" data-testid="auth-loading">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }
  
  // Show access denied for non-admin users
  if (!isAdmin) {
    return (
      <div className="container mx-auto p-6 max-w-2xl" data-testid="access-denied">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Shield className="h-6 w-6" />
              Access Denied
            </CardTitle>
            <CardDescription>
              You need administrator privileges to access the system settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  Current user: <strong>{user?.username}</strong> (Role: {user?.role})
                  <br />
                  Required role: <strong>admin</strong>
                </AlertDescription>
              </Alert>
              <Button 
                variant="outline" 
                onClick={() => logout()}
                disabled={isLoggingOut}
                className="w-full"
                data-testid="button-logout"
              >
                {isLoggingOut ? "Signing Out..." : "Sign Out"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fetch all modules using secure authentication
  const { 
    data: modules = [], 
    isLoading: modulesLoading, 
    error: modulesError 
  } = useQuery({
    queryKey: ['/api/settings/modules']
  }) as { data: any[]; isLoading: boolean; error: any; };

  if (modulesError) {
    return (
      <div className="container mx-auto p-6" data-testid="settings-error">
        <Alert className="mb-4">
          <AlertDescription>
            Error loading settings: {modulesError instanceof Error ? modulesError.message : 'Unknown error'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl" data-testid="settings-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3" data-testid="settings-title">
            <SettingsIcon className="h-8 w-8" />
            System Settings
          </h1>
          <p className="text-muted-foreground mt-2" data-testid="settings-description">
            Manage modules, permissions, and user access controls for your modular backend system.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Logged in as: <strong>{user?.username}</strong> ({user?.role})
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => logout()}
            disabled={isLoggingOut}
            className="gap-2"
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4" />
            {isLoggingOut ? "Signing Out..." : "Sign Out"}
          </Button>
        
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
                  queryClient.invalidateQueries({ queryKey: ['/api/settings/modules'] });
                  toast({
                    title: "Module Created",
                    description: "The new module has been created successfully.",
                  });
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card data-testid="card-total-modules">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Modules</CardTitle>
            <SettingsIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-modules">
              {modulesLoading ? <Skeleton className="h-8 w-16" /> : modules.length}
            </div>
            <p className="text-xs text-muted-foreground">
              System components
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-active-modules">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Modules</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-modules">
              {modulesLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                modules.filter((m: any) => m.isActive).length
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Currently enabled
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-user-roles">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">User Roles</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-user-roles">3</div>
            <p className="text-xs text-muted-foreground">
              Admin, User, Guest
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-permissions">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Permissions</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-permissions">
              {modulesLoading ? <Skeleton className="h-8 w-16" /> : modules.length * 3}
            </div>
            <p className="text-xs text-muted-foreground">
              Role-module pairs
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="modules" className="space-y-6" data-testid="settings-tabs">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="modules" data-testid="tab-modules">
            <SettingsIcon className="h-4 w-4 mr-2" />
            Modules
          </TabsTrigger>
          <TabsTrigger value="permissions" data-testid="tab-permissions">
            <Shield className="h-4 w-4 mr-2" />
            Role Permissions
          </TabsTrigger>
          <TabsTrigger value="overrides" data-testid="tab-overrides">
            <Users className="h-4 w-4 mr-2" />
            User Overrides
          </TabsTrigger>
          <TabsTrigger value="logs" data-testid="tab-logs">
            <Activity className="h-4 w-4 mr-2" />
            Activity Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="modules" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Module Management</CardTitle>
              <CardDescription>
                Control which modules are available system-wide. Disabled modules cannot be accessed by any user.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ModuleList modules={modules} isLoading={modulesLoading} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Role-Based Permissions</CardTitle>
              <CardDescription>
                Define which user roles can access each module. These permissions apply to all users with the specified role.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RolePermissions modules={modules} isLoading={modulesLoading} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overrides" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>User-Specific Overrides</CardTitle>
              <CardDescription>
                Grant or deny access to specific modules for individual users, overriding their role-based permissions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UserOverrides modules={modules} isLoading={modulesLoading} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>System Activity Logs</CardTitle>
              <CardDescription>
                Track all changes to modules, permissions, and user access overrides.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8" data-testid="logs-placeholder">
                <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Activity Logs</h3>
                <p className="text-muted-foreground">
                  Detailed activity logs will be displayed here, showing all administrative actions and system changes.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}