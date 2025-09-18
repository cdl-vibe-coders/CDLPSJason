#!/bin/bash

# ============= AWS AMPLIFY PRODUCTION DATABASE SCRIPT =============
# Production database setup and migration script for AWS Amplify
# Handles database initialization, schema migration, and validation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[DATABASE]${NC} $1"
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

# ============= CONFIGURATION =============

# Database configuration
DATABASE_TIMEOUT=30
MIGRATION_RETRIES=3
BACKUP_RETENTION_DAYS=7

# ============= DATABASE VALIDATION =============

validate_database_url() {
    log_info "Validating database configuration..."
    
    if [ -z "$DATABASE_URL" ]; then
        log_warning "DATABASE_URL not set - database features will be unavailable"
        log_info "This is acceptable for frontend-only Amplify deployments"
        return 1
    fi
    
    # Validate URL format
    if [[ "$DATABASE_URL" =~ ^postgresql://.*$ ]] || [[ "$DATABASE_URL" =~ ^postgres://.*$ ]]; then
        log_success "✓ DATABASE_URL format is valid"
    else
        log_error "Invalid DATABASE_URL format. Expected postgresql:// or postgres://"
        return 1
    fi
    
    # Extract database information for logging (without exposing credentials)
    local db_host=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\).*/\1/p')
    local db_name=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
    
    log_info "Database host: ${db_host:-'unknown'}"
    log_info "Database name: ${db_name:-'unknown'}"
    
    return 0
}

test_database_connection() {
    log_info "Testing database connectivity..."
    
    if ! validate_database_url; then
        return 1
    fi
    
    # Try connection with timeout
    local connection_test_passed=false
    
    # Method 1: Use drizzle-kit if available
    if command -v npm >/dev/null 2>&1 && [ -f "drizzle.config.ts" ]; then
        log_info "Testing connection with drizzle-kit..."
        
        if timeout $DATABASE_TIMEOUT npm run db:push --dry-run >/dev/null 2>&1; then
            connection_test_passed=true
            log_success "✓ Database connection successful (drizzle-kit)"
        else
            log_warning "Database connection test failed with drizzle-kit"
        fi
    fi
    
    # Method 2: Use psql if available (fallback)
    if [ "$connection_test_passed" = false ] && command -v psql >/dev/null 2>&1; then
        log_info "Testing connection with psql..."
        
        if timeout $DATABASE_TIMEOUT psql "$DATABASE_URL" -c "SELECT 1;" >/dev/null 2>&1; then
            connection_test_passed=true
            log_success "✓ Database connection successful (psql)"
        else
            log_warning "Database connection test failed with psql"
        fi
    fi
    
    if [ "$connection_test_passed" = true ]; then
        log_success "Database connectivity validated"
        return 0
    else
        log_error "Unable to establish database connection"
        return 1
    fi
}

# ============= SCHEMA MIGRATION =============

run_database_migrations() {
    log_info "Running database migrations..."
    
    if ! validate_database_url; then
        log_info "Skipping database migrations (no DATABASE_URL)"
        return 0
    fi
    
    local migration_attempt=1
    local migration_success=false
    
    while [ $migration_attempt -le $MIGRATION_RETRIES ] && [ "$migration_success" = false ]; do
        log_info "Migration attempt $migration_attempt of $MIGRATION_RETRIES"
        
        # Set production environment for migrations
        export NODE_ENV=production
        
        # Run migration with timeout
        if timeout $DATABASE_TIMEOUT npm run db:push 2>/dev/null; then
            migration_success=true
            log_success "✓ Database migrations completed successfully"
        else
            log_warning "Migration attempt $migration_attempt failed"
            migration_attempt=$((migration_attempt + 1))
            
            if [ $migration_attempt -le $MIGRATION_RETRIES ]; then
                log_info "Retrying in 5 seconds..."
                sleep 5
            fi
        fi
    done
    
    if [ "$migration_success" = false ]; then
        log_error "Database migrations failed after $MIGRATION_RETRIES attempts"
        return 1
    fi
    
    return 0
}

# ============= DATABASE HEALTH CHECK =============

check_database_health() {
    log_info "Checking database health..."
    
    if ! validate_database_url; then
        log_info "Skipping database health check (no DATABASE_URL)"
        return 0
    fi
    
    local health_checks=0
    local health_passed=0
    
    # Check 1: Basic connectivity
    health_checks=$((health_checks + 1))
    if test_database_connection >/dev/null 2>&1; then
        health_passed=$((health_passed + 1))
        log_success "✓ Database connectivity check passed"
    else
        log_warning "✗ Database connectivity check failed"
    fi
    
    # Check 2: Schema validation (if drizzle available)
    if command -v npm >/dev/null 2>&1 && [ -f "drizzle.config.ts" ]; then
        health_checks=$((health_checks + 1))
        if timeout 15 npm run db:push --dry-run >/dev/null 2>&1; then
            health_passed=$((health_passed + 1))
            log_success "✓ Database schema validation passed"
        else
            log_warning "✗ Database schema validation failed"
        fi
    fi
    
    # Health summary
    local health_percentage=$((health_passed * 100 / health_checks))
    log_info "Database health: $health_passed/$health_checks checks passed (${health_percentage}%)"
    
    if [ $health_passed -eq $health_checks ]; then
        log_success "Database is healthy"
        return 0
    elif [ $health_passed -gt 0 ]; then
        log_warning "Database has some issues but is partially functional"
        return 0
    else
        log_error "Database health check failed"
        return 1
    fi
}

# ============= PRODUCTION OPTIMIZATIONS =============

optimize_database_settings() {
    log_info "Applying production database optimizations..."
    
    if ! validate_database_url; then
        log_info "Skipping database optimizations (no DATABASE_URL)"
        return 0
    fi
    
    # Set production-optimized environment variables
    export NODE_ENV=production
    export DATABASE_CONNECTION_TIMEOUT=30000
    export DATABASE_POOL_SIZE=10
    export DATABASE_SSL_REQUIRED=true
    
    log_success "Production database settings applied"
}

# ============= BACKUP VERIFICATION =============

verify_backup_capability() {
    log_info "Verifying backup capabilities..."
    
    if ! validate_database_url; then
        log_info "Skipping backup verification (no DATABASE_URL)"
        return 0
    fi
    
    # Check if we can create a logical backup
    if command -v pg_dump >/dev/null 2>&1; then
        log_success "✓ pg_dump available for backups"
    else
        log_warning "pg_dump not available - backup capabilities limited"
    fi
    
    # Verify backup storage (if configured)
    if [ ! -z "$BACKUP_STORAGE_URL" ]; then
        log_info "Backup storage configured: ${BACKUP_STORAGE_URL}"
    else
        log_warning "No backup storage configured"
    fi
    
    log_info "Backup verification completed"
}

# ============= MONITORING SETUP =============

setup_database_monitoring() {
    log_info "Setting up database monitoring..."
    
    # Create monitoring configuration
    local monitoring_config="dist/public/.database-monitoring.json"
    
    mkdir -p "$(dirname "$monitoring_config")"
    
    cat > "$monitoring_config" << EOF
{
  "enabled": $([ ! -z "$DATABASE_URL" ] && echo "true" || echo "false"),
  "lastHealthCheck": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "environment": "${NODE_ENV:-production}",
  "monitoringLevel": "${DATABASE_MONITORING_LEVEL:-basic}",
  "alertsEnabled": $([ "$NODE_ENV" = "production" ] && echo "true" || echo "false")
}
EOF
    
    log_success "Database monitoring configuration created"
}

# ============= MAIN EXECUTION =============

main() {
    log_info "Starting production database setup for AWS Amplify..."
    
    # Basic validation
    validate_database_url
    local has_database=$?
    
    if [ $has_database -eq 0 ]; then
        # Full database setup
        log_info "Database URL provided - setting up production database"
        
        test_database_connection
        optimize_database_settings
        run_database_migrations
        check_database_health
        verify_backup_capability
        setup_database_monitoring
        
        log_success "Production database setup completed successfully!"
    else
        # Frontend-only deployment
        log_info "No database configuration - setting up for frontend-only deployment"
        
        setup_database_monitoring
        
        log_success "Frontend-only deployment setup completed!"
    fi
    
    log_info "Database setup process finished"
}

# Display help if requested
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "AWS Amplify Production Database Setup Script"
    echo ""
    echo "Usage: ./scripts/amplify/database-prod.sh [options]"
    echo ""
    echo "Environment Variables:"
    echo "  DATABASE_URL                  - PostgreSQL connection string"
    echo "  DATABASE_MONITORING_LEVEL     - Monitoring level (basic, detailed)"
    echo "  BACKUP_STORAGE_URL           - Backup storage configuration"
    echo "  NODE_ENV                     - Environment (production)"
    echo ""
    echo "Features:"
    echo "  - Database connectivity testing"
    echo "  - Schema migrations with retries"
    echo "  - Production optimizations"
    echo "  - Health monitoring setup"
    echo "  - Backup capability verification"
    echo ""
    echo "This script is designed to work in AWS Amplify build environment"
    echo "and gracefully handles both database and frontend-only deployments."
    exit 0
fi

# Run main function if script is executed directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi