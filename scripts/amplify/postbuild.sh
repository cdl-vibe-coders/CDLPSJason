#!/bin/bash

# ============= AWS AMPLIFY POST-BUILD SCRIPT =============
# Validation and optimization script that runs after the main build process
# Verifies build output, optimizes assets, and prepares for deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[POSTBUILD]${NC} $1"
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

# ============= BUILD VALIDATION =============

validate_build_output() {
    log_info "Validating build output..."
    
    local BUILD_DIR="dist/public"
    local validation_errors=0
    
    # Check if build directory exists
    if [ ! -d "$BUILD_DIR" ]; then
        log_error "Build directory missing: $BUILD_DIR"
        exit 1
    fi
    
    # Check for essential files
    REQUIRED_FILES=(
        "$BUILD_DIR/index.html"
    )
    
    for file in "${REQUIRED_FILES[@]}"; do
        if [ ! -f "$file" ]; then
            log_error "Required file missing: $file"
            validation_errors=$((validation_errors + 1))
        else
            log_success "✓ $(basename $file) found"
        fi
    done
    
    # Check if assets directory exists (optional but expected)
    if [ -d "$BUILD_DIR/assets" ]; then
        log_success "✓ Assets directory found"
        
        # Count and validate assets
        JS_COUNT=$(find "$BUILD_DIR/assets" -name "*.js" | wc -l)
        CSS_COUNT=$(find "$BUILD_DIR/assets" -name "*.css" | wc -l)
        
        log_info "Assets found: $JS_COUNT JavaScript files, $CSS_COUNT CSS files"
        
        if [ $JS_COUNT -eq 0 ]; then
            log_warning "No JavaScript files found in assets"
        fi
        
        if [ $CSS_COUNT -eq 0 ]; then
            log_warning "No CSS files found in assets"
        fi
    else
        log_warning "Assets directory not found - this may be normal for some builds"
    fi
    
    # Validate index.html content
    if [ -f "$BUILD_DIR/index.html" ]; then
        if grep -q "<div id=\"root\">" "$BUILD_DIR/index.html"; then
            log_success "✓ index.html contains React root element"
        else
            log_warning "index.html may be missing React root element"
        fi
        
        if grep -q "script" "$BUILD_DIR/index.html"; then
            log_success "✓ index.html includes script references"
        else
            log_warning "index.html may be missing script references"
        fi
    fi
    
    if [ $validation_errors -gt 0 ]; then
        log_error "Build validation failed with $validation_errors errors"
        exit 1
    fi
    
    log_success "Build output validation passed"
}

# ============= ASSET OPTIMIZATION =============

optimize_assets() {
    log_info "Optimizing build assets..."
    
    local BUILD_DIR="dist/public"
    
    # Remove source maps in production (reduces bundle size)
    find "$BUILD_DIR" -name "*.map" -type f -delete 2>/dev/null || true
    log_info "Source maps removed"
    
    # Remove development-only files
    find "$BUILD_DIR" -name ".DS_Store" -type f -delete 2>/dev/null || true
    find "$BUILD_DIR" -name "Thumbs.db" -type f -delete 2>/dev/null || true
    
    # Pre-compress assets for better CDN performance
    if command -v gzip >/dev/null 2>&1; then
        log_info "Pre-compressing assets with gzip..."
        
        find "$BUILD_DIR" \( -name "*.js" -o -name "*.css" -o -name "*.html" -o -name "*.json" \) -type f | while read file; do
            # Only compress files larger than 1KB
            if [ -f "$file" ] && [ $(wc -c < "$file") -gt 1024 ]; then
                gzip -9 -c "$file" > "$file.gz"
                log_info "Compressed: $(basename "$file")"
            fi
        done
    else
        log_warning "gzip not available - skipping asset compression"
    fi
    
    log_success "Asset optimization completed"
}

# ============= BUILD ANALYSIS =============

