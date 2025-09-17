import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Shield, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getModule } from "@/modules";
import { useAuthStatus, useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Settings from "@/pages/Settings";

interface ModuleLayoutProps {
  moduleId: string;
  subpage?: string;
}

// Type for the navigation endpoint response
interface VisibleModule {
  id: string;
  name: string;
  displayName: string;
  defaultPath: string;
  isActive: boolean;
}

export function ModuleLayout({ moduleId, subpage }: ModuleLayoutProps) {
  const { user, isAuthenticated } = useAuthStatus();
  const { logout, isLoggingOut } = useAuth();
  const moduleInfo = getModule(moduleId);
  
  // Query user's visible modules for access control
  const {
    data: visibleModules = [],
    isLoading: isLoadingAccess,
    error: accessError
  } = useQuery<VisibleModule[]>({
    queryKey: ['/api/navigation/visible-modules'],
    enabled: isAuthenticated && !!user // Only fetch if user is authenticated
  });

  // If module doesn't exist in registry, show 404
  if (!moduleInfo) {
    return <NotFound />;
  }

  // Show loading state while checking access
  if (isLoadingAccess) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-testid="access-loading">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground text-sm">Checking access permissions...</p>
        </div>
      </div>
    );
  }

  // Show error if we can't check access
  if (accessError) {
    return (
      <div className="p-6" data-testid="access-error">
        <div className="max-w-2xl mx-auto">
          <Alert className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Error checking module access permissions. Please try again or contact support.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  // Check if user has access to this module
  const hasAccess = visibleModules.some(module => module.name === moduleId);
  
  // Show Access Denied if user doesn't have permission
  if (!hasAccess) {
    return <AccessDeniedPage moduleInfo={moduleInfo} user={user} logout={logout} isLoggingOut={isLoggingOut} />;
  }

  // If we have a subpage, render the subpage layout
  if (subpage) {
    return <ModuleSubPageLayout moduleInfo={moduleInfo} subpage={subpage} />;
  }

  // Otherwise render the main module layout
  return <ModuleMainLayout moduleInfo={moduleInfo} />;
}

// Access Denied component
function AccessDeniedPage({ 
  moduleInfo, 
  user, 
  logout, 
  isLoggingOut 
}: { 
  moduleInfo: any; 
  user: any; 
  logout: () => void; 
  isLoggingOut: boolean; 
}) {
  return (
    <div className="p-6" data-testid={`access-denied-${moduleInfo.name}`}>
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Shield className="h-6 w-6" />
              Access Denied
            </CardTitle>
            <CardDescription>
              You don't have permission to access the {moduleInfo.displayName} module.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                <div className="space-y-2">
                  <p>
                    <strong>Current user:</strong> {user?.username} (Role: {user?.role})
                  </p>
                  <p>
                    <strong>Requested module:</strong> {moduleInfo.displayName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Access to this module is controlled by your role permissions and any user-specific overrides set by administrators.
                  </p>
                </div>
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                If you believe you should have access to this module, please contact your system administrator.
              </p>
              
              <div className="flex gap-3">
                <Link href="/" className="inline-block">
                  <Button variant="outline" data-testid="button-back-home">
                    Back to Home
                  </Button>
                </Link>
                
                <Button 
                  variant="outline" 
                  onClick={() => logout()}
                  disabled={isLoggingOut}
                  data-testid="button-logout-access-denied"
                >
                  {isLoggingOut ? "Signing Out..." : "Sign Out"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Main module layout - shows overview and available subpages
function ModuleMainLayout({ moduleInfo }: { moduleInfo: any }) {
  return (
    <div className="p-6" data-testid={`module-main-${moduleInfo.name}`}>
      <div className="max-w-4xl mx-auto">
        {/* Module Header */}
        <div className="flex items-center gap-3 mb-6">
          <moduleInfo.icon className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">{moduleInfo.displayName}</h1>
            <p className="text-muted-foreground">{moduleInfo.description}</p>
          </div>
        </div>
        
        {/* Module Content */}
        <div className="space-y-6">
          {/* Show subpages as navigation cards if available */}
          {moduleInfo.subpages && moduleInfo.subpages.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Available Features</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {moduleInfo.subpages.map((subpage: any) => (
                  <Link 
                    key={subpage.path}
                    href={`${moduleInfo.defaultPath}${subpage.path}`}
                    className="hover-elevate block p-4 rounded-lg border bg-card"
                    data-testid={`link-subpage-${moduleInfo.name}${subpage.path.replace('/', '-')}`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      {subpage.icon && <subpage.icon className="h-5 w-5 text-primary" />}
                      <h3 className="font-semibold">{subpage.displayName}</h3>
                    </div>
                    {subpage.description && (
                      <p className="text-sm text-muted-foreground">{subpage.description}</p>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}
          
          {/* Module-specific main content */}
          <ModuleMainContent moduleInfo={moduleInfo} />
        </div>
      </div>
    </div>
  );
}

// Subpage layout - shows specific module subpage
function ModuleSubPageLayout({ moduleInfo, subpage }: { moduleInfo: any; subpage: string }) {
  const subpageInfo = moduleInfo.subpages?.find((p: any) => p.path === `/${subpage}`);
  
  // If subpage doesn't exist, show subpage not found
  if (!subpageInfo) {
    return (
      <div className="p-6" data-testid={`subpage-not-found-${moduleInfo.name}-${subpage}`}>
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-4">Page Not Found</h1>
          <p className="text-muted-foreground mb-4">
            The subpage "/{subpage}" was not found in the {moduleInfo.displayName} module.
          </p>
          <Link 
            href={moduleInfo.defaultPath} 
            className="inline-flex items-center text-primary hover:underline"
            data-testid={`link-back-to-${moduleInfo.name}`}
          >
            ← Back to {moduleInfo.displayName}
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-6" data-testid={`subpage-${moduleInfo.name}-${subpage}`}>
      <div className="max-w-4xl mx-auto">
        {/* Subpage Header */}
        <div className="flex items-center gap-3 mb-6">
          {subpageInfo.icon && <subpageInfo.icon className="h-6 w-6 text-primary" />}
          <div>
            <h1 className="text-2xl font-bold">{subpageInfo.displayName}</h1>
            {subpageInfo.description && (
              <p className="text-muted-foreground">{subpageInfo.description}</p>
            )}
          </div>
        </div>
        
        {/* Subpage Content */}
        <div className="space-y-6">
          <ModuleSubPageContent moduleInfo={moduleInfo} subpage={subpage} subpageInfo={subpageInfo} />
        </div>
        
        {/* Back Navigation */}
        <div className="mt-6 pt-4 border-t">
          <Link 
            href={moduleInfo.defaultPath} 
            className="inline-flex items-center text-primary hover:underline text-sm"
            data-testid={`link-back-to-${moduleInfo.name}-main`}
          >
            ← Back to {moduleInfo.displayName}
          </Link>
        </div>
      </div>
    </div>
  );
}

// Module-specific main content renderer
function ModuleMainContent({ moduleInfo }: { moduleInfo: any }) {
  switch (moduleInfo.name) {
    case 'admin':
      return (
        <div className="bg-card border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">System Administration</h2>
          <Settings />
        </div>
      );
      
    case 'users':
      return (
        <div className="bg-card border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">User Management</h2>
          <p className="text-muted-foreground">
            Manage user accounts, profiles, and preferences. Use the navigation above to access specific features.
          </p>
        </div>
      );
      
    default:
      return (
        <div className="bg-card border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-2">
            {moduleInfo.displayName}
          </h2>
          <p className="text-muted-foreground">
            Welcome to the {moduleInfo.displayName} module. 
            {moduleInfo.subpages && moduleInfo.subpages.length > 0
              ? " Use the navigation above to access specific features."
              : " This module is ready for use."
            }
          </p>
        </div>
      );
  }
}

// Module-specific subpage content renderer
function ModuleSubPageContent({ 
  moduleInfo, 
  subpage, 
  subpageInfo 
}: { 
  moduleInfo: any; 
  subpage: string; 
  subpageInfo: any; 
}) {
  // For admin module, show the settings component
  if (moduleInfo.name === 'admin') {
    return (
      <div className="bg-card border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">
          {subpageInfo.displayName}
        </h2>
        <Settings />
      </div>
    );
  }
  
  // For other modules, show placeholder content
  return (
    <div className="bg-card border rounded-lg p-6">
      <h2 className="text-lg font-semibold mb-2">
        {subpageInfo.displayName}
      </h2>
      <p className="text-muted-foreground mb-4">
        This is the {subpageInfo.displayName} page in the {moduleInfo.displayName} module.
      </p>
      
      {/* Placeholder content based on subpage type */}
      {subpage === 'dashboard' && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="bg-muted/50 rounded-lg p-4">
              <h3 className="font-medium mb-2">System Status</h3>
              <p className="text-sm text-muted-foreground">All systems operational</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <h3 className="font-medium mb-2">Recent Activity</h3>
              <p className="text-sm text-muted-foreground">No recent activity</p>
            </div>
          </div>
        </div>
      )}
      
      {subpage === 'profile' && (
        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4">
            <h3 className="font-medium mb-2">Profile Information</h3>
            <p className="text-sm text-muted-foreground">Manage your personal information and settings</p>
          </div>
        </div>
      )}
      
      {/* Generic placeholder for other subpages */}
      {!['dashboard', 'profile'].includes(subpage) && (
        <div className="bg-muted/50 rounded-lg p-4">
          <p className="text-sm text-muted-foreground">
            Content for {subpageInfo.displayName} will be implemented here.
          </p>
        </div>
      )}
    </div>
  );
}