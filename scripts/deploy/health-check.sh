#!/bin/bash

# ============= DEPLOYMENT HEALTH CHECK SCRIPT =============
# Comprehensive health check for both monolith and distributed deployments
# Usage: ./scripts/deploy/health-check.sh [mode] [timeout]
#   mode: monolith, distributed, or auto-detect (default: auto-detect)
#   timeout: timeout in seconds (default: 30)

set -e

DEPLOYMENT_MODE="${1:-auto}"
TIMEOUT="${2:-30}"
HEALTH_CHECK_RESULTS="deployment/logs/health-check-$(date +%Y%m%d_%H%M%S).json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[HEALTH]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# ============= UTILITY FUNCTIONS =============

create_logs_dir() {
    mkdir -p "deployment/logs"
}

detect_deployment_mode() {
    log_info "Auto-detecting deployment mode..."
    
    # Check if docker-compose is running
    if docker-compose ps | grep -q "Up"; then
        if docker-compose ps | grep -q "app-monolith.*Up"; then
            echo "monolith"
        elif docker-compose ps | grep -q "admin-module.*Up\|users-module.*Up"; then
            echo "distributed"
        else
            echo "unknown"
        fi
    elif curl -f http://localhost:5000/health >/dev/null 2>&1; then
        echo "monolith"
    elif curl -f http://localhost:3001/health >/dev/null 2>&1 || curl -f http://localhost:3002/health >/dev/null 2>&1; then
        echo "distributed"
    else
        echo "unknown"
    fi
}

check_endpoint() {
    local endpoint=$1
    local description=$2
    local timeout=${3:-5}
    
    log_info "Checking $description: $endpoint"
    
    local start_time=$(date +%s.%3N)
    local response_code=0
    local response_body=""
    local response_time=0
    
    # Make the request with timeout
    if response=$(curl -s -w "\n%{http_code}" -m "$timeout" "$endpoint" 2>/dev/null); then
        response_body=$(echo "$response" | head -n -1)
        response_code=$(echo "$response" | tail -n 1)
        local end_time=$(date +%s.%3N)
        response_time=$(echo "$end_time - $start_time" | bc 2>/dev/null || echo "0")
    else
        response_code=0
    fi
    
    # Create result object
    local result=$(cat << EOF
{
  "endpoint": "$endpoint",
  "description": "$description",
  "status_code": $response_code,
  "response_time_ms": $(echo "$response_time * 1000" | bc 2>/dev/null || echo "0"),
  "healthy": $([ "$response_code" -eq 200 ] && echo "true" || echo "false"),
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "response_preview": "$(echo "$response_body" | head -c 100 | tr '\n' ' ' | tr '"' "'")"
}
EOF
    )
    
    echo "$result"
    
    if [ "$response_code" -eq 200 ]; then
        log_success "$description is healthy (${response_time}ms)"
        return 0
    else
        log_error "$description is unhealthy (HTTP $response_code)"
        return 1
    fi
}

