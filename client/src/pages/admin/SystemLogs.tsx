import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Activity, 
  Clock, 
  Search,
  Download,
  Filter,
  AlertTriangle,
  CheckCircle,
  Info,
  X,
  Users,
  Shield,
  Database,
  RefreshCw
} from "lucide-react";

interface LogEntry {
  id: string;
  moduleId: string | null;
  moduleName: string | null;
  userId: string;
  username: string;
  action: string;
  details: any;
  level: 'info' | 'warning' | 'error';
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
}

interface LogFilters {
  level?: string;
  moduleId?: string;
  userId?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
}

export default function SystemLogs() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<LogFilters>({});
  const [selectedTab, setSelectedTab] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  const { data: logs = [], isLoading, error, refetch } = useQuery<LogEntry[]>({
    queryKey: ['/api/admin/logs', filters],
  });

  const { data: modules = [] } = useQuery<{ id: string; name: string; displayName: string; }[]>({
    queryKey: ['/api/admin/modules'],
  });

  const { data: users = [] } = useQuery<{ id: string; username: string; }[]>({
    queryKey: ['/api/admin/users'],
  });

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'info': return <Info className="h-4 w-4 text-blue-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error': return <X className="h-4 w-4 text-red-500" />;
      default: return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'info': return 'default';
      case 'warning': return 'secondary';
      case 'error': return 'destructive';
      default: return 'outline';
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = searchQuery === '' || 
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.moduleName && log.moduleName.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesTab = selectedTab === 'all' || log.level === selectedTab;
    
    return matchesSearch && matchesTab;
  });

  const logStats = {
    total: logs.length,
    info: logs.filter(l => l.level === 'info').length,
    warning: logs.filter(l => l.level === 'warning').length,
    error: logs.filter(l => l.level === 'error').length,
    today: logs.filter(l => new Date(l.timestamp).toDateString() === new Date().toDateString()).length,
  };

  if (error) {
    return (
      <div className="space-y-6" data-testid="system-logs-error">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Failed to load system logs. Please refresh the page or contact support.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="system-logs">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">System Logs</h2>
          <p className="text-muted-foreground">
            View system activity, audit trails, and administrative actions
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            data-testid="button-toggle-filters"
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            Filters
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => refetch()}
            data-testid="button-refresh-logs"
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            data-testid="button-export-logs"
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card data-testid="card-total-logs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Logs</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-logs">
              {isLoading ? <Skeleton className="h-8 w-16" /> : logStats.total}
            </div>
            <p className="text-xs text-muted-foreground">
              All time entries
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-info-logs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Info</CardTitle>
            <Info className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-info-logs">
              {isLoading ? <Skeleton className="h-8 w-16" /> : logStats.info}
            </div>
            <p className="text-xs text-muted-foreground">
              Information entries
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-warning-logs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Warnings</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-warning-logs">
              {isLoading ? <Skeleton className="h-8 w-16" /> : logStats.warning}
            </div>
            <p className="text-xs text-muted-foreground">
              Warning entries
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-error-logs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Errors</CardTitle>
            <X className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-error-logs">
              {isLoading ? <Skeleton className="h-8 w-16" /> : logStats.error}
            </div>
            <p className="text-xs text-muted-foreground">
              Error entries
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-today-logs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-today-logs">
              {isLoading ? <Skeleton className="h-8 w-16" /> : logStats.today}
            </div>
            <p className="text-xs text-muted-foreground">
              Today's entries
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Advanced Filters */}
      {showFilters && (
        <Card data-testid="card-advanced-filters">
          <CardHeader>
            <CardTitle className="text-lg">Advanced Filters</CardTitle>
            <CardDescription>
              Filter logs by specific criteria to find what you need
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="module-filter">Module</Label>
                <Select value={filters.moduleId || ''} onValueChange={(value) => 
                  setFilters(prev => ({ ...prev, moduleId: value || undefined }))
                }>
                  <SelectTrigger id="module-filter" data-testid="select-module-filter">
                    <SelectValue placeholder="All modules" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All modules</SelectItem>
                    {modules.map((module) => (
                      <SelectItem key={module.id} value={module.id}>
                        {module.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="user-filter">User</Label>
                <Select value={filters.userId || ''} onValueChange={(value) => 
                  setFilters(prev => ({ ...prev, userId: value || undefined }))
                }>
                  <SelectTrigger id="user-filter" data-testid="select-user-filter">
                    <SelectValue placeholder="All users" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All users</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="level-filter">Level</Label>
                <Select value={filters.level || ''} onValueChange={(value) => 
                  setFilters(prev => ({ ...prev, level: value || undefined }))
                }>
                  <SelectTrigger id="level-filter" data-testid="select-level-filter">
                    <SelectValue placeholder="All levels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All levels</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-4">
              <Button 
                variant="outline" 
                onClick={() => setFilters({})}
                data-testid="button-clear-filters"
              >
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Logs List */}
      <Card data-testid="card-logs-list">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Activity Logs
          </CardTitle>
          <CardDescription>
            Detailed view of all system events and user actions
          </CardDescription>
          
          {/* Search and Tabs */}
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs by action, user, or module..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-logs"
              />
            </div>
            
            <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
              <TabsList>
                <TabsTrigger value="all" data-testid="tab-all-logs">
                  All ({logStats.total})
                </TabsTrigger>
                <TabsTrigger value="info" data-testid="tab-info-logs">
                  Info ({logStats.info})
                </TabsTrigger>
                <TabsTrigger value="warning" data-testid="tab-warning-logs">
                  Warnings ({logStats.warning})
                </TabsTrigger>
                <TabsTrigger value="error" data-testid="tab-error-logs">
                  Errors ({logStats.error})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-start space-x-3 p-4 border rounded-lg">
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-5 w-16" />
                </div>
              ))}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12" data-testid="no-logs">
              <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No logs found</h3>
              <p className="text-muted-foreground">
                {searchQuery 
                  ? "No logs match your search criteria" 
                  : "No system activity has been logged yet"
                }
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredLogs.map((log) => (
                <div 
                  key={log.id} 
                  className="flex items-start space-x-3 p-4 border rounded-lg hover-elevate"
                  data-testid={`log-entry-${log.id}`}
                >
                  <div className="flex-shrink-0 mt-1">
                    {getLevelIcon(log.level)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium" data-testid={`log-action-${log.id}`}>
                        {log.action}
                      </span>
                      <Badge 
                        variant={getLevelColor(log.level) as any}
                        data-testid={`log-level-${log.id}`}
                      >
                        {log.level}
                      </Badge>
                      {log.moduleName && (
                        <Badge variant="outline" data-testid={`log-module-${log.id}`}>
                          {log.moduleName}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
                      <Users className="h-3 w-3" />
                      <span data-testid={`log-user-${log.id}`}>{log.username}</span>
                      <Clock className="h-3 w-3 ml-2" />
                      <span data-testid={`log-time-${log.id}`}>
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                    
                    {log.details && typeof log.details === 'object' && (
                      <div className="text-sm text-muted-foreground bg-muted/50 rounded p-2 mt-2">
                        <pre className="whitespace-pre-wrap text-xs" data-testid={`log-details-${log.id}`}>
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-shrink-0 text-right">
                    <div className="text-xs text-muted-foreground">
                      {new Date(log.timestamp).toLocaleDateString()}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(log.timestamp).toLocaleTimeString()}
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