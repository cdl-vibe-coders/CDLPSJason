import { Switch, Route, Link } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuthStatus } from "@/hooks/useAuth";
import { LoginForm } from "@/components/LoginForm";
import { ModuleLayout } from "@/components/ModuleLayout";
import NotFound from "@/pages/not-found";
import Settings from "@/pages/Settings";

// Component to handle module routing
function ModuleRouter() {
  return (
    <Switch>
      {/* Root welcome page */}
      <Route path="/" component={() => (
        <div className="p-6" data-testid="page-home">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-3xl font-bold mb-4">Welcome to Modular Backend System</h1>
            <p className="text-muted-foreground mb-6">
              Use the sidebar to navigate between available modules based on your role permissions.
            </p>
          </div>
        </div>
      )} />
      
      {/* Legacy Settings route for backward compatibility */}
      <Route path="/settings" component={Settings} />
      
      {/* Dynamic module routing - /:moduleId */}
      <Route path="/:moduleId">
        {(params) => <ModuleLayout moduleId={params.moduleId} />}
      </Route>
      
      {/* Dynamic module subpage routing - /:moduleId/:subpage* */}
      <Route path="/:moduleId/:subpage*">
        {(params) => (
          <ModuleLayout 
            moduleId={params.moduleId} 
            subpage={params.subpage} 
          />
        )}
      </Route>
      
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function AppShell() {
  const { isAuthenticated, isLoading } = useAuthStatus();
  
  // Show login form if not authenticated
  if (!isAuthenticated && !isLoading) {
    return <LoginForm />;
  }
  
  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen" data-testid="auth-loading">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Custom sidebar width for modular backend management 
  const style = {
    "--sidebar-width": "18rem",       // 288px for module navigation
    "--sidebar-width-icon": "4rem",   // default icon width
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1">
          <header className="flex items-center justify-between p-2 border-b" data-testid="header-main">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <h1 className="text-sm font-medium text-muted-foreground">
                Modular Backend System
              </h1>
            </div>
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-hidden" data-testid="main-content">
            <ModuleRouter />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <AppShell />
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
