#!/bin/bash

# ============= AWS AMPLIFY DEPLOYMENT HELPERS SCRIPT =============
# Utility functions and helpers for AWS Amplify deployment
# Provides common deployment tasks and troubleshooting tools

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[DEPLOY-HELPER]${NC} $1"
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

# ============= DEPLOYMENT VALIDATION =============

validate_amplify_configuration() {
    log_info "Validating AWS Amplify configuration..."
    
    local validation_errors=0
    
    # Check for amplify.yml
    if [ ! -f "amplify.yml" ]; then
        log_error "amplify.yml not found"
        validation_errors=$((validation_errors + 1))
    else
        log_success "✓ amplify.yml found"
        
        # Validate amplify.yml structure
        if grep -q "version: 1" amplify.yml; then
            log_success "✓ amplify.yml version is correct"
        else
            log_warning "amplify.yml may have version issues"
        fi
        
        if grep -q "baseDirectory:" amplify.yml; then
            local base_dir=$(grep "baseDirectory:" amplify.yml | awk '{print $2}')
            log_info "Build output directory: $base_dir"
            
            if [ "$base_dir" != "dist/public" ]; then
                log_warning "Build output directory ($base_dir) doesn't match expected (dist/public)"
            fi
        fi
    fi
    
    # Check for required source files
    local required_files=(
        "package.json"
        "vite.config.ts"
        "client/index.html"
        "client/src/main.tsx"
    )
    
    for file in "${required_files[@]}"; do
        if [ ! -f "$file" ]; then
            log_error "Required file missing: $file"
            validation_errors=$((validation_errors + 1))
        else
            log_success "✓ $file found"
        fi
    done
    
    if [ $validation_errors -eq 0 ]; then
        log_success "Amplify configuration validation passed"
        return 0
    else
        log_error "Amplify configuration validation failed with $validation_errors errors"
        return 1
    fi
}

# ============= BUILD TROUBLESHOOTING =============

diagnose_build_issues() {
    log_info "Diagnosing potential build issues..."
    
    local issues_found=0
    
    # Check Node.js version
    local node_version=$(node --version | cut -d'v' -f2)
    local major_version=$(echo $node_version | cut -d'.' -f1)
    
    if [ $major_version -lt 18 ]; then
        log_warning "Node.js version may be too old: v$node_version (recommend 18+)"
        issues_found=$((issues_found + 1))
    else
        log_success "✓ Node.js version is compatible: v$node_version"
    fi
    
    # Check package.json scripts
    if ! grep -q '"build"' package.json; then
        log_error "No build script found in package.json"
        issues_found=$((issues_found + 1))
    fi
    
    # Check for common dependency issues
    if [ -f "package-lock.json" ]; then
        log_success "✓ package-lock.json found for deterministic builds"
    else
        log_warning "package-lock.json missing - builds may be non-deterministic"
        issues_found=$((issues_found + 1))
    fi
    
    # Check for conflicting files
    if [ -f "yarn.lock" ] && [ -f "package-lock.json" ]; then
        log_warning "Both yarn.lock and package-lock.json found - may cause conflicts"
        issues_found=$((issues_found + 1))
    fi
    
    # Check for large node_modules
    if [ -d "node_modules" ]; then
        local node_modules_size=$(du -sm node_modules 2>/dev/null | cut -f1)
        if [ $node_modules_size -gt 500 ]; then
            log_warning "node_modules is large (${node_modules_size}MB) - may slow builds"
            issues_found=$((issues_found + 1))
        fi
    fi
    
    # Check TypeScript configuration
    if [ -f "tsconfig.json" ]; then
        if ! npm run check >/dev/null 2>&1; then
            log_warning "TypeScript compilation errors detected"
            issues_found=$((issues_found + 1))
        else
            log_success "✓ TypeScript compilation clean"
        fi
    fi
    
    log_info "Build diagnosis completed: $issues_found potential issues found"
    return $issues_found
}

# ============= PERFORMANCE ANALYSIS =============

analyze_build_performance() {
    log_info "Analyzing build performance..."
    
    # Check for performance bottlenecks
    local performance_issues=0
    
    # Large dependencies analysis
    if [ -f "package.json" ]; then
        local dep_count=$(grep -c '"[^"]*":' package.json | head -1)
        log_info "Total dependencies: approximately $dep_count"
        
        if [ $dep_count -gt 100 ]; then
            log_warning "High dependency count may slow builds"
            performance_issues=$((performance_issues + 1))
        fi
    fi
    
    # Source file analysis
    local tsx_files=$(find client/src -name "*.tsx" -o -name "*.ts" 2>/dev/null | wc -l)
    local total_files=$(find client/src -type f 2>/dev/null | wc -l)
    
    log_info "Source files: $total_files total, $tsx_files TypeScript files"
    
    if [ $total_files -gt 1000 ]; then
        log_warning "Large number of source files may slow builds"
        performance_issues=$((performance_issues + 1))
    fi
    
    # Asset analysis
    local asset_files=$(find client/src -name "*.png" -o -name "*.jpg" -o -name "*.svg" 2>/dev/null | wc -l)
    log_info "Asset files: $asset_files"
    
    # Check for large assets
    if command -v find >/dev/null 2>&1; then
        local large_assets=$(find client/src -size +1M 2>/dev/null | wc -l)
        if [ $large_assets -gt 0 ]; then
            log_warning "$large_assets asset files larger than 1MB found"
            performance_issues=$((performance_issues + 1))
        fi
    fi
    
    log_info "Performance analysis completed: $performance_issues potential bottlenecks"
    return $performance_issues
}

# ============= DEPLOYMENT TESTING =============

test_build_locally() {
    log_info "Testing build process locally..."
    
    local build_start_time=$(date +%s)
    
    # Clean previous build
    rm -rf dist/public
    
    # Run build
    if npm run build >/dev/null 2>&1; then
        local build_end_time=$(date +%s)
        local build_duration=$((build_end_time - build_start_time))
        
        log_success "✓ Local build completed in ${build_duration}s"
        
        # Validate build output
        if [ -f "dist/public/index.html" ]; then
            log_success "✓ Build output validated"
            
            # Analyze build size
            local build_size=$(du -sh dist/public 2>/dev/null | cut -f1)
            log_info "Build size: $build_size"
            
            return 0
        else
            log_error "Build output validation failed"
            return 1
        fi
    else
        log_error "Local build failed"
        return 1
    fi
}

# ============= ENVIRONMENT DEBUGGING =============

debug_environment() {
    log_info "Environment debugging information:"
    
    echo "----------------------------------------"
    echo "System Information:"
    echo "  OS: $(uname -s)"
    echo "  Architecture: $(uname -m)"
    echo "  Node.js: $(node --version)"
    echo "  npm: $(npm --version)"
    
    echo ""
    echo "Environment Variables:"
    echo "  NODE_ENV: ${NODE_ENV:-'not set'}"
    echo "  CI: ${CI:-'not set'}"
    echo "  AWS_BRANCH: ${AWS_BRANCH:-'not set'}"
    echo "  AWS_COMMIT_ID: ${AWS_COMMIT_ID:-'not set'}"
    
    echo ""
    echo "Build Configuration:"
    echo "  Working Directory: $(pwd)"
    echo "  Build Output: $([ -d "dist/public" ] && echo "exists" || echo "missing")"
    echo "  Source Files: $([ -d "client/src" ] && echo "exists" || echo "missing")"
    
    echo ""
    echo "Dependencies:"
    echo "  node_modules: $([ -d "node_modules" ] && echo "exists" || echo "missing")"
    echo "  package-lock.json: $([ -f "package-lock.json" ] && echo "exists" || echo "missing")"
    
    echo ""
    echo "Amplify Configuration:"
    echo "  amplify.yml: $([ -f "amplify.yml" ] && echo "exists" || echo "missing")"
    echo "  Custom Scripts: $([ -d "scripts/amplify" ] && echo "exists" || echo "missing")"
    echo "----------------------------------------"
}

# ============= DEPLOYMENT CLEANUP =============

