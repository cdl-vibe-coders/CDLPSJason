#!/bin/bash

# ============= AWS AMPLIFY PRE-BUILD SCRIPT =============
# Preparation script that runs before the main build process
# Handles cache clearing, dependency verification, and environment setup

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[PREBUILD]${NC} $1"
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

# ============= CACHE MANAGEMENT =============

clear_build_cache() {
    log_info "Clearing build cache..."
    
    # Clear Vite cache
    rm -rf client/.vite
    rm -rf node_modules/.vite
    rm -rf .vite
    
    # Clear TypeScript build cache
    rm -rf node_modules/typescript/tsbuildinfo
    rm -rf .tsbuildinfo
    
    # Clear npm cache (if safe to do so)
    if [ "$CLEAR_NPM_CACHE" = "true" ]; then
        npm cache clean --force
        log_info "npm cache cleared"
    fi
    
    log_success "Build cache cleared"
}

clean_previous_builds() {
    log_info "Cleaning previous build artifacts..."
    
    # Remove previous build output
    rm -rf dist/public
    rm -rf dist/*.js
    rm -rf dist/*.map
    
    # Create clean build directory
    mkdir -p dist/public
    
    log_success "Previous build artifacts cleaned"
}

# ============= DEPENDENCY VERIFICATION =============

verify_dependencies() {
    log_info "Verifying dependencies..."
    
    # Check if package-lock.json exists for deterministic builds
    if [ -f "package-lock.json" ]; then
        log_success "✓ package-lock.json found - using deterministic install"
        
        # Use npm ci for faster, more reliable installs in CI/CD
        if npm ci --silent; then
            log_success "All dependencies installed successfully"
        else
            log_warning "npm ci failed, falling back to npm install"
            npm install
        fi
    else
        log_warning "package-lock.json not found - using npm install"
        npm install
    fi
    
    # Verify critical packages are installed
    CRITICAL_PACKAGES=(
        "vite"
        "react"
        "react-dom"
        "typescript"
    )
    
    for package in "${CRITICAL_PACKAGES[@]}"; do
        if npm list "$package" >/dev/null 2>&1; then
            log_success "✓ $package is installed"
        else
            log_error "Critical package missing: $package"
            exit 1
        fi
    done
}

# ============= ENVIRONMENT SETUP =============

setup_build_environment() {
    log_info "Setting up build environment..."
    
    # Set production environment
    export NODE_ENV=production
    export GENERATE_SOURCEMAP=false
    export CI=true
    
    # Optimize for Amplify build environment
    export NODE_OPTIONS="--max-old-space-size=4096"
    
    # Set build-specific environment variables
    export VITE_BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    export VITE_BUILD_COMMIT=${AWS_COMMIT_ID:-"unknown"}
    export VITE_BUILD_BRANCH=${AWS_BRANCH:-"unknown"}
    
    log_success "Build environment configured"
}

# ============= SECURITY CHECKS =============

security_audit() {
    log_info "Running security audit..."
    
    # Run npm audit with appropriate handling for CI
    if npm audit --audit-level high --production >/dev/null 2>&1; then
        log_success "✓ No high-severity security vulnerabilities found"
    else
        local audit_exit_code=$?
        if [ $audit_exit_code -eq 1 ]; then
            log_warning "Security vulnerabilities found - check npm audit output"
            # Don't fail the build for vulnerabilities in CI/CD
            if [ "$CI" != "true" ]; then
                npm audit --audit-level high --production
            fi
        else
            log_info "Security audit completed with warnings"
        fi
    fi
}

# ============= BUILD PREPARATION =============

prepare_source_code() {
    log_info "Preparing source code..."
    
    # Ensure all TypeScript files compile
    if npm run check >/dev/null 2>&1; then
        log_success "✓ TypeScript compilation check passed"
    else
        log_error "TypeScript compilation errors found"
        npm run check
        exit 1
    fi
    
    # Verify critical source files exist
    CRITICAL_FILES=(
        "client/src/main.tsx"
        "client/src/App.tsx"
        "client/index.html"
        "vite.config.ts"
    )
    
    for file in "${CRITICAL_FILES[@]}"; do
        if [ ! -f "$file" ]; then
            log_error "Critical source file missing: $file"
            exit 1
        fi
    done
    
    log_success "Source code preparation completed"
}

# ============= MAIN EXECUTION =============

main() {
    log_info "Starting AWS Amplify pre-build process..."
    
    # Environment validation
    ./scripts/amplify/validate-env.sh
    
    # Build preparation
    clear_build_cache
    clean_previous_builds
    setup_build_environment
    
    # Dependency management
    verify_dependencies
    security_audit
    
    # Source code preparation
    prepare_source_code
    
    log_success "Pre-build process completed successfully!"
    log_info "Environment is ready for frontend build"
}

# Run main function if script is executed directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi