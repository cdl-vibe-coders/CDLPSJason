#!/bin/bash

# ============= AWS AMPLIFY BUILD OPTIMIZATION SCRIPT =============
# Advanced optimization script for AWS Amplify deployments
# Handles performance optimizations, bundle analysis, and CDN preparation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[OPTIMIZE]${NC} $1"
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

BUILD_DIR="dist/public"
OPTIMIZATION_REPORT="$BUILD_DIR/.optimization-report.json"

# ============= BUNDLE ANALYSIS =============

analyze_bundle_size() {
    log_info "Analyzing bundle size..."
    
    if [ ! -d "$BUILD_DIR/assets" ]; then
        log_warning "Assets directory not found - skipping bundle analysis"
        return 0
    fi
    
    local js_files=($(find "$BUILD_DIR/assets" -name "*.js" -type f))
    local css_files=($(find "$BUILD_DIR/assets" -name "*.css" -type f))
    
    local total_js_size=0
    local total_css_size=0
    local largest_js=""
    local largest_js_size=0
    local largest_css=""
    local largest_css_size=0
    
    # Analyze JavaScript files
    for file in "${js_files[@]}"; do
        if [ -f "$file" ]; then
            local size=$(wc -c < "$file" 2>/dev/null || echo 0)
            total_js_size=$((total_js_size + size))
            
            if [ $size -gt $largest_js_size ]; then
                largest_js_size=$size
                largest_js=$(basename "$file")
            fi
        fi
    done
    
    # Analyze CSS files
    for file in "${css_files[@]}"; do
        if [ -f "$file" ]; then
            local size=$(wc -c < "$file" 2>/dev/null || echo 0)
            total_css_size=$((total_css_size + size))
            
            if [ $size -gt $largest_css_size ]; then
                largest_css_size=$size
                largest_css=$(basename "$file")
            fi
        fi
    done
    
    # Convert bytes to human readable format
    local js_size_mb=$(echo "scale=2; $total_js_size / 1024 / 1024" | bc 2>/dev/null || echo "0")
    local css_size_mb=$(echo "scale=2; $total_css_size / 1024 / 1024" | bc 2>/dev/null || echo "0")
    local largest_js_kb=$(echo "scale=2; $largest_js_size / 1024" | bc 2>/dev/null || echo "0")
    local largest_css_kb=$(echo "scale=2; $largest_css_size / 1024" | bc 2>/dev/null || echo "0")
    
    log_info "Bundle Analysis:"
    log_info "  JavaScript: ${js_size_mb}MB (${#js_files[@]} files)"
    log_info "  CSS: ${css_size_mb}MB (${#css_files[@]} files)"
    log_info "  Largest JS: $largest_js (${largest_js_kb}KB)"
    log_info "  Largest CSS: $largest_css (${largest_css_kb}KB)"
    
    # Performance warnings
    if [ "$total_js_size" -gt 2097152 ]; then # 2MB
        log_warning "JavaScript bundle size is large (${js_size_mb}MB) - consider code splitting"
    fi
    
    if [ "$largest_js_size" -gt 1048576 ]; then # 1MB
        log_warning "Largest JS file is ${largest_js_kb}KB - consider chunking"
    fi
    
    log_success "Bundle analysis completed"
}

# ============= COMPRESSION OPTIMIZATION =============

optimize_compression() {
    log_info "Optimizing compression for CDN delivery..."
    
    local files_compressed=0
    local total_savings=0
    
    # Compress text-based assets
    find "$BUILD_DIR" \( -name "*.js" -o -name "*.css" -o -name "*.html" -o -name "*.json" -o -name "*.xml" -o -name "*.txt" \) -type f | while read file; do
        if [ -f "$file" ]; then
            local original_size=$(wc -c < "$file")
            
            # Only compress files larger than 512 bytes
            if [ $original_size -gt 512 ]; then
                # Create gzip version
                if command -v gzip >/dev/null 2>&1; then
                    gzip -9 -c "$file" > "$file.gz"
                    local compressed_size=$(wc -c < "$file.gz" 2>/dev/null || echo $original_size)
                    local savings=$((original_size - compressed_size))
                    
                    if [ $savings -gt 0 ]; then
                        files_compressed=$((files_compressed + 1))
                        total_savings=$((total_savings + savings))
                        
                        local compression_ratio=$(echo "scale=1; $compressed_size * 100 / $original_size" | bc 2>/dev/null || echo "100")
                        log_info "  Compressed $(basename "$file"): ${compression_ratio}% of original"
                    else
                        # Remove if no savings
                        rm -f "$file.gz"
                    fi
                fi
                
                # Create brotli version if available
                if command -v brotli >/dev/null 2>&1; then
                    brotli -9 -c "$file" > "$file.br" 2>/dev/null || rm -f "$file.br"
                fi
            fi
        fi
    done
    
    local savings_kb=$(echo "scale=2; $total_savings / 1024" | bc 2>/dev/null || echo "0")
    log_success "Compression optimization completed: $files_compressed files, ${savings_kb}KB saved"
}

# ============= CACHE OPTIMIZATION =============

