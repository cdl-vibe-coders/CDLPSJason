#!/bin/bash

# ============= AWS AMPLIFY ENVIRONMENT VALIDATION SCRIPT =============
# Validates environment configuration for AWS Amplify deployment
# Checks required environment variables and configuration settings

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[ENV]${NC} $1"
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

# ============= ENVIRONMENT VALIDATION =============

check_node_environment() {
    log_info "Checking Node.js environment..."
    
    # Set NODE_ENV to production if not set
    if [ -z "$NODE_ENV" ]; then
        export NODE_ENV=production
        log_info "NODE_ENV not set, defaulting to production"
    else
        log_info "NODE_ENV: $NODE_ENV"
    fi
    
    # Check Node.js version
    NODE_VERSION=$(node --version)
    MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1 | cut -d'v' -f2)
    
    if [ "$MAJOR_VERSION" -lt 18 ]; then
        log_warning "Node.js version $NODE_VERSION may be too old. Recommend Node.js 18+"
    else
        log_success "Node.js version: $NODE_VERSION ✓"
    fi
    
    # Check npm version
    NPM_VERSION=$(npm --version)
    log_info "npm version: $NPM_VERSION"
}

check_frontend_environment() {
    log_info "Checking frontend environment variables..."
    
    # Frontend environment variables (should be prefixed with VITE_)
    FRONTEND_VARS=(
        "VITE_API_URL"
        "VITE_APP_TITLE"
        "VITE_ENVIRONMENT"
    )
    
    local frontend_warnings=0
    
    for var in "${FRONTEND_VARS[@]}"; do
        if [ -z "${!var}" ]; then
            log_warning "Frontend environment variable not set: $var"
            frontend_warnings=$((frontend_warnings + 1))
        else
            log_success "✓ $var is configured"
        fi
    done
    
    if [ $frontend_warnings -eq 0 ]; then
        log_success "All frontend environment variables are configured"
    else
        log_warning "$frontend_warnings frontend environment variables are missing"
        log_info "Note: Missing VITE_ variables may cause runtime issues in the frontend"
    fi
}

check_database_environment() {
    log_info "Checking database environment..."
    
    if [ -z "$DATABASE_URL" ]; then
        log_warning "DATABASE_URL not set - database features will be unavailable"
        log_info "This is acceptable for frontend-only Amplify deployments"
    else
        log_success "✓ DATABASE_URL is configured"
        
        # Validate DATABASE_URL format
        if [[ "$DATABASE_URL" =~ ^postgresql:// ]] || [[ "$DATABASE_URL" =~ ^postgres:// ]]; then
            log_success "✓ DATABASE_URL format appears valid (PostgreSQL)"
        else
            log_warning "DATABASE_URL format may be invalid (expected postgresql:// or postgres://)"
        fi
    fi
}

check_optional_services() {
    log_info "Checking optional service configurations..."
    
    # Check Anthropic API key for AI features
    if [ -z "$ANTHROPIC_API_KEY" ]; then
        log_warning "ANTHROPIC_API_KEY not set - AI features will be unavailable"
    else
        log_success "✓ ANTHROPIC_API_KEY is configured"
    fi
    
    # Check session configuration
    if [ -z "$SESSION_SECRET" ]; then
        log_warning "SESSION_SECRET not set - authentication may use default secret"
    else
        log_success "✓ SESSION_SECRET is configured"
    fi
}

check_build_requirements() {
    log_info "Checking build requirements..."
    
    # Check if package.json exists
    if [ ! -f "package.json" ]; then
        log_error "package.json not found"
        exit 1
    else
        log_success "✓ package.json found"
    fi
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        log_warning "node_modules not found - dependencies may need to be installed"
    else
        log_success "✓ node_modules found"
    fi
    
    # Check critical files for frontend build
    REQUIRED_FILES=(
        "vite.config.ts"
        "tsconfig.json"
        "client/index.html"
        "client/src/main.tsx"
    )
    
    for file in "${REQUIRED_FILES[@]}"; do
        if [ ! -f "$file" ]; then
            log_error "Required file missing: $file"
            exit 1
        else
            log_success "✓ $file found"
        fi
    done
}

generate_environment_summary() {
    log_info "Environment Summary:"
    echo "----------------------------------------"
    echo "NODE_ENV: ${NODE_ENV:-'not set'}"
    echo "Node.js: $(node --version)"
    echo "npm: $(npm --version)"
    echo "Working Directory: $(pwd)"
    echo "Build Target: Frontend-only (AWS Amplify)"
    echo "----------------------------------------"
    
    if [ ! -z "$DATABASE_URL" ]; then
        echo "Database: Configured ✓"
    else
        echo "Database: Not configured (frontend-only deployment)"
    fi
    
    if [ ! -z "$ANTHROPIC_API_KEY" ]; then
        echo "AI Services: Configured ✓"
    else
        echo "AI Services: Not configured"
    fi
    
    echo "----------------------------------------"
}

# ============= MAIN EXECUTION =============

main() {
    log_info "Starting AWS Amplify environment validation..."
    
    check_node_environment
    check_build_requirements
    check_frontend_environment
    check_database_environment
    check_optional_services
    
    generate_environment_summary
    
    log_success "Environment validation completed successfully!"
    log_info "Environment is ready for AWS Amplify deployment"
}

# Run main function
main "$@"