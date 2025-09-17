#!/bin/bash

# ============= MODULE BUILD SCRIPT =============
# Build individual modules for deployment
# Usage: ./scripts/build/build-module.sh <module-name> [mode]
#   module-name: admin, users, or all
#   mode: standalone, monolith (default: standalone)

set -e

MODULE_NAME="${1:-all}"
BUILD_MODE="${2:-standalone}"
BUILD_DIR="dist"
PACKAGE_DIR="packages"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
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

check_dependencies() {
    log_info "Checking build dependencies..."
    
    if ! command -v npm &> /dev/null; then
        log_error "npm is required but not installed"
        exit 1
    fi
    
    if ! command -v node &> /dev/null; then
        log_error "node is required but not installed"
        exit 1
    fi
    
    # esbuild will be available via npx from node_modules, no global check needed
    
    log_success "All dependencies are available"
}

clean_build() {
    log_info "Cleaning previous build artifacts..."
    rm -rf "$BUILD_DIR"
    rm -rf "$PACKAGE_DIR"
    mkdir -p "$BUILD_DIR"
    mkdir -p "$PACKAGE_DIR"
    log_success "Build directories cleaned"
}

# ============= MODULE BUILD FUNCTIONS =============

build_shared_dependencies() {
    log_info "Building shared dependencies..."
    
    # Copy shared files that all modules need
    mkdir -p "$BUILD_DIR/shared"
    cp -r shared/* "$BUILD_DIR/shared/"
    
    # Copy package.json for dependencies
    cp package.json "$BUILD_DIR/"
    cp package-lock.json "$BUILD_DIR/" 2>/dev/null || true
    
    log_success "Shared dependencies prepared"
}

build_single_module() {
    local module_name=$1
    local output_dir="$BUILD_DIR/$module_name"
    
    log_info "Building module: $module_name"
    
    # Validate module exists
    if [ ! -d "server/modules/$module_name" ]; then
        log_error "Module $module_name does not exist"
        exit 1
    fi
    
    # Create module-specific build directory
    mkdir -p "$output_dir"
    
    # Copy module-specific files
    cp -r "server/modules/$module_name" "$output_dir/module"
    
    # Copy core server files needed for the module
    mkdir -p "$output_dir/server"
    cp -r server/communication "$output_dir/server/"
    cp -r server/middleware "$output_dir/server/"
    cp -r server/registry "$output_dir/server/"
    cp -r server/storage "$output_dir/server/"
    cp -r server/types "$output_dir/server/"
    cp server/db.ts "$output_dir/server/"
    
    # Copy standalone runner specific to this module
    if [ -f "server/standalone/$module_name.ts" ]; then
        cp "server/standalone/$module_name.ts" "$output_dir/server/"
    fi
    
    # Create module-specific package.json
    create_module_package_json "$module_name" "$output_dir"
    
    # Build the module using esbuild
    log_info "Compiling $module_name module..."
    
    if [ "$BUILD_MODE" = "standalone" ]; then
        # Build standalone entry point
        npx esbuild "server/standalone/$module_name.ts" \
            --platform=node \
            --packages=external \
            --bundle \
            --format=esm \
            --outdir="$output_dir" \
            --metafile="$output_dir/meta.json"
    else
        # Build module bootstrap for monolith
        npx esbuild "server/modules/$module_name/bootstrap.ts" \
            --platform=node \
            --packages=external \
            --bundle \
            --format=esm \
            --outdir="$output_dir" \
            --metafile="$output_dir/meta.json"
    fi
    
    # Copy environment and configuration templates
    if [ -f "deployment/config/$module_name.env.template" ]; then
        cp "deployment/config/$module_name.env.template" "$output_dir/.env.template"
    fi
    
    log_success "Module $module_name built successfully"
}

create_module_package_json() {
    local module_name=$1
    local output_dir=$2
    
    log_info "Creating package.json for $module_name module..."
    
    # Read the original package.json and create a minimal one for the module
    cat > "$output_dir/package.json" << EOF
{
  "name": "@app/$module_name-module",
  "version": "1.0.0",
  "type": "module",
  "main": "$module_name.js",
  "scripts": {
    "start": "NODE_ENV=production node $module_name.js",
    "dev": "NODE_ENV=development node $module_name.js"
  },
  "dependencies": {
    "express": "^4.21.2",
    "cookie-parser": "^1.4.7",
    "bcrypt": "^6.0.0",
    "drizzle-orm": "^0.39.1",
    "@neondatabase/serverless": "^0.10.4",
    "zod": "^3.24.2",
    "zod-validation-error": "^3.4.0"
  }
}
EOF
    
    log_success "Package.json created for $module_name"
}

package_module() {
    local module_name=$1
    local package_path="$PACKAGE_DIR/$module_name-module.tar.gz"
    
    log_info "Packaging $module_name module..."
    
    cd "$BUILD_DIR"
    tar -czf "../$package_path" "$module_name/"
    cd ..
    
    # Create deployment info
    cat > "$PACKAGE_DIR/$module_name-deployment-info.json" << EOF
{
  "module": "$module_name",
  "version": "1.0.0",
  "buildMode": "$BUILD_MODE",
  "buildTime": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "package": "$module_name-module.tar.gz",
  "entryPoint": "$module_name.js",
  "healthEndpoint": "/health"
}
EOF
    
    log_success "Module $module_name packaged: $package_path"
}

# ============= BUILD ORCHESTRATION =============

build_monolith() {
    log_info "Building monolith deployment..."
    
    # Copy entire server structure
    cp -r server "$BUILD_DIR/"
    cp -r client "$BUILD_DIR/"
    
    # Build frontend
    log_info "Building frontend..."
    npm run build
    
    # Build backend
    log_info "Building backend..."
    npx esbuild server/index.ts \
        --platform=node \
        --packages=external \
        --bundle \
        --format=esm \
        --outdir="$BUILD_DIR" \
        --metafile="$BUILD_DIR/meta.json"
    
    # Package monolith
    cd "$BUILD_DIR"
    tar -czf "../$PACKAGE_DIR/monolith-app.tar.gz" .
    cd ..
    
    log_success "Monolith build completed"
}

# ============= MAIN EXECUTION =============

main() {
    log_info "Starting build process..."
    log_info "Module: $MODULE_NAME, Mode: $BUILD_MODE"
    
    check_dependencies
    clean_build
    build_shared_dependencies
    
    case "$MODULE_NAME" in
        "all")
            if [ "$BUILD_MODE" = "monolith" ]; then
                build_monolith
            else
                # Build all modules as standalone
                for module in admin users; do
                    if [ -d "server/modules/$module" ]; then
                        build_single_module "$module"
                        package_module "$module"
                    else
                        log_warning "Module $module not found, skipping..."
                    fi
                done
            fi
            ;;
        "admin"|"users")
            if [ "$BUILD_MODE" = "monolith" ]; then
                log_error "Cannot build single module in monolith mode. Use 'all' for monolith builds."
                exit 1
            fi
            build_single_module "$MODULE_NAME"
            package_module "$MODULE_NAME"
            ;;
        *)
            log_error "Unknown module: $MODULE_NAME"
            log_error "Available modules: admin, users, all"
            exit 1
            ;;
    esac
    
    log_success "Build process completed successfully!"
    log_info "Build artifacts available in: $BUILD_DIR"
    log_info "Deployment packages available in: $PACKAGE_DIR"
}

# Run main function
main "$@"