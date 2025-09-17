import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Settings, LogOut, User } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarSeparator
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuthStatus, useAuth } from "@/hooks/useAuth";
import { moduleRegistry, getModule } from "@/modules";

// Type for the navigation endpoint response
interface VisibleModule {
  id: string;
  name: string;
  displayName: string;
  defaultPath: string;
  isActive: boolean;
}

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuthStatus();
  const { logout, isLoggingOut } = useAuth();

  // Query visible modules for the current user
  const {
    data: visibleModules = [],
    isLoading,
    error
  } = useQuery<VisibleModule[]>({
    queryKey: ['/api/navigation/visible-modules'],
    enabled: !!user // Only fetch if user is authenticated
  });

  // Get current active module based on location
  const currentModuleName = location.split('/')[1] || '';
  const currentModule = getModule(currentModuleName);

  return (
    <Sidebar data-testid="app-sidebar">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2" data-testid="sidebar-header">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Settings className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Modular Backend</span>
            <span className="text-xs text-muted-foreground">Management System</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel data-testid="label-modules">Available Modules</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {isLoading ? (
                // Loading skeletons while fetching modules
                Array.from({ length: 2 }).map((_, index) => (
                  <SidebarMenuItem key={index}>
                    <SidebarMenuSkeleton data-testid={`skeleton-module-${index}`} />
                  </SidebarMenuItem>
                ))
              ) : error ? (
                // Error state
                <SidebarMenuItem>
                  <div 
                    className="flex items-center gap-2 px-2 py-1 text-sm text-destructive" 
                    data-testid="error-modules"
                  >
                    <Settings className="h-4 w-4" />
                    Failed to load modules
                  </div>
                </SidebarMenuItem>
              ) : (
                // Render visible modules
                visibleModules.map((module) => {
                  const moduleInfo = getModule(module.name);
                  const Icon = moduleInfo?.icon || Settings;
                  const isActive = currentModuleName === module.name;
                  
                  return (
                    <SidebarMenuItem key={module.id}>
                      <SidebarMenuButton 
                        asChild 
                        isActive={isActive}
                        data-testid={`nav-module-${module.name}`}
                      >
                        <Link href={module.defaultPath}>
                          <Icon className="h-4 w-4" />
                          <span>{module.displayName}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/* Module Subpages - Show only if we have an active module with subpages */}
        {currentModule && currentModule.subpages && currentModule.subpages.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel data-testid={`label-subpages-${currentModule.name}`}>
              {currentModule.displayName}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {currentModule.subpages.map((subpage) => {
                  const SubIcon = subpage.icon || Settings;
                  const isActive = location === `${currentModule.defaultPath}${subpage.path}`;
                  
                  return (
                    <SidebarMenuItem key={subpage.path}>
                      <SidebarMenuButton 
                        asChild 
                        isActive={isActive}
                        data-testid={`nav-subpage-${currentModule.name}${subpage.path.replace('/', '-')}`}
                      >
                        <Link href={`${currentModule.defaultPath}${subpage.path}`}>
                          <SubIcon className="h-4 w-4" />
                          <span>{subpage.displayName}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {/* User Profile */}
          {user && (
            <SidebarMenuItem>
              <SidebarMenuButton 
                size="lg" 
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                data-testid="user-profile"
              >
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarFallback className="rounded-lg">
                    {user.username.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{user.username}</span>
                  <span className="truncate text-xs capitalize">{user.role}</span>
                </div>
                <User className="ml-auto size-4" />
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          
          {/* Logout Button */}
          <SidebarMenuItem>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logout()}
              disabled={isLoggingOut}
              className="w-full justify-start gap-2"
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4" />
              {isLoggingOut ? "Signing Out..." : "Sign Out"}
            </Button>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}