optimize_caching() {
    log_info "Optimizing files for CDN caching..."
    
    # Create cache manifest for long-term caching
    local cache_manifest="$BUILD_DIR/.cache-manifest.json"
    local static_assets=()
    local dynamic_assets=()
    
    # Categorize assets for caching strategy
    find "$BUILD_DIR" -type f -name "*.js" -o -name "*.css" -o -name "*.png" -o -name "*.jpg" -o -name "*.svg" -o -name "*.woff2" | while read file; do
        local filename=$(basename "$file")
        local relative_path=${file#$BUILD_DIR/}
        
        # Assets with hashes can be cached indefinitely
        if [[ $filename =~ \.[a-f0-9]{8}\. ]]; then
            echo "\"$relative_path\"" >> "$BUILD_DIR/.static-assets.tmp"
        else
            echo "\"$relative_path\"" >> "$BUILD_DIR/.dynamic-assets.tmp"
        fi
    done
    
    # Create cache manifest
    cat > "$cache_manifest" << EOF
{
  "staticAssets": [
    $(cat "$BUILD_DIR/.static-assets.tmp" 2>/dev/null | tr '\n' ',' | sed 's/,$//')
  ],
  "dynamicAssets": [
    $(cat "$BUILD_DIR/.dynamic-assets.tmp" 2>/dev/null | tr '\n' ',' | sed 's/,$//')
  ],
  "generated": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
    
    # Clean up temporary files
    rm -f "$BUILD_DIR/.static-assets.tmp" "$BUILD_DIR/.dynamic-assets.tmp"
    
    log_success "Cache optimization completed"
}

# ============= SECURITY HEADERS =============

prepare_security_headers() {
    log_info "Preparing security headers configuration..."
    
    # Create _headers file for Amplify
    cat > "$BUILD_DIR/_headers" << 'EOF'
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()

/*.js
  Cache-Control: public, max-age=31536000, immutable

/*.css
  Cache-Control: public, max-age=31536000, immutable

/*.png
  Cache-Control: public, max-age=31536000

/*.jpg
  Cache-Control: public, max-age=31536000

/*.svg
  Cache-Control: public, max-age=31536000

/index.html
  Cache-Control: public, max-age=300

/*.html
  Cache-Control: public, max-age=300
EOF
    
    log_success "Security headers configuration created"
}

# ============= PERFORMANCE RECOMMENDATIONS =============

generate_performance_report() {
    log_info "Generating performance recommendations..."
    
    local total_size=$(du -sb "$BUILD_DIR" 2>/dev/null | cut -f1 || echo 0)
    local file_count=$(find "$BUILD_DIR" -type f | wc -l)
    
    # Calculate metrics
    local total_size_mb=$(echo "scale=2; $total_size / 1024 / 1024" | bc 2>/dev/null || echo "0")
    local js_count=$(find "$BUILD_DIR" -name "*.js" | wc -l)
    local css_count=$(find "$BUILD_DIR" -name "*.css" | wc -l)
    local image_count=$(find "$BUILD_DIR" \( -name "*.png" -o -name "*.jpg" -o -name "*.svg" \) | wc -l)
    
    # Generate recommendations
    local recommendations=()
    
    if [ "$total_size" -gt 10485760 ]; then # 10MB
        recommendations+=("\"Consider reducing bundle size (current: ${total_size_mb}MB)\"")
    fi
    
    if [ "$js_count" -gt 10 ]; then
        recommendations+=("\"Consider consolidating JavaScript files (current: $js_count files)\"")
    fi
    
    if [ "$css_count" -gt 5 ]; then
        recommendations+=("\"Consider consolidating CSS files (current: $css_count files)\"")
    fi
    
    # Create optimization report
    cat > "$OPTIMIZATION_REPORT" << EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "metrics": {
    "totalSize": "$total_size",
    "totalSizeMB": "$total_size_mb",
    "fileCount": $file_count,
    "jsFiles": $js_count,
    "cssFiles": $css_count,
    "imageFiles": $image_count
  },
  "recommendations": [
    $(IFS=','; echo "${recommendations[*]}")
  ],
  "optimizations": {
    "compressionEnabled": true,
    "cacheOptimized": true,
    "securityHeadersConfigured": true
  }
}
EOF
    
    log_success "Performance report generated: .optimization-report.json"
}

# ============= MAIN EXECUTION =============

main() {
    log_info "Starting AWS Amplify build optimization..."
    
    if [ ! -d "$BUILD_DIR" ]; then
        log_error "Build directory not found: $BUILD_DIR"
        exit 1
    fi
    
    analyze_bundle_size
    optimize_compression
    optimize_caching
    prepare_security_headers
    generate_performance_report
    
    log_success "Build optimization completed successfully!"
    log_info "Optimized build ready for AWS Amplify deployment"
    
    # Display summary
    if [ -f "$OPTIMIZATION_REPORT" ]; then
        local total_size_mb=$(grep -o '"totalSizeMB": "[^"]*"' "$OPTIMIZATION_REPORT" | cut -d'"' -f4)
        local file_count=$(grep -o '"fileCount": [0-9]*' "$OPTIMIZATION_REPORT" | cut -d':' -f2 | tr -d ' ')
        
        log_info "Final build: ${total_size_mb}MB, $file_count files"
    fi
}

# Run main function if script is executed directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi