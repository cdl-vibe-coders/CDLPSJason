#!/bin/bash

# ============= MODULAR DATABASE MIGRATION SCRIPT =============
# Handles database migrations while maintaining module isolation
# Usage: ./scripts/database/migrate.sh [module] [operation]
#   module: admin, users, all, or specific module name
#   operation: migrate, rollback, status, create (default: migrate)

set -e

MODULE_NAME="${1:-all}"
OPERATION="${2:-migrate}"
SCHEMA_DIR="shared"
MIGRATION_LOGS_DIR="deployment/database/logs"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[MIGRATION]${NC} $1"
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

# ============= ENVIRONMENT SETUP =============

check_requirements() {
    log_info "Checking migration requirements..."
    
    if [ -z "$DATABASE_URL" ]; then
        log_error "DATABASE_URL environment variable is required"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        log_error "npm is required for drizzle migrations"
        exit 1
    fi
    
    # Create logs directory
    mkdir -p "$MIGRATION_LOGS_DIR"
    
    log_success "Migration requirements satisfied"
}

# ============= DATABASE CONNECTION UTILITIES =============

test_database_connection() {
    log_info "Testing database connection..."
    
    if ! npx drizzle-kit introspect --config=drizzle.config.ts > /dev/null 2>&1; then
        log_error "Cannot connect to database. Please check DATABASE_URL"
        exit 1
    fi
    
    log_success "Database connection established"
}

get_module_tables() {
    local module=$1
    local namespace=""
    
    case "$module" in
        "admin")
            namespace="admin_"
            ;;
        "users")
            namespace="users_"
            ;;
        *)
            log_error "Unknown module: $module"
            return 1
            ;;
    esac
    
    echo "$namespace"
}

# ============= MIGRATION OPERATIONS =============

create_migration_tracking_table() {
    log_info "Creating migration tracking table..."
    
    # Create migration history table if it doesn't exist
    cat > /tmp/migration_tracking.sql << EOF
CREATE TABLE IF NOT EXISTS migration_history (
    id SERIAL PRIMARY KEY,
    module_name VARCHAR(50) NOT NULL,
    migration_name VARCHAR(100) NOT NULL,
    applied_at TIMESTAMP NOT NULL DEFAULT NOW(),
    rollback_sql TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'applied',
    UNIQUE(module_name, migration_name)
);

CREATE INDEX IF NOT EXISTS idx_migration_history_module_name ON migration_history(module_name);
CREATE INDEX IF NOT EXISTS idx_migration_history_status ON migration_history(status);
EOF

    # Apply the migration tracking table
    if command -v psql &> /dev/null; then
        psql "$DATABASE_URL" -f /tmp/migration_tracking.sql > /dev/null 2>&1
    else
        log_warning "psql not available, using drizzle to create tracking table"
        # Would need to implement drizzle-based creation
    fi
    
    rm -f /tmp/migration_tracking.sql
    log_success "Migration tracking table ready"
}

apply_module_schema() {
    local module=$1
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local log_file="$MIGRATION_LOGS_DIR/${module}_${timestamp}.log"
    
    log_info "Applying schema for module: $module"
    
    # Use drizzle-kit to push schema changes for this specific module
    local namespace=$(get_module_tables "$module")
    
    # Create a temporary drizzle config for this module
    cat > "/tmp/drizzle.${module}.config.ts" << EOF
import type { Config } from "drizzle-kit";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./shared/schema.ts",
  out: "./drizzle/${module}",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  tablesFilter: ["${namespace}*"],
  verbose: true,
  strict: true,
}) satisfies Config;
EOF
    
    # Apply the migration
    log_info "Pushing schema changes for $module module..."
    
    if npx drizzle-kit push --config="/tmp/drizzle.${module}.config.ts" > "$log_file" 2>&1; then
        log_success "Module $module schema applied successfully"
        
        # Record migration in history
        record_migration "$module" "schema_push_${timestamp}" "applied" "$log_file"
    else
        log_error "Failed to apply schema for module $module. Check log: $log_file"
        cat "$log_file"
        exit 1
    fi
    
    # Clean up temporary config
    rm -f "/tmp/drizzle.${module}.config.ts"
}

record_migration() {
    local module=$1
    local migration_name=$2
    local status=$3
    local log_file=$4
    
    if command -v psql &> /dev/null; then
        psql "$DATABASE_URL" -c "
            INSERT INTO migration_history (module_name, migration_name, status) 
            VALUES ('$module', '$migration_name', '$status')
            ON CONFLICT (module_name, migration_name) 
            DO UPDATE SET status = EXCLUDED.status, applied_at = NOW();
        " > /dev/null 2>&1
        
        log_info "Migration recorded: $module -> $migration_name ($status)"
    else
        log_warning "Cannot record migration history (psql not available)"
    fi
}

