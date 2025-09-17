import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Activity, 
  Database, 
  Users, 
  Shield, 
  Server, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  TrendingUp,
  TrendingDown
} from "lucide-react";

interface DashboardStats {
  totalModules: number;
  activeModules: number;
  totalUsers: number;
  activeUsers: number;
  systemHealth: {
    status: 'healthy' | 'warning' | 'critical';
    uptime: string;
    dbConnections: number;
    memoryUsage: number;
    cpuUsage: number;
  };
  recentActivity: {
    id: string;
    action: string;
    details: string;
    timestamp: string;
    userId: string;
  }[];
}

export default function AdminDashboard() {
  const { data: stats, isLoading, error } = useQuery<DashboardStats>({
    queryKey: ['/api/admin/dashboard/stats'],
  });

  if (error) {
    return (
      <div className="space-y-6" data-testid="admin-dashboard-error">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Failed to load dashboard data. Please refresh the page or contact support.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="admin-dashboard">
      {/* System Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card data-testid="card-total-modules">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Modules</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-modules">
              {isLoading ? <Skeleton className="h-8 w-16" /> : stats?.totalModules || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {isLoading ? <Skeleton className="h-4 w-20" /> : `${stats?.activeModules || 0} active`}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-total-users">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-users">
              {isLoading ? <Skeleton className="h-8 w-16" /> : stats?.totalUsers || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {isLoading ? <Skeleton className="h-4 w-20" /> : `${stats?.activeUsers || 0} active`}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-system-health">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              {isLoading ? (
                <Skeleton className="h-6 w-16" />
              ) : (
                <>
                  {stats?.systemHealth.status === 'healthy' && <CheckCircle className="h-4 w-4 text-green-500" />}
                  {stats?.systemHealth.status === 'warning' && <AlertTriangle className="h-4 w-4 text-yellow-500" />}
                  {stats?.systemHealth.status === 'critical' && <AlertTriangle className="h-4 w-4 text-red-500" />}
                  <Badge 
                    variant={stats?.systemHealth.status === 'healthy' ? 'default' : 'destructive'}
                    data-testid="badge-system-status"
                  >
                    {stats?.systemHealth.status || 'Unknown'}
                  </Badge>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {isLoading ? <Skeleton className="h-4 w-24" /> : `Uptime: ${stats?.systemHealth.uptime || 'N/A'}`}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-activity">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-activity-count">
              {isLoading ? <Skeleton className="h-8 w-16" /> : stats?.recentActivity.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {isLoading ? <Skeleton className="h-4 w-24" /> : 'actions in last 24h'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* System Health Details */}
      {stats?.systemHealth && (
        <Card data-testid="card-system-details">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              System Performance
            </CardTitle>
            <CardDescription>
              Current system resource usage and connectivity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Memory Usage</span>
                  <span className="text-sm text-muted-foreground" data-testid="text-memory-usage">
                    {stats.systemHealth.memoryUsage}%
                  </span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full" 
                    style={{ width: `${stats.systemHealth.memoryUsage}%` }}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">CPU Usage</span>
                  <span className="text-sm text-muted-foreground" data-testid="text-cpu-usage">
                    {stats.systemHealth.cpuUsage}%
                  </span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full" 
                    style={{ width: `${stats.systemHealth.cpuUsage}%` }}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">DB Connections</span>
                  <span className="text-sm text-muted-foreground" data-testid="text-db-connections">
                    {stats.systemHealth.dbConnections}/100
                  </span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full" 
                    style={{ width: `${(stats.systemHealth.dbConnections / 100) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <Card data-testid="card-recent-activity">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent System Activity
          </CardTitle>
          <CardDescription>
            Latest administrative actions and system events
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="space-y-1 flex-1">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : stats?.recentActivity && stats.recentActivity.length > 0 ? (
            <div className="space-y-4">
              {stats.recentActivity.slice(0, 10).map((activity) => (
                <div 
                  key={activity.id} 
                  className="flex items-start space-x-3 pb-3 border-b border-border last:border-0"
                  data-testid={`activity-${activity.id}`}
                >
                  <div className="flex-shrink-0">
                    <Activity className="h-4 w-4 text-muted-foreground mt-1" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" data-testid={`activity-action-${activity.id}`}>
                      {activity.action}
                    </p>
                    <p className="text-xs text-muted-foreground" data-testid={`activity-details-${activity.id}`}>
                      {activity.details}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground" data-testid={`activity-time-${activity.id}`}>
                        {new Date(activity.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">No recent activity</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}