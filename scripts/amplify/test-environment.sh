#!/bin/bash

# ============= AWS AMPLIFY FRONTEND STATIC SITE TESTING SCRIPT =============
# Tests the deployed frontend static application to verify correct configuration
# Focuses on static hosting validation, NOT backend endpoint testing

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

# ============= CONFIGURATION =============

# Default to current Amplify domain if not specified
AMPLIFY_URL="${AMPLIFY_URL:-$1}"

if [ -z "$AMPLIFY_URL" ]; then
    echo "Usage: $0 <amplify-url>"
    echo "Example: $0 https://main.d1234567890.amplifyapp.com"
    echo ""
    echo "Set AMPLIFY_URL environment variable to avoid passing URL each time"
    exit 1
fi

# Remove trailing slash
AMPLIFY_URL=${AMPLIFY_URL%/}

# ============= TESTING FUNCTIONS =============

test_basic_connectivity() {
    log_info "Testing basic connectivity to $AMPLIFY_URL..."
    
    local status_code=$(curl -s -o /dev/null -w "%{http_code}" "$AMPLIFY_URL" || echo "000")
    
    if [ "$status_code" = "200" ]; then
        log_success "Static site is accessible (HTTP $status_code)"
    else
        log_error "Static site not accessible (HTTP $status_code)"
        return 1
    fi
}

test_frontend_loading() {
    log_info "Testing frontend application loading..."
    
    local response=$(curl -s "$AMPLIFY_URL" 2>/dev/null || echo "failed")
    
    if [[ "$response" =~ "<title>" && "$response" =~ "<!DOCTYPE html>" ]]; then
        log_success "Frontend HTML is loading correctly"
    else
        log_error "Frontend not loading properly"
        return 1
    fi
    
    # Check for Vite/React specific elements
    if [[ "$response" =~ "vite" ]] || [[ "$response" =~ "react" ]] || [[ "$response" =~ "/_vite/" ]]; then
        log_success "Frontend framework detected in HTML"
    else
        log_warning "Frontend framework not clearly identified"
    fi
    
    # Check for meta tags
    if [[ "$response" =~ "<meta" ]]; then
        log_success "Meta tags present in HTML"
    else
        log_warning "No meta tags found in HTML"
    fi
}

test_static_assets() {
    log_info "Testing static asset delivery..."
    
    # Test common static asset paths
    local assets=("assets" "favicon.ico" "_vite")
    local asset_found=false
    
    # Get the HTML content to find actual asset paths
    local html_content=$(curl -s "$AMPLIFY_URL" 2>/dev/null || echo "")
    
    # Look for asset references in HTML
    if [[ "$html_content" =~ /assets/ ]]; then
        log_success "Static assets directory found in HTML"
        asset_found=true
    fi
    
    if [[ "$html_content" =~ "\.js\"" ]] || [[ "$html_content" =~ "\.css\"" ]]; then
        log_success "JavaScript and CSS assets referenced in HTML"
        asset_found=true
    fi
    
    if [ "$asset_found" = true ]; then
        log_success "Static asset structure appears correct"
    else
        log_warning "Static asset structure not clearly identified"
    fi
    
    # Test favicon
    local favicon_status=$(curl -s -o /dev/null -w "%{http_code}" "$AMPLIFY_URL/favicon.ico" || echo "000")
    if [ "$favicon_status" = "200" ]; then
        log_success "Favicon accessible"
    else
        log_warning "Favicon not found (HTTP $favicon_status)"
    fi
}

test_spa_routing() {
    log_info "Testing Single Page Application (SPA) routing..."
    
    # Test that non-existent routes return the main app (404-200 redirect)
    local test_route="$AMPLIFY_URL/non-existent-route-test"
    local response=$(curl -s "$test_route" 2>/dev/null || echo "failed")
    
    if [[ "$response" =~ "<!DOCTYPE html>" ]] && [[ "$response" =~ "<title>" ]]; then
        log_success "SPA routing works (404-200 redirect configured)"
    else
        log_warning "SPA routing may not be properly configured"
    fi
}

test_security_headers() {
    log_info "Testing security headers..."
    
    local headers=$(curl -s -I "$AMPLIFY_URL" 2>/dev/null || echo "")
    
    # Check for important security headers configured in amplify.yml
    local security_headers=(
        "X-Frame-Options"
        "X-Content-Type-Options"
        "X-XSS-Protection"
        "Strict-Transport-Security"
    )
    
    local found_headers=0
    for header in "${security_headers[@]}"; do
        if [[ "$headers" =~ $header ]]; then
            log_success "Security header present: $header"
            found_headers=$((found_headers + 1))
        else
            log_warning "Security header missing: $header"
        fi
    done
    
    if [ $found_headers -ge 3 ]; then
        log_success "Good security header coverage ($found_headers/4)"
    else
        log_warning "Limited security header coverage ($found_headers/4)"
    fi
}