analyze_build() {
    log_info "Analyzing build output..."
    
    local BUILD_DIR="dist/public"
    
    # Calculate total build size
    if command -v du >/dev/null 2>&1; then
        local TOTAL_SIZE=$(du -sh "$BUILD_DIR" 2>/dev/null | cut -f1 || echo "unknown")
        log_info "Total build size: $TOTAL_SIZE"
    fi
    
    # Count files
    local TOTAL_FILES=$(find "$BUILD_DIR" -type f | wc -l)
    log_info "Total files: $TOTAL_FILES"
    
    # Analyze largest assets
    if [ -d "$BUILD_DIR/assets" ]; then
        log_info "Largest assets:"
        find "$BUILD_DIR/assets" -type f -exec ls -lh {} \; 2>/dev/null | sort -k5 -hr | head -5 | while read line; do
            local size=$(echo $line | awk '{print $5}')
            local file=$(echo $line | awk '{print $9}')
            local filename=$(basename "$file")
            log_info "  $filename: $size"
        done
    fi
    
    # Check for potential issues
    local LARGE_FILES=$(find "$BUILD_DIR" -type f -size +5M 2>/dev/null | wc -l)
    if [ $LARGE_FILES -gt 0 ]; then
        log_warning "$LARGE_FILES files larger than 5MB found - consider optimization"
    fi
    
    log_success "Build analysis completed"
}

# ============= DEPLOYMENT PREPARATION =============

prepare_for_deployment() {
    log_info "Preparing for AWS Amplify deployment..."
    
    local BUILD_DIR="dist/public"
    
    # Create deployment manifest
    cat > "$BUILD_DIR/.deployment-info.json" << EOF
{
  "buildTime": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "environment": "${NODE_ENV:-production}",
  "commit": "${AWS_COMMIT_ID:-unknown}",
  "branch": "${AWS_BRANCH:-unknown}",
  "buildTool": "vite",
  "deploymentTarget": "aws-amplify"
}
EOF
    
    # Ensure proper permissions
    find "$BUILD_DIR" -type f -exec chmod 644 {} \; 2>/dev/null || true
    find "$BUILD_DIR" -type d -exec chmod 755 {} \; 2>/dev/null || true
    
    # Create health check file for deployment validation
    echo "OK" > "$BUILD_DIR/.health"
    
    log_success "Deployment preparation completed"
}

# ============= FINAL VALIDATION =============

final_deployment_check() {
    log_info "Running final deployment check..."
    
    local BUILD_DIR="dist/public"
    local check_errors=0
    
    # Verify all critical files are in place
    if [ ! -f "$BUILD_DIR/index.html" ]; then
        log_error "Critical file missing: index.html"
        check_errors=$((check_errors + 1))
    fi
    
    # Verify index.html is not empty
    if [ -f "$BUILD_DIR/index.html" ] && [ ! -s "$BUILD_DIR/index.html" ]; then
        log_error "index.html is empty"
        check_errors=$((check_errors + 1))
    fi
    
    # Check for reasonable file count (should have at least a few files)
    local FILE_COUNT=$(find "$BUILD_DIR" -type f | wc -l)
    if [ $FILE_COUNT -lt 2 ]; then
        log_error "Too few files in build output ($FILE_COUNT)"
        check_errors=$((check_errors + 1))
    fi
    
    if [ $check_errors -gt 0 ]; then
        log_error "Final deployment check failed with $check_errors errors"
        exit 1
    fi
    
    log_success "Final deployment check passed"
    log_success "Build is ready for AWS Amplify deployment!"
}

# ============= MAIN EXECUTION =============

main() {
    log_info "Starting AWS Amplify post-build process..."
    
    validate_build_output
    optimize_assets
    analyze_build
    prepare_for_deployment
    final_deployment_check
    
    log_success "Post-build process completed successfully!"
    log_info "Build artifacts are optimized and ready for deployment"
}

# Run main function if script is executed directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi