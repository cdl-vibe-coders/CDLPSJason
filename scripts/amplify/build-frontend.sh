#!/bin/bash

# ============= AWS AMPLIFY FRONTEND BUILD SCRIPT =============
# Optimized frontend-only build for AWS Amplify deployment
# This script builds only the frontend (React/Vite) for static hosting
# Backend components are excluded as Amplify hosts static files only

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[BUILD]${NC} $1"
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

# ============= BUILD CONFIGURATION =============

# Set production environment for optimized builds
export NODE_ENV=production

# Build output directory (matches amplify.yml configuration)
BUILD_OUTPUT="dist/public"

# ============= BUILD PREPARATION =============

prepare_build() {
    log_info "Preparing frontend build for AWS Amplify..."
    
    # Verify Node.js version
    NODE_VERSION=$(node --version)
    log_info "Node.js version: $NODE_VERSION"
    
    # Verify npm version
    NPM_VERSION=$(npm --version)
    log_info "npm version: $NPM_VERSION"
    
    # Clean previous build artifacts
    log_info "Cleaning previous build artifacts..."
    rm -rf "$BUILD_OUTPUT"
    rm -rf client/.vite
    rm -rf node_modules/.vite
    
    # Ensure build directory exists
    mkdir -p "$BUILD_OUTPUT"
    
    log_success "Build preparation completed"
}

# ============= FRONTEND BUILD =============

build_frontend() {
    log_info "Building frontend application..."
    
    # Run Vite build (frontend only)
    # This builds the React app to dist/public as configured in vite.config.ts
    if npx vite build; then
        log_success "Frontend build completed successfully"
    else
        log_error "Frontend build failed"
        exit 1
    fi
}

# ============= BUILD VALIDATION =============

validate_build() {
    log_info "Validating build output..."
    
    # Check if build output directory exists
    if [ ! -d "$BUILD_OUTPUT" ]; then
        log_error "Build output directory missing: $BUILD_OUTPUT"
        exit 1
    fi
    
    # Check if index.html exists
    if [ ! -f "$BUILD_OUTPUT/index.html" ]; then
        log_error "index.html missing from build output"
        exit 1
    fi
    
    # Check if assets directory exists
    if [ ! -d "$BUILD_OUTPUT/assets" ]; then
        log_warning "Assets directory missing - this may be normal for some builds"
    fi
    
    # Count build files
    FILE_COUNT=$(find "$BUILD_OUTPUT" -type f | wc -l)
    BUILD_SIZE=$(du -sh "$BUILD_OUTPUT" | cut -f1)
    
    log_success "Build validation passed"
    log_info "Build output: $FILE_COUNT files, $BUILD_SIZE total size"
    
    # List main build artifacts
    log_info "Build artifacts:"
    ls -la "$BUILD_OUTPUT/" | head -10
    
    if [ -d "$BUILD_OUTPUT/assets" ]; then
        echo "Assets:"
        ls -la "$BUILD_OUTPUT/assets/" | head -5
    fi
}

# ============= BUILD OPTIMIZATION =============

optimize_build() {
    log_info "Applying build optimizations..."
    
    # Remove unnecessary files for Amplify deployment
    find "$BUILD_OUTPUT" -name "*.map" -type f -delete 2>/dev/null || true
    find "$BUILD_OUTPUT" -name ".DS_Store" -type f -delete 2>/dev/null || true
    
    # Compress large assets if gzip is available
    if command -v gzip >/dev/null 2>&1; then
        log_info "Pre-compressing assets with gzip..."
        find "$BUILD_OUTPUT" -name "*.js" -o -name "*.css" -o -name "*.html" | while read file; do
            if [ -f "$file" ] && [ $(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo 0) -gt 1024 ]; then
                gzip -9 -c "$file" > "$file.gz"
            fi
        done 2>/dev/null || true
    fi
    
    log_success "Build optimization completed"
}

# ============= MAIN EXECUTION =============

main() {
    log_info "Starting AWS Amplify frontend build process..."
    
    prepare_build
    build_frontend
    validate_build
    optimize_build
    
    log_success "Frontend build completed successfully for AWS Amplify!"
    log_info "Build artifacts ready in: $BUILD_OUTPUT"
}

# Run main function
main "$@"