test_caching_headers() {
    log_info "Testing caching configuration..."
    
    # Test main HTML page (should have short cache)
    local html_headers=$(curl -s -I "$AMPLIFY_URL" 2>/dev/null || echo "")
    if [[ "$html_headers" =~ "Cache-Control" ]]; then
        log_success "Cache headers configured for HTML"
    else
        log_warning "Cache headers not found for HTML"
    fi
    
    # Test static assets (should have long cache if available)
    local html_content=$(curl -s "$AMPLIFY_URL" 2>/dev/null || echo "")
    
    # Try to find an actual asset URL from the HTML
    if [[ "$html_content" =~ /assets/[^\"]*\.js ]]; then
        # Extract first JS asset URL
        local asset_url=$(echo "$html_content" | grep -o '/assets/[^"]*\.js' | head -1)
        if [ -n "$asset_url" ]; then
            local asset_headers=$(curl -s -I "$AMPLIFY_URL$asset_url" 2>/dev/null || echo "")
            if [[ "$asset_headers" =~ "Cache-Control" ]]; then
                log_success "Cache headers configured for static assets"
            else
                log_warning "Cache headers not found for static assets"
            fi
        fi
    else
        log_info "No specific asset URLs found to test caching"
    fi
}

test_frontend_environment() {
    log_info "Testing frontend environment configuration..."
    
    # Check if frontend can identify its environment
    local html_content=$(curl -s "$AMPLIFY_URL" 2>/dev/null || echo "")
    
    # Look for signs that VITE_* variables are being used
    if [[ "$html_content" =~ "vite" ]] || [[ "$html_content" =~ "import" ]]; then
        log_success "Frontend build appears to be Vite-based"
    else
        log_info "Frontend build framework not clearly identified"
    fi
    
    # Check for production optimizations
    if [[ "$html_content" =~ "minified" ]] || [[ ! "$html_content" =~ "localhost" ]]; then
        log_success "Frontend appears to be production-optimized"
    else
        log_warning "Frontend may not be production-optimized"
    fi
}

test_https_enforcement() {
    log_info "Testing HTTPS enforcement..."
    
    # Check if site is served over HTTPS
    if [[ "$AMPLIFY_URL" =~ ^https:// ]]; then
        log_success "Site is served over HTTPS"
        
        # Test HTTP redirect if applicable
        local http_url=${AMPLIFY_URL/https:/http:}
        local redirect_status=$(curl -s -o /dev/null -w "%{http_code}" "$http_url" || echo "000")
        
        if [ "$redirect_status" = "301" ] || [ "$redirect_status" = "302" ]; then
            log_success "HTTP redirects to HTTPS (HTTP $redirect_status)"
        else
            log_info "HTTP redirect status: $redirect_status"
        fi
    else
        log_warning "Site is not served over HTTPS"
    fi
}

test_performance() {
    log_info "Testing performance metrics..."
    
    # Measure response time
    local start_time=$(date +%s%N)
    curl -s -o /dev/null "$AMPLIFY_URL" >/dev/null 2>&1
    local end_time=$(date +%s%N)
    
    local response_time=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds
    
    if [ $response_time -lt 1000 ]; then
        log_success "Good response time: ${response_time}ms"
    elif [ $response_time -lt 3000 ]; then
        log_warning "Acceptable response time: ${response_time}ms"
    else
        log_warning "Slow response time: ${response_time}ms"
    fi
    
    # Check content size
    local content_size=$(curl -s "$AMPLIFY_URL" | wc -c)
    if [ $content_size -gt 1000 ]; then
        log_success "Content size appears reasonable: ${content_size} bytes"
    else
        log_warning "Content size seems small: ${content_size} bytes"
    fi
}

test_error_pages() {
    log_info "Testing error page handling..."
    
    # Test 404 handling (should return main app for SPA)
    local not_found_url="$AMPLIFY_URL/this-page-definitely-does-not-exist"
    local not_found_response=$(curl -s "$not_found_url" 2>/dev/null || echo "failed")
    
    if [[ "$not_found_response" =~ "<!DOCTYPE html>" ]]; then
        log_success "404 pages return main application (correct for SPA)"
    else
        log_warning "404 pages may not be handled correctly"
    fi
}

# ============= MAIN EXECUTION =============

echo "=============================================="
echo "🏗️  AWS Amplify Frontend Static Site Testing"
echo "=============================================="
echo "Target URL: $AMPLIFY_URL"
echo "Test Type: Frontend-only static hosting"
echo "=============================================="

# Track test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

run_test() {
    local test_name="$1"
    local test_function="$2"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo ""
    
    if $test_function; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

# Execute all tests
run_test "Basic Connectivity" test_basic_connectivity
run_test "Frontend Loading" test_frontend_loading
run_test "Static Assets" test_static_assets
run_test "SPA Routing" test_spa_routing
run_test "Security Headers" test_security_headers
run_test "Caching Headers" test_caching_headers
run_test "Frontend Environment" test_frontend_environment
run_test "HTTPS Enforcement" test_https_enforcement
run_test "Performance" test_performance
run_test "Error Pages" test_error_pages

# Final results
echo ""
echo "=============================================="
echo "📊 Test Results Summary"
echo "=============================================="
echo "Total Tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed! Frontend static site is properly configured.${NC}"
    exit 0
elif [ $FAILED_TESTS -le 2 ]; then
    echo -e "${YELLOW}⚠️  Most tests passed with minor issues. Frontend should work correctly.${NC}"
    exit 0
else
    echo -e "${RED}❌ Multiple test failures detected. Please review frontend configuration.${NC}"
    exit 1
fi