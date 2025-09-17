import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, LogIn, UserPlus } from "lucide-react";
import { useAuth, type LoginCredentials, type RegisterCredentials } from "@/hooks/useAuth";

interface LoginFormProps {
  onSuccess?: () => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [credentials, setCredentials] = useState<LoginCredentials>({
    username: "",
    password: "",
  });
  const [registerData, setRegisterData] = useState<RegisterCredentials>({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "user",
  });

  const { login, register, isLoggingIn, isRegistering, loginError, registerError } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    login(credentials, {
      onSuccess: () => {
        onSuccess?.();
      },
    });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    register(registerData, {
      onSuccess: () => {
        onSuccess?.();
      },
    });
  };

  const toggleMode = () => {
    setIsLoginMode(!isLoginMode);
    // Clear any errors when switching modes
  };

  const currentError = isLoginMode ? loginError : registerError;
  const isLoading = isLoggingIn || isRegistering;

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md" data-testid="login-card">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-2xl">
            {isLoginMode ? <LogIn className="h-6 w-6" /> : <UserPlus className="h-6 w-6" />}
            {isLoginMode ? "Sign In" : "Create Account"}
          </CardTitle>
          <CardDescription>
            {isLoginMode
              ? "Enter your credentials to access the system"
              : "Create a new account to get started"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentError && (
            <Alert variant="destructive" data-testid="auth-error">
              <AlertDescription>{currentError.message}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={isLoginMode ? handleLogin : handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={isLoginMode ? credentials.username : registerData.username}
                onChange={(e) => {
                  if (isLoginMode) {
                    setCredentials({ ...credentials, username: e.target.value });
                  } else {
                    setRegisterData({ ...registerData, username: e.target.value });
                  }
                }}
                required
                disabled={isLoading}
                data-testid="input-username"
              />
            </div>

            {!isLoginMode && (
              <div className="space-y-2">
                <Label htmlFor="email">Email (Optional)</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={registerData.email}
                  onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                  disabled={isLoading}
                  data-testid="input-email"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={isLoginMode ? credentials.password : registerData.password}
                onChange={(e) => {
                  if (isLoginMode) {
                    setCredentials({ ...credentials, password: e.target.value });
                  } else {
                    setRegisterData({ ...registerData, password: e.target.value });
                  }
                }}
                required
                disabled={isLoading}
                data-testid="input-password"
              />
            </div>

            {!isLoginMode && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm your password"
                  value={registerData.confirmPassword}
                  onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                  required
                  disabled={isLoading}
                  data-testid="input-confirm-password"
                />
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
              data-testid="button-submit"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoginMode ? "Sign In" : "Create Account"}
            </Button>
          </form>

          <div className="text-center">
            <Button
              variant="ghost"
              onClick={toggleMode}
              disabled={isLoading}
              className="text-sm text-muted-foreground hover:text-primary"
              data-testid="button-toggle-mode"
            >
              {isLoginMode
                ? "Don't have an account? Sign up"
                : "Already have an account? Sign in"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}