check_database_connection() {
    log_info "Checking database connection..."
    
    if [ -z "$DATABASE_URL" ]; then
        log_warning "DATABASE_URL not set, skipping database check"
        return 1
    fi
    
    local start_time=$(date +%s.%3N)
    local healthy=false
    
    if command -v psql >/dev/null 2>&1; then
        if psql "$DATABASE_URL" -c "SELECT 1;" >/dev/null 2>&1; then
            healthy=true
        fi
    elif command -v npm >/dev/null 2>&1; then
        # Use drizzle to test connection
        if timeout 10 npm run db:push --dry-run >/dev/null 2>&1; then
            healthy=true
        fi
    fi
    
    local end_time=$(date +%s.%3N)
    local response_time=$(echo "($end_time - $start_time) * 1000" | bc 2>/dev/null || echo "0")
    
    local result=$(cat << EOF
{
  "component": "database",
  "healthy": $healthy,
  "response_time_ms": $response_time,
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
    )
    
    echo "$result"
    
    if $healthy; then
        log_success "Database connection is healthy (${response_time}ms)"
        return 0
    else
        log_error "Database connection failed"
        return 1
    fi
}

# ============= MONOLITH HEALTH CHECKS =============

check_monolith_health() {
    log_info "Performing monolith deployment health checks..."
    
    local base_url="${MONOLITH_URL:-http://localhost:5000}"
    local results=()
    local overall_healthy=true
    
    # Core application health
    if ! result=$(check_endpoint "$base_url/health" "Application Health" 10); then
        overall_healthy=false
    fi
    results+=("$result")
    
    # Admin module endpoints
    if ! result=$(check_endpoint "$base_url/api/admin/dashboard" "Admin Dashboard" 5); then
        overall_healthy=false
    fi
    results+=("$result")
    
    # Users module endpoints  
    if ! result=$(check_endpoint "$base_url/api/users/auth/me" "Users Auth Check" 5); then
        # This might return 401 which is expected for unauthenticated requests
        if echo "$result" | grep -q '"status_code": 401'; then
            result=$(echo "$result" | sed 's/"healthy": false/"healthy": true/')
            log_success "Users Auth Check is healthy (401 expected for unauthenticated)"
        else
            overall_healthy=false
        fi
    fi
    results+=("$result")
    
    # Database check
    if ! db_result=$(check_database_connection); then
        overall_healthy=false
    fi
    results+=("$db_result")
    
    # Create final health report
    local health_report=$(cat << EOF
{
  "deployment_mode": "monolith",
  "overall_healthy": $overall_healthy,
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "base_url": "$base_url",
  "checks": [
    $(IFS=','; echo "${results[*]}")
  ]
}
EOF
    )
    
    echo "$health_report" > "$HEALTH_CHECK_RESULTS"
    
    if $overall_healthy; then
        log_success "Monolith deployment is healthy"
        return 0
    else
        log_error "Monolith deployment has health issues"
        return 1
    fi
}

# ============= DISTRIBUTED HEALTH CHECKS =============

check_distributed_health() {
    log_info "Performing distributed deployment health checks..."
    
    local admin_url="${ADMIN_MODULE_URL:-http://localhost:3001}"
    local users_url="${USERS_MODULE_URL:-http://localhost:3002}"
    local nginx_url="${NGINX_URL:-http://localhost:80}"
    
    local results=()
    local overall_healthy=true
    
    # Check individual modules
    if ! result=$(check_endpoint "$admin_url/health" "Admin Module Health" 10); then
        overall_healthy=false
    fi
    results+=("$result")
    
    if ! result=$(check_endpoint "$users_url/health" "Users Module Health" 10); then
        overall_healthy=false
    fi
    results+=("$result")
    
    # Check load balancer if available
    if curl -f "$nginx_url/health" >/dev/null 2>&1; then
        if ! result=$(check_endpoint "$nginx_url/health" "Load Balancer Health" 5); then
            overall_healthy=false
        fi
        results+=("$result")
    else
        log_warning "Load balancer not accessible, skipping check"
    fi
    
    # Check module endpoints through load balancer
    if curl -f "$nginx_url/api/admin/dashboard" >/dev/null 2>&1; then
        if ! result=$(check_endpoint "$nginx_url/api/admin/dashboard" "Admin API via Load Balancer" 5); then
            overall_healthy=false
        fi
        results+=("$result")
    fi
    
    if curl -f "$nginx_url/api/users/auth/me" >/dev/null 2>&1; then
        if ! result=$(check_endpoint "$nginx_url/api/users/auth/me" "Users API via Load Balancer" 5); then
            # 401 is expected for unauthenticated requests
            if echo "$result" | grep -q '"status_code": 401'; then
                result=$(echo "$result" | sed 's/"healthy": false/"healthy": true/')
                log_success "Users API via Load Balancer is healthy (401 expected)"
            else
                overall_healthy=false
            fi
        fi
        results+=("$result")
    fi
    
    # Database check
    if ! db_result=$(check_database_connection); then
        overall_healthy=false
    fi
    results+=("$db_result")
    
    # Create final health report
    local health_report=$(cat << EOF
{
  "deployment_mode": "distributed",
  "overall_healthy": $overall_healthy,
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "modules": {
    "admin": "$admin_url",
    "users": "$users_url"
  },
  "load_balancer": "$nginx_url",
  "checks": [
    $(IFS=','; echo "${results[*]}")
  ]
}
EOF
    )
    
    echo "$health_report" > "$HEALTH_CHECK_RESULTS"
    
    if $overall_healthy; then
        log_success "Distributed deployment is healthy"
        return 0
    else
        log_error "Distributed deployment has health issues"
        return 1
    fi
}

# ============= MAIN EXECUTION =============

main() {
    log_info "Starting deployment health check..."
    log_info "Mode: $DEPLOYMENT_MODE, Timeout: ${TIMEOUT}s"
    
    create_logs_dir
    
    # Determine deployment mode
    if [ "$DEPLOYMENT_MODE" = "auto" ]; then
        DEPLOYMENT_MODE=$(detect_deployment_mode)
        log_info "Detected deployment mode: $DEPLOYMENT_MODE"
    fi
    
    # Perform health checks based on deployment mode
    case "$DEPLOYMENT_MODE" in
        "monolith")
            if check_monolith_health; then
                log_success "Monolith health check passed"
                exit_code=0
            else
                log_error "Monolith health check failed"
                exit_code=1
            fi
            ;;
        "distributed")
            if check_distributed_health; then
                log_success "Distributed health check passed"
                exit_code=0
            else
                log_error "Distributed health check failed"
                exit_code=1
            fi
            ;;
        "unknown")
            log_error "Could not detect deployment mode and no services are responding"
            exit_code=1
            ;;
        *)
            log_error "Unknown deployment mode: $DEPLOYMENT_MODE"
            log_error "Available modes: monolith, distributed, auto"
            exit_code=1
            ;;
    esac
    
    log_info "Health check results saved to: $HEALTH_CHECK_RESULTS"
    
    if [ -f "$HEALTH_CHECK_RESULTS" ]; then
        echo ""
        echo "=== HEALTH CHECK SUMMARY ==="
        if command -v jq >/dev/null 2>&1; then
            jq -r '.checks[] | "\(.description): \(if .healthy then "✓ HEALTHY" else "✗ UNHEALTHY" end) (\(.response_time_ms)ms)"' "$HEALTH_CHECK_RESULTS"
        else
            log_info "Install jq for formatted output. Raw results in: $HEALTH_CHECK_RESULTS"
        fi
    fi
    
    exit $exit_code
}

# Display help if requested
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Deployment Health Check Script"
    echo ""
    echo "Usage: ./scripts/deploy/health-check.sh [mode] [timeout]"
    echo ""
    echo "Parameters:"
    echo "  mode     - Deployment mode: monolith, distributed, auto (default: auto)"
    echo "  timeout  - Timeout in seconds for each check (default: 30)"
    echo ""
    echo "Environment Variables:"
    echo "  DATABASE_URL        - Database connection string"
    echo "  MONOLITH_URL        - Monolith base URL (default: http://localhost:5000)"
    echo "  ADMIN_MODULE_URL    - Admin module URL (default: http://localhost:3001)"
    echo "  USERS_MODULE_URL    - Users module URL (default: http://localhost:3002)"
    echo "  NGINX_URL           - Load balancer URL (default: http://localhost:80)"
    echo ""
    echo "Examples:"
    echo "  ./scripts/deploy/health-check.sh                    # Auto-detect mode"
    echo "  ./scripts/deploy/health-check.sh monolith           # Check monolith"
    echo "  ./scripts/deploy/health-check.sh distributed 60     # Check distributed with 60s timeout"
    exit 0
fi

# Run main function
main "$@"