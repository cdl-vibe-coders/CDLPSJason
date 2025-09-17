import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Plus } from "lucide-react";
import { insertAdminModuleSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { z } from "zod";

// Extend the schema for form validation
const createModuleFormSchema = insertAdminModuleSchema.extend({
  name: z.string()
    .min(2, "Module name must be at least 2 characters")
    .max(50, "Module name must be less than 50 characters")
    .regex(/^[a-z0-9_-]+$/, "Module name can only contain lowercase letters, numbers, hyphens, and underscores"),
  displayName: z.string()
    .min(2, "Display name must be at least 2 characters")
    .max(100, "Display name must be less than 100 characters"),
  version: z.string()
    .regex(/^\d+\.\d+\.\d+$/, "Version must be in format x.y.z (e.g., 1.0.0)"),
  description: z.string()
    .max(500, "Description must be less than 500 characters")
    .optional()
});

type CreateModuleFormData = z.infer<typeof createModuleFormSchema>;

interface CreateModuleFormProps {
  onSuccess: () => void;
}

export function CreateModuleForm({ onSuccess }: CreateModuleFormProps) {
  const form = useForm<CreateModuleFormData>({
    resolver: zodResolver(createModuleFormSchema),
    defaultValues: {
      name: "",
      displayName: "",
      description: "",
      version: "1.0.0"
    }
  });

  const createModuleMutation = useMutation({
    mutationFn: async (data: CreateModuleFormData) => {
      const response = await apiRequest('POST', '/api/settings/modules', data);
      return response.json();
    },
    onSuccess: () => {
      form.reset();
      onSuccess();
    },
    onError: (error) => {
      console.error('Create module error:', error);
    }
  });

  const onSubmit = (data: CreateModuleFormData) => {
    createModuleMutation.mutate(data);
  };

  return (
    <div data-testid="create-module-form">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Module Name *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., user-auth"
                      data-testid="input-module-name"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Unique identifier for the module (lowercase, numbers, hyphens, underscores only)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Name *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., User Authentication"
                      data-testid="input-display-name"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Human-readable name shown in the interface
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="version"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Version *</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="1.0.0"
                    data-testid="input-version"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Semantic version in format x.y.z (e.g., 1.0.0)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Describe what this module does and its key features..."
                    className="min-h-20"
                    data-testid="textarea-description"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Optional description of the module's purpose and functionality
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {createModuleMutation.error && (
            <Alert variant="destructive" data-testid="create-module-error">
              <AlertDescription>
                {createModuleMutation.error instanceof Error 
                  ? createModuleMutation.error.message 
                  : 'Failed to create module. Please try again.'}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => form.reset()}
              disabled={createModuleMutation.isPending}
              data-testid="button-reset-form"
            >
              Reset
            </Button>
            <Button
              type="submit"
              disabled={createModuleMutation.isPending}
              data-testid="button-create-module-submit"
              className="gap-2"
            >
              {createModuleMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {createModuleMutation.isPending ? 'Creating...' : 'Create Module'}
            </Button>
          </div>

          <Alert data-testid="create-module-info">
            <AlertDescription>
              <strong>Note:</strong> New modules are created as active by default. 
              You can configure role permissions and user overrides after creation.
            </AlertDescription>
          </Alert>
        </form>
      </Form>
    </div>
  );
}