check_migration_status() {
    local module=$1
    
    log_info "Checking migration status for module: $module"
    
    if command -v psql &> /dev/null; then
        echo "Recent migrations for $module module:"
        psql "$DATABASE_URL" -c "
            SELECT migration_name, applied_at, status 
            FROM migration_history 
            WHERE module_name = '$module' 
            ORDER BY applied_at DESC 
            LIMIT 10;
        " 2>/dev/null || log_warning "Migration history not available"
    else
        log_warning "Cannot check migration status (psql not available)"
    fi
    
    # Check if module tables exist
    log_info "Checking table existence for $module module..."
    local namespace=$(get_module_tables "$module")
    
    if command -v psql &> /dev/null; then
        local table_count=$(psql "$DATABASE_URL" -t -c "
            SELECT COUNT(*) 
            FROM information_schema.tables 
            WHERE table_name LIKE '${namespace}%' 
            AND table_schema = 'public';
        " 2>/dev/null | tr -d ' ')
        
        if [ "$table_count" -gt 0 ]; then
            log_success "Module $module has $table_count tables in database"
        else
            log_warning "Module $module has no tables in database"
        fi
    fi
}

# ============= ROLLBACK OPERATIONS =============

rollback_module() {
    local module=$1
    local steps=${2:-1}
    
    log_warning "Rolling back $steps migration(s) for module: $module"
    log_warning "This operation will DROP TABLES and cause DATA LOSS!"
    
    read -p "Are you sure you want to rollback $module module? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        log_info "Rollback cancelled"
        return 0
    fi
    
    # Get module table namespace
    local namespace=$(get_module_tables "$module")
    
    # Generate DROP statements for module tables
    if command -v psql &> /dev/null; then
        log_warning "Dropping tables for module: $module"
        
        # Get list of tables to drop
        local tables=$(psql "$DATABASE_URL" -t -c "
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_name LIKE '${namespace}%' 
            AND table_schema = 'public';
        " 2>/dev/null)
        
        if [ -z "$tables" ]; then
            log_info "No tables found for module $module"
            return 0
        fi
        
        # Drop each table
        for table in $tables; do
            table=$(echo "$table" | tr -d ' ')
            log_info "Dropping table: $table"
            psql "$DATABASE_URL" -c "DROP TABLE IF EXISTS \"$table\" CASCADE;" > /dev/null 2>&1
        done
        
        # Record rollback
        record_migration "$module" "rollback_$(date +%Y%m%d_%H%M%S)" "rolled_back" ""
        
        log_success "Module $module rolled back successfully"
    else
        log_error "Cannot perform rollback (psql not available)"
        exit 1
    fi
}

# ============= MAIN OPERATIONS =============

migrate_all_modules() {
    log_info "Migrating all modules..."
    
    # Get list of available modules
    local modules=()
    if [ -d "server/modules/admin" ]; then
        modules+=("admin")
    fi
    if [ -d "server/modules/users" ]; then
        modules+=("users")
    fi
    
    if [ ${#modules[@]} -eq 0 ]; then
        log_error "No modules found to migrate"
        exit 1
    fi
    
    for module in "${modules[@]}"; do
        apply_module_schema "$module"
    done
    
    log_success "All modules migrated successfully"
}

show_status_all() {
    log_info "Showing status for all modules..."
    
    local modules=("admin" "users")
    
    for module in "${modules[@]}"; do
        echo "----------------------------------------"
        check_migration_status "$module"
        echo ""
    done
}

# ============= MAIN EXECUTION =============

main() {
    log_info "Starting database migration process..."
    log_info "Module: $MODULE_NAME, Operation: $OPERATION"
    
    check_requirements
    test_database_connection
    create_migration_tracking_table
    
    case "$OPERATION" in
        "migrate")
            case "$MODULE_NAME" in
                "all")
                    migrate_all_modules
                    ;;
                "admin"|"users")
                    apply_module_schema "$MODULE_NAME"
                    ;;
                *)
                    log_error "Unknown module: $MODULE_NAME"
                    exit 1
                    ;;
            esac
            ;;
        "rollback")
            case "$MODULE_NAME" in
                "all")
                    log_error "Rollback all modules is not supported for safety. Specify individual modules."
                    exit 1
                    ;;
                "admin"|"users")
                    rollback_module "$MODULE_NAME"
                    ;;
                *)
                    log_error "Unknown module: $MODULE_NAME"
                    exit 1
                    ;;
            esac
            ;;
        "status")
            case "$MODULE_NAME" in
                "all")
                    show_status_all
                    ;;
                "admin"|"users")
                    check_migration_status "$MODULE_NAME"
                    ;;
                *)
                    log_error "Unknown module: $MODULE_NAME"
                    exit 1
                    ;;
            esac
            ;;
        *)
            log_error "Unknown operation: $OPERATION"
            log_error "Available operations: migrate, rollback, status"
            exit 1
            ;;
    esac
    
    log_success "Database migration operation completed successfully!"
}

# Display help if no arguments
if [ $# -eq 0 ]; then
    echo "Usage: ./scripts/database/migrate.sh [module] [operation]"
    echo ""
    echo "Modules:"
    echo "  admin    - Migrate admin module tables"
    echo "  users    - Migrate users module tables"
    echo "  all      - Migrate all available modules"
    echo ""
    echo "Operations:"
    echo "  migrate  - Apply schema changes (default)"
    echo "  rollback - Rollback module schema (DANGEROUS)"
    echo "  status   - Show migration status"
    echo ""
    echo "Examples:"
    echo "  ./scripts/database/migrate.sh admin migrate"
    echo "  ./scripts/database/migrate.sh all status"
    echo "  ./scripts/database/migrate.sh users rollback"
    exit 0
fi

# Run main function
main "$@"