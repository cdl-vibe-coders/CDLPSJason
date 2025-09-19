#!/bin/bash

# ============= AWS AMPLIFY FRONTEND ENVIRONMENT VALIDATION SCRIPT =============
# Validates frontend-only environment configuration for AWS Amplify static hosting
# Focuses on VITE_* variables only - backend variables should be configured elsewhere

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Validation counters
ERRORS=0
WARNINGS=0
PASSED=0

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    PASSED=$((PASSED + 1))
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    WARNINGS=$((WARNINGS + 1))
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    ERRORS=$((ERRORS + 1))
}

log_check() {
    echo -e "${CYAN}[CHECK]${NC} $1"
}

# ============= FRONTEND ENVIRONMENT VALIDATION =============

validate_vite_api_url() {
    log_check "Validating VITE_API_URL..."
    
    if [ -z "$VITE_API_URL" ]; then
        log_error "VITE_API_URL is not set - frontend cannot connect to backend"
        log_info "Set VITE_API_URL to your external backend API endpoint"
        log_info "Example: VITE_API_URL=https://api.yourdomain.com"
        return 1
    fi
    
    # Format validation
    if [[ "$VITE_API_URL" =~ ^https?:// ]]; then
        log_success "VITE_API_URL format is valid: $VITE_API_URL"
    else
        log_error "VITE_API_URL format is invalid (must start with http:// or https://)"
        return 1
    fi
    
    # Security check for production
    if [[ "$VITE_API_URL" =~ ^http:// ]] && [[ "$VITE_SECURE_MODE" = "true" ]]; then
        log_warning "VITE_API_URL uses HTTP in secure mode - consider HTTPS"
    fi
    
    # Check for localhost in production-like environment
    if [[ "$VITE_API_URL" =~ (localhost|127\.0\.0\.1) ]] && [[ "$NODE_ENV" = "production" ]]; then
        log_warning "VITE_API_URL points to localhost in production environment"
    fi
    
    return 0
}

validate_frontend_environment_variables() {
    log_check "Validating frontend environment variables..."
    
    # VITE_ENVIRONMENT
    if [ -n "$VITE_ENVIRONMENT" ]; then
        case "$VITE_ENVIRONMENT" in
            "production"|"staging"|"development")
                log_success "VITE_ENVIRONMENT is valid: $VITE_ENVIRONMENT"
                ;;
            *)
                log_warning "VITE_ENVIRONMENT has unusual value: $VITE_ENVIRONMENT"
                ;;
        esac
    else
        log_info "VITE_ENVIRONMENT not set (optional)"
    fi
    
    # VITE_SECURE_MODE
    if [ -n "$VITE_SECURE_MODE" ]; then
        if [[ "$VITE_SECURE_MODE" =~ ^(true|false)$ ]]; then
            log_success "VITE_SECURE_MODE is valid: $VITE_SECURE_MODE"
        else
            log_warning "VITE_SECURE_MODE should be 'true' or 'false', got: $VITE_SECURE_MODE"
        fi
    else
        log_info "VITE_SECURE_MODE not set (optional)"
    fi
    
    # VITE_DISABLE_DEV_TOOLS
    if [ -n "$VITE_DISABLE_DEV_TOOLS" ]; then
        if [[ "$VITE_DISABLE_DEV_TOOLS" =~ ^(true|false)$ ]]; then
            log_success "VITE_DISABLE_DEV_TOOLS is valid: $VITE_DISABLE_DEV_TOOLS"
        else
            log_warning "VITE_DISABLE_DEV_TOOLS should be 'true' or 'false', got: $VITE_DISABLE_DEV_TOOLS"
        fi
    else
        log_info "VITE_DISABLE_DEV_TOOLS not set (optional)"
    fi
    
    # VITE_DEBUG_MODE
    if [ -n "$VITE_DEBUG_MODE" ]; then
        if [[ "$VITE_DEBUG_MODE" =~ ^(true|false)$ ]]; then
            log_success "VITE_DEBUG_MODE is valid: $VITE_DEBUG_MODE"
            
            # Warn if debug is enabled in production
            if [ "$VITE_DEBUG_MODE" = "true" ] && [ "$VITE_ENVIRONMENT" = "production" ]; then
                log_warning "VITE_DEBUG_MODE is enabled in production environment"
            fi
        else
            log_warning "VITE_DEBUG_MODE should be 'true' or 'false', got: $VITE_DEBUG_MODE"
        fi
    else
        log_info "VITE_DEBUG_MODE not set (optional)"
    fi
    
    # Feature flags
    local feature_flags=("VITE_FEATURE_ANALYTICS" "VITE_FEATURE_ERROR_REPORTING")
    for flag in "${feature_flags[@]}"; do
        if [ -n "${!flag}" ]; then
            if [[ "${!flag}" =~ ^(true|false)$ ]]; then
                log_success "$flag is valid: ${!flag}"
            else
                log_warning "$flag should be 'true' or 'false', got: ${!flag}"
            fi
        else
            log_info "$flag not set (optional)"
        fi
    done
}

check_backend_variables_misconfiguration() {
    log_check "Checking for backend variables misconfiguration..."
    
    local backend_vars=(
        "SESSION_SECRET"
        "DATABASE_URL" 
        "ANTHROPIC_API_KEY"
        "COOKIE_DOMAIN"
        "ALLOWED_ORIGINS"
        "PORT"
    )
    
    local found_backend_vars=()
    
    for var in "${backend_vars[@]}"; do
        if [ -n "${!var}" ]; then
            found_backend_vars+=("$var")
        fi
    done
    
    if [ ${#found_backend_vars[@]} -gt 0 ]; then
        log_warning "Found backend-only variables in frontend environment:"
        for var in "${found_backend_vars[@]}"; do
            log_warning "  - $var (should be configured on external backend server, NOT Amplify Console)"
        done
        log_info "These variables are not used in Amplify static hosting"
        log_info "Configure them on your external backend server instead"
    else
        log_success "No backend variables found in frontend environment (correct)"
    fi
}

validate_build_environment() {
    log_check "Validating build environment..."
    
    # NODE_ENV (used for build process only)
    if [ -n "$NODE_ENV" ]; then
        case "$NODE_ENV" in
            "production"|"staging"|"development")
                log_success "NODE_ENV is valid for build: $NODE_ENV"
                ;;
            *)
                log_warning "NODE_ENV has unusual value: $NODE_ENV"
                ;;
        esac
    else
        log_info "NODE_ENV not set, will default to production for build"
    fi
    
    # Build-specific variables
    if [ "$GENERATE_SOURCEMAP" = "true" ] && [ "$NODE_ENV" = "production" ]; then
        log_warning "Source maps enabled in production build (may expose code structure)"
    fi
    
    if [ -n "$NODE_OPTIONS" ]; then
        log_success "NODE_OPTIONS configured for build: $NODE_OPTIONS"
    fi
}

validate_security_configuration() {
    log_check "Validating security configuration..."
    
    # Check for secure settings in production
    if [ "$VITE_ENVIRONMENT" = "production" ] || [ "$NODE_ENV" = "production" ]; then
        local security_issues=0
        
        if [ "$VITE_DEBUG_MODE" = "true" ]; then
            log_warning "Debug mode enabled in production"
            security_issues=$((security_issues + 1))
        fi
        
        if [ "$VITE_DISABLE_DEV_TOOLS" != "true" ]; then
            log_warning "Development tools not disabled in production"
            security_issues=$((security_issues + 1))
        fi
        
        if [ "$GENERATE_SOURCEMAP" = "true" ]; then
            log_warning "Source maps enabled in production"
            security_issues=$((security_issues + 1))
        fi
        
        if [[ "$VITE_API_URL" =~ ^http:// ]]; then
            log_warning "API URL uses HTTP instead of HTTPS in production"
            security_issues=$((security_issues + 1))
        fi
        
        if [ $security_issues -eq 0 ]; then
            log_success "Production security configuration looks good"
        else
            log_warning "Found $security_issues security configuration issues"
        fi
    else
        log_info "Non-production environment, skipping strict security checks"
    fi
}

# ============= MAIN EXECUTION =============

echo "=============================================="
echo "🔍 AWS Amplify Frontend Environment Validation"
echo "=============================================="
echo "Environment Type: Frontend-only static hosting"
echo "Validation Focus: VITE_* variables only"
echo "=============================================="

# Header with important information
echo ""
log_info "🏗️  ARCHITECTURE REMINDER:"
log_info "   - Amplify = Frontend static hosting only"
log_info "   - Backend = External server deployment"
log_info "   - Only VITE_* variables affect frontend build"
echo ""

# Execute validation functions
validate_vite_api_url
echo ""

validate_frontend_environment_variables
echo ""

check_backend_variables_misconfiguration
echo ""

validate_build_environment
echo ""

validate_security_configuration
echo ""

# ============= SUMMARY =============

echo "=============================================="
echo "📊 Validation Summary"
echo "=============================================="
echo "Passed: $PASSED"
echo "Warnings: $WARNINGS"
echo "Errors: $ERRORS"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ Perfect! Frontend environment is correctly configured.${NC}"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Environment is functional but has minor issues.${NC}"
    echo -e "${YELLOW}   Review warnings above for optimization opportunities.${NC}"
    exit 0
elif [ $ERRORS -le 2 ]; then
    echo -e "${RED}❌ Environment has critical issues that need fixing.${NC}"
    echo -e "${RED}   Address errors above before deploying.${NC}"
    exit 1
else
    echo -e "${RED}❌ Environment has multiple critical issues.${NC}"
    echo -e "${RED}   Review configuration and fix all errors.${NC}"
    exit 1
fi