cleanup_deployment() {
    log_info "Cleaning up deployment artifacts..."
    
    # Remove temporary files
    find . -name ".DS_Store" -type f -delete 2>/dev/null || true
    find . -name "Thumbs.db" -type f -delete 2>/dev/null || true
    find . -name "*.tmp" -type f -delete 2>/dev/null || true
    
    # Clean build cache
    rm -rf .vite 2>/dev/null || true
    rm -rf client/.vite 2>/dev/null || true
    rm -rf node_modules/.vite 2>/dev/null || true
    
    # Clean TypeScript cache
    rm -rf .tsbuildinfo 2>/dev/null || true
    rm -rf node_modules/typescript/tsbuildinfo 2>/dev/null || true
    
    log_success "Deployment cleanup completed"
}

# ============= HEALTH CHECKS =============

run_deployment_health_check() {
    log_info "Running deployment health checks..."
    
    local health_score=0
    local total_checks=5
    
    # Check 1: Configuration validation
    if validate_amplify_configuration >/dev/null 2>&1; then
        health_score=$((health_score + 1))
        log_success "✓ Configuration validation passed"
    else
        log_warning "✗ Configuration validation failed"
    fi
    
    # Check 2: Build test
    if test_build_locally >/dev/null 2>&1; then
        health_score=$((health_score + 1))
        log_success "✓ Local build test passed"
    else
        log_warning "✗ Local build test failed"
    fi
    
    # Check 3: Dependency check
    if npm audit --audit-level high >/dev/null 2>&1; then
        health_score=$((health_score + 1))
        log_success "✓ Dependency security check passed"
    else
        log_warning "✗ Dependency security issues found"
    fi
    
    # Check 4: TypeScript check
    if npm run check >/dev/null 2>&1; then
        health_score=$((health_score + 1))
        log_success "✓ TypeScript compilation check passed"
    else
        log_warning "✗ TypeScript compilation errors found"
    fi
    
    # Check 5: Performance analysis
    if analyze_build_performance >/dev/null 2>&1; then
        health_score=$((health_score + 1))
        log_success "✓ Performance analysis completed"
    else
        log_warning "✗ Performance issues detected"
    fi
    
    local health_percentage=$((health_score * 100 / total_checks))
    log_info "Deployment health: $health_score/$total_checks checks passed (${health_percentage}%)"
    
    if [ $health_percentage -ge 80 ]; then
        log_success "Deployment is healthy and ready"
        return 0
    elif [ $health_percentage -ge 60 ]; then
        log_warning "Deployment has some issues but should work"
        return 0
    else
        log_error "Deployment has significant issues"
        return 1
    fi
}

# ============= MAIN EXECUTION =============

show_help() {
    echo "AWS Amplify Deployment Helpers"
    echo ""
    echo "Usage: ./scripts/amplify/deploy-helpers.sh [command]"
    echo ""
    echo "Commands:"
    echo "  validate       - Validate Amplify configuration"
    echo "  diagnose       - Diagnose potential build issues"
    echo "  test-build     - Test build process locally"
    echo "  performance    - Analyze build performance"
    echo "  debug          - Show environment debugging info"
    echo "  health-check   - Run comprehensive health check"
    echo "  cleanup        - Clean up deployment artifacts"
    echo ""
    echo "Examples:"
    echo "  ./scripts/amplify/deploy-helpers.sh validate"
    echo "  ./scripts/amplify/deploy-helpers.sh health-check"
    echo "  ./scripts/amplify/deploy-helpers.sh debug"
}

main() {
    local command="${1:-help}"
    
    case "$command" in
        "validate")
            validate_amplify_configuration
            ;;
        "diagnose")
            diagnose_build_issues
            ;;
        "test-build")
            test_build_locally
            ;;
        "performance")
            analyze_build_performance
            ;;
        "debug")
            debug_environment
            ;;
        "health-check")
            run_deployment_health_check
            ;;
        "cleanup")
            cleanup_deployment
            ;;
        "help"|"--help"|"-h")
            show_help
            ;;
        *)
            log_error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

# Run main function if script is executed directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi