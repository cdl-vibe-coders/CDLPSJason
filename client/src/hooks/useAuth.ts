import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "./use-toast";

export interface User {
  id: string;
  username: string;
  email?: string;
  role: string;
  isActive: boolean;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterCredentials {
  username: string;
  email?: string;
  password: string;
  confirmPassword: string;
  role?: string;
}

export interface AuthResponse {
  success: boolean;
  user: User;
  sessionToken?: string;
}

export interface UserModulesResponse {
  modules: any[];
  user: {
    id: string;
    username: string;
    role: string;
  };
}

// Hook for getting current authenticated user
export function useCurrentUser() {
  return useQuery({
    queryKey: ['/api/auth/me'],
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook for getting user's accessible modules
export function useUserModules() {
  return useQuery({
    queryKey: ['/api/me/modules'],
    retry: false,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Hook for authentication actions
export function useAuth() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginCredentials): Promise<AuthResponse> => {
      const response = await apiRequest("POST", "/api/auth/login", credentials);
      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate auth-related queries to refetch user data
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      queryClient.invalidateQueries({ queryKey: ['/api/me/modules'] });
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      
      toast({
        title: "Login Successful",
        description: `Welcome back, ${data.user.username}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Login Failed",
        description: error.message || "Please check your credentials and try again.",
        variant: "destructive",
      });
    },
  });

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: async (credentials: RegisterCredentials): Promise<AuthResponse> => {
      const response = await apiRequest("POST", "/api/auth/register", credentials);
      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate auth-related queries to refetch user data
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      queryClient.invalidateQueries({ queryKey: ['/api/me/modules'] });
      
      toast({
        title: "Registration Successful",
        description: `Welcome to the system, ${data.user.username}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Registration Failed",
        description: error.message || "Please check your information and try again.",
        variant: "destructive",
      });
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async (): Promise<{ success: boolean; message: string }> => {
      const response = await apiRequest("POST", "/api/auth/logout", {});
      return response.json();
    },
    onSuccess: () => {
      // Clear all cached data
      queryClient.clear();
      
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
      });
    },
    onError: (error: Error) => {
      console.error("Logout error:", error);
      // Even if logout fails on server, clear local cache
      queryClient.clear();
      
      toast({
        title: "Logout Error",
        description: "There was an issue logging out, but you've been signed out locally.",
        variant: "destructive",
      });
    },
  });

  // Refresh session mutation
  const refreshMutation = useMutation({
    mutationFn: async (): Promise<{ success: boolean; sessionToken: string }> => {
      const response = await apiRequest("POST", "/api/auth/refresh", {});
      return response.json();
    },
    onSuccess: () => {
      // Optionally invalidate auth queries to get fresh data
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    },
    onError: (error: Error) => {
      console.error("Session refresh error:", error);
      // If refresh fails, user might need to login again
      queryClient.clear();
    },
  });

  return {
    // Mutations
    login: loginMutation.mutate,
    register: registerMutation.mutate,
    logout: logoutMutation.mutate,
    refreshSession: refreshMutation.mutate,
    
    // Loading states
    isLoggingIn: loginMutation.isPending,
    isRegistering: registerMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
    isRefreshing: refreshMutation.isPending,
    
    // Error states
    loginError: loginMutation.error,
    registerError: registerMutation.error,
    logoutError: logoutMutation.error,
    refreshError: refreshMutation.error,
  };
}

// Helper function to check if user has specific role
export function useHasRole(requiredRole: string): boolean {
  const { data: currentUser } = useCurrentUser();
  return currentUser?.user?.role === requiredRole;
}

// Helper function to check if user is admin
export function useIsAdmin(): boolean {
  return useHasRole('admin');
}

// Helper function to check if user is authenticated
export function useIsAuthenticated(): boolean {
  const { data: currentUser, isLoading, error } = useCurrentUser();
  
  // If still loading, assume not authenticated to be safe
  if (isLoading) return false;
  
  // If there's an error (like 401), user is not authenticated
  if (error) return false;
  
  // If we have user data, they're authenticated
  return !!currentUser?.user;
}

// Hook for getting authentication status with loading state
export function useAuthStatus() {
  const { data: currentUser, isLoading, error } = useCurrentUser();
  
  return {
    user: currentUser?.user || null,
    isLoading,
    isAuthenticated: !!currentUser?.user && !error,
    error: error?.message || null,
  };
}