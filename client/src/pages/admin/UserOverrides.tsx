import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Users, 
  Shield, 
  Search,
  Plus,
  Edit,
  Trash2,
  AlertTriangle,
  CheckCircle,
  X,
  UserPlus
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface User {
  id: string;
  username: string;
  email: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
}

interface UserOverride {
  id: string;
  userId: string;
  moduleId: string;
  moduleName: string;
  moduleDisplayName: string;
  canAccess: boolean | null;
  canCreate: boolean | null;
  canUpdate: boolean | null;
  canDelete: boolean | null;
  createdAt: string;
  updatedAt: string;
  user: {
    username: string;
    role: string;
  };
}

interface Module {
  id: string;
  name: string;
  displayName: string;
  isActive: boolean;
}

export default function UserOverrides() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedModule, setSelectedModule] = useState<string>('');
  const [createOverrideOpen, setCreateOverrideOpen] = useState(false);

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['/api/admin/users'],
  });

  const { data: modules = [], isLoading: modulesLoading } = useQuery<Module[]>({
    queryKey: ['/api/admin/modules'],
  });

  const { data: overrides = [], isLoading: overridesLoading } = useQuery<UserOverride[]>({
    queryKey: ['/api/admin/user-overrides'],
  });

  const createOverrideMutation = useMutation({
    mutationFn: async (data: {
      userId: string;
      moduleId: string;
      canAccess: boolean | null;
      canCreate: boolean | null;
      canUpdate: boolean | null;
      canDelete: boolean | null;
    }) => {
      const response = await fetch('/api/admin/user-overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create user override');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/user-overrides'] });
      setCreateOverrideOpen(false);
      setSelectedUser('');
      setSelectedModule('');
      toast({
        title: "Override Created",
        description: "User override has been created successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create user override. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateOverrideMutation = useMutation({
    mutationFn: async ({ 
      overrideId, 
      permissionType, 
      value 
    }: { 
      overrideId: string; 
      permissionType: string; 
      value: boolean | null; 
    }) => {
      const response = await fetch(`/api/admin/user-overrides/${overrideId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [permissionType]: value }),
      });
      if (!response.ok) throw new Error('Failed to update user override');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/user-overrides'] });
      toast({
        title: "Override Updated",
        description: "User override has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update user override. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteOverrideMutation = useMutation({
    mutationFn: async (overrideId: string) => {
      const response = await fetch(`/api/admin/user-overrides/${overrideId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete user override');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/user-overrides'] });
      toast({
        title: "Override Deleted",
        description: "User override has been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete user override. Please try again.",
        variant: "destructive",
      });
    },
  });

  const isLoading = usersLoading || modulesLoading || overridesLoading;

  const filteredOverrides = overrides.filter(override =>
    override.user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    override.moduleDisplayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getPermissionIcon = (value: boolean | null) => {
    if (value === null) return <X className="h-4 w-4 text-gray-400" />;
    return value ? <CheckCircle className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-red-500" />;
  };

  return (
    <div className="space-y-6" data-testid="user-overrides">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">User Overrides</h2>
          <p className="text-muted-foreground">
            Manage individual user access overrides for specific modules
          </p>
        </div>

        <Dialog open={createOverrideOpen} onOpenChange={setCreateOverrideOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-override" className="gap-2">
              <UserPlus className="h-4 w-4" />
              Create Override
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create User Override</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="user-select">User</Label>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger id="user-select" data-testid="select-user">
                    <SelectValue placeholder="Select a user" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.username} ({user.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="module-select">Module</Label>
                <Select value={selectedModule} onValueChange={setSelectedModule}>
                  <SelectTrigger id="module-select" data-testid="select-module">
                    <SelectValue placeholder="Select a module" />
                  </SelectTrigger>
                  <SelectContent>
                    {modules.map((module) => (
                      <SelectItem key={module.id} value={module.id}>
                        {module.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={() => setCreateOverrideOpen(false)}
                  variant="outline"
                  className="flex-1"
                  data-testid="button-cancel-override"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => createOverrideMutation.mutate({
                    userId: selectedUser,
                    moduleId: selectedModule,
                    canAccess: true,
                    canCreate: null,
                    canUpdate: null,
                    canDelete: null,
                  })}
                  disabled={!selectedUser || !selectedModule || createOverrideMutation.isPending}
                  className="flex-1"
                  data-testid="button-confirm-override"
                >
                  {createOverrideMutation.isPending ? "Creating..." : "Create"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card data-testid="card-total-overrides">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Overrides</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-overrides">
              {isLoading ? <Skeleton className="h-8 w-16" /> : overrides.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Active user overrides
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-users-with-overrides">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Users with Overrides</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-users-with-overrides">
              {isLoading ? <Skeleton className="h-8 w-16" /> : new Set(overrides.map(o => o.userId)).size}
            </div>
            <p className="text-xs text-muted-foreground">
              Unique users affected
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-modules-with-overrides">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Modules with Overrides</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-modules-with-overrides">
              {isLoading ? <Skeleton className="h-8 w-16" /> : new Set(overrides.map(o => o.moduleId)).size}
            </div>
            <p className="text-xs text-muted-foreground">
              Modules affected
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-access-grants">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Access Grants</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-access-grants">
              {isLoading ? <Skeleton className="h-8 w-16" /> : overrides.filter(o => o.canAccess === true).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Special access granted
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Overrides List */}
      <Card data-testid="card-overrides-list">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            User Access Overrides
          </CardTitle>
          <CardDescription>
            Individual user permissions that override default role permissions
          </CardDescription>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by username or module..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-overrides"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-6 w-6" />
                    <Skeleton className="h-6 w-6" />
                    <Skeleton className="h-6 w-6" />
                    <Skeleton className="h-6 w-6" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredOverrides.length === 0 ? (
            <div className="text-center py-12" data-testid="no-overrides">
              <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No user overrides found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery 
                  ? "No overrides match your search criteria" 
                  : "Create user-specific permissions to override role defaults"
                }
              </p>
              {!searchQuery && (
                <Dialog open={createOverrideOpen} onOpenChange={setCreateOverrideOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-create-first-override">
                      <Plus className="h-4 w-4 mr-2" />
                      Create First Override
                    </Button>
                  </DialogTrigger>
                </Dialog>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Table Header */}
              <div className="grid grid-cols-7 gap-4 pb-2 border-b font-medium text-sm">
                <div className="col-span-2">User / Module</div>
                <div className="text-center">Access</div>
                <div className="text-center">Create</div>
                <div className="text-center">Update</div>
                <div className="text-center">Delete</div>
                <div className="text-center">Actions</div>
              </div>

              {filteredOverrides.map((override) => (
                <div 
                  key={override.id} 
                  className="grid grid-cols-7 gap-4 p-3 border rounded-lg hover-elevate"
                  data-testid={`override-row-${override.id}`}
                >
                  <div className="col-span-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium" data-testid={`override-user-${override.id}`}>
                          {override.user.username}
                        </span>
                        <Badge variant="outline">
                          {override.user.role}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 ml-6">
                        <Shield className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground" data-testid={`override-module-${override.id}`}>
                          {override.moduleDisplayName}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-center">
                    {getPermissionIcon(override.canAccess)}
                  </div>
                  
                  <div className="flex justify-center">
                    {getPermissionIcon(override.canCreate)}
                  </div>
                  
                  <div className="flex justify-center">
                    {getPermissionIcon(override.canUpdate)}
                  </div>
                  
                  <div className="flex justify-center">
                    {getPermissionIcon(override.canDelete)}
                  </div>
                  
                  <div className="flex justify-center gap-1">
                    <Button 
                      variant="outline" 
                      size="sm"
                      data-testid={`button-edit-override-${override.id}`}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => deleteOverrideMutation.mutate(override.id)}
                      disabled={deleteOverrideMutation.isPending}
                      data-testid={`button-delete-override-${override.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
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