#!/bin/bash

# ============= AWS AMPLIFY ENVIRONMENT SETUP SCRIPT =============
# Environment-specific configuration for different deployment stages
# Supports development, staging, and production environments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[ENV-SETUP]${NC} $1"
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

# ============= ENVIRONMENT DETECTION =============

detect_environment() {
    local environment="production"
    
    # Check AWS Amplify environment variables
    if [ ! -z "$AWS_BRANCH" ]; then
        case "$AWS_BRANCH" in
            "main"|"master"|"prod"|"production")
                environment="production"
                ;;
            "staging"|"stage"|"preprod")
                environment="staging"
                ;;
            "develop"|"dev"|"development")
                environment="development"
                ;;
            *)
                environment="development"
                ;;
        esac
        log_info "Environment detected from AWS_BRANCH ($AWS_BRANCH): $environment"
    elif [ ! -z "$NODE_ENV" ]; then
        environment="$NODE_ENV"
        log_info "Environment detected from NODE_ENV: $environment"
    else
        log_info "No environment specified, defaulting to: $environment"
    fi
    
    echo "$environment"
}

# ============= ENVIRONMENT CONFIGURATION =============

setup_production_environment() {
    log_info "Setting up production environment..."
    
    # Production environment variables
    export NODE_ENV=production
    export CI=true
    export GENERATE_SOURCEMAP=false
    export INLINE_RUNTIME_CHUNK=false
    
    # Performance optimizations
    export NODE_OPTIONS="--max-old-space-size=4096"
    export DISABLE_ESLINT_PLUGIN=true
    
    # Build optimizations
    export VITE_BUILD_TARGET="es2015"
    export VITE_MINIFY=true
    export VITE_SOURCEMAP=false
    
    # Security settings
    export VITE_SECURE_MODE=true
    export VITE_DISABLE_DEV_TOOLS=true
    
    # AWS Amplify specific
    export VITE_ENVIRONMENT="production"
    export VITE_BUILD_TIME="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    export VITE_BUILD_COMMIT="${AWS_COMMIT_ID:-unknown}"
    export VITE_BUILD_BRANCH="${AWS_BRANCH:-main}"
    
    log_success "Production environment configured"
}

setup_staging_environment() {
    log_info "Setting up staging environment..."
    
    # Staging environment variables
    export NODE_ENV=production
    export CI=true
    export GENERATE_SOURCEMAP=true
    
    # Performance optimizations (lighter than prod)
    export NODE_OPTIONS="--max-old-space-size=2048"
    
    # Build settings for testing
    export VITE_BUILD_TARGET="es2018"
    export VITE_MINIFY=true
    export VITE_SOURCEMAP=true
    
    # Enable debugging features
    export VITE_SECURE_MODE=false
    export VITE_DISABLE_DEV_TOOLS=false
    export VITE_DEBUG_MODE=true
    
    # Environment identification
    export VITE_ENVIRONMENT="staging"
    export VITE_BUILD_TIME="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    export VITE_BUILD_COMMIT="${AWS_COMMIT_ID:-unknown}"
    export VITE_BUILD_BRANCH="${AWS_BRANCH:-staging}"
    
    log_success "Staging environment configured"
}

setup_development_environment() {
    log_info "Setting up development environment..."
    
    # Development environment variables
    export NODE_ENV=development
    export CI=false
    export GENERATE_SOURCEMAP=true
    
    # Development optimizations
    export NODE_OPTIONS="--max-old-space-size=1024"
    
    # Build settings for development
    export VITE_BUILD_TARGET="esnext"
    export VITE_MINIFY=false
    export VITE_SOURCEMAP=true
    
    # Enable all debugging features
    export VITE_SECURE_MODE=false
    export VITE_DISABLE_DEV_TOOLS=false
    export VITE_DEBUG_MODE=true
    export VITE_VERBOSE_LOGGING=true
    
    # Environment identification
    export VITE_ENVIRONMENT="development"
    export VITE_BUILD_TIME="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    export VITE_BUILD_COMMIT="${AWS_COMMIT_ID:-local}"
    export VITE_BUILD_BRANCH="${AWS_BRANCH:-development}"
    
    log_success "Development environment configured"
}

# ============= FEATURE FLAGS =============

setup_feature_flags() {
    local environment="$1"
    
    log_info "Setting up feature flags for $environment..."
    
    case "$environment" in
        "production")
            export VITE_FEATURE_ANALYTICS=true
            export VITE_FEATURE_ERROR_REPORTING=true
            export VITE_FEATURE_PERFORMANCE_MONITORING=true
            export VITE_FEATURE_DEBUG_TOOLS=false
            export VITE_FEATURE_EXPERIMENTAL=false
            ;;
        "staging")
            export VITE_FEATURE_ANALYTICS=true
            export VITE_FEATURE_ERROR_REPORTING=true
            export VITE_FEATURE_PERFORMANCE_MONITORING=true
            export VITE_FEATURE_DEBUG_TOOLS=true
            export VITE_FEATURE_EXPERIMENTAL=true
            ;;
        "development")
            export VITE_FEATURE_ANALYTICS=false
            export VITE_FEATURE_ERROR_REPORTING=false
            export VITE_FEATURE_PERFORMANCE_MONITORING=false
            export VITE_FEATURE_DEBUG_TOOLS=true
            export VITE_FEATURE_EXPERIMENTAL=true
            ;;
    esac
    
    log_success "Feature flags configured for $environment"
}

# ============= API CONFIGURATION =============

setup_api_configuration() {
    local environment="$1"
    
    log_info "Setting up API configuration for $environment..."
    
    # Set API URLs based on environment
    case "$environment" in
        "production")
            export VITE_API_URL="${VITE_API_URL:-https://api.yourdomain.com}"
            export VITE_API_TIMEOUT=10000
            export VITE_API_RETRY_ATTEMPTS=3
            ;;
        "staging")
            export VITE_API_URL="${VITE_API_URL:-https://staging-api.yourdomain.com}"
            export VITE_API_TIMEOUT=15000
            export VITE_API_RETRY_ATTEMPTS=2
            ;;
        "development")
            export VITE_API_URL="${VITE_API_URL:-http://localhost:5000}"
            export VITE_API_TIMEOUT=30000
            export VITE_API_RETRY_ATTEMPTS=1
            ;;
    esac
    
    # Common API settings
    export VITE_API_VERSION="v1"
    export VITE_API_FORMAT="json"
    
    log_success "API configuration set for $environment"
}

# ============= MONITORING CONFIGURATION =============

setup_monitoring() {
    local environment="$1"
    
    log_info "Setting up monitoring for $environment..."
    
    case "$environment" in
        "production")
            export VITE_SENTRY_DSN="${SENTRY_DSN:-}"
            export VITE_ANALYTICS_ID="${ANALYTICS_ID:-}"
            export VITE_MONITORING_LEVEL="detailed"
            export VITE_ERROR_SAMPLING_RATE="1.0"
            ;;
        "staging")
            export VITE_SENTRY_DSN="${SENTRY_STAGING_DSN:-}"
            export VITE_ANALYTICS_ID="${ANALYTICS_STAGING_ID:-}"
            export VITE_MONITORING_LEVEL="basic"
            export VITE_ERROR_SAMPLING_RATE="1.0"
            ;;
        "development")
            export VITE_SENTRY_DSN=""
            export VITE_ANALYTICS_ID=""
            export VITE_MONITORING_LEVEL="none"
            export VITE_ERROR_SAMPLING_RATE="0.1"
            ;;
    esac
    
    log_success "Monitoring configured for $environment"
}

# ============= SECURITY CONFIGURATION =============

setup_security() {
    local environment="$1"
    
    log_info "Setting up security configuration for $environment..."
    
    case "$environment" in
        "production")
            export VITE_SECURE_COOKIES=true
            export VITE_HTTPS_ONLY=true
            export VITE_HSTS_ENABLED=true
            export VITE_CSP_ENABLED=true
            ;;
        "staging")
            export VITE_SECURE_COOKIES=true
            export VITE_HTTPS_ONLY=true
            export VITE_HSTS_ENABLED=false
            export VITE_CSP_ENABLED=true
            ;;
        "development")
            export VITE_SECURE_COOKIES=false
            export VITE_HTTPS_ONLY=false
            export VITE_HSTS_ENABLED=false
            export VITE_CSP_ENABLED=false
            ;;
    esac
    
    log_success "Security settings configured for $environment"
}

# ============= ENVIRONMENT VALIDATION =============

validate_environment_setup() {
    local environment="$1"
    
    log_info "Validating environment setup for $environment..."
    
    local validation_errors=0
    
    # Check required environment variables
    local required_vars=("NODE_ENV" "VITE_ENVIRONMENT")
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            log_error "Required environment variable not set: $var"
            validation_errors=$((validation_errors + 1))
        fi
    done
    
    # Environment-specific validations
    case "$environment" in
        "production")
            if [ "$GENERATE_SOURCEMAP" = "true" ]; then
                log_warning "Source maps enabled in production"
            fi
            if [ "$VITE_DEBUG_MODE" = "true" ]; then
                log_warning "Debug mode enabled in production"
            fi
            ;;
    esac
    
    if [ $validation_errors -eq 0 ]; then
        log_success "Environment validation passed"
        return 0
    else
        log_error "Environment validation failed with $validation_errors errors"
        return 1
    fi
}

# ============= ENVIRONMENT SUMMARY =============

generate_environment_summary() {
    local environment="$1"
    
    log_info "Environment Summary for $environment:"
    echo "----------------------------------------"
    echo "NODE_ENV: ${NODE_ENV}"
    echo "Environment: ${VITE_ENVIRONMENT}"
    echo "Build Target: ${VITE_BUILD_TARGET:-default}"
    echo "Source Maps: ${GENERATE_SOURCEMAP:-false}"
    echo "Minification: ${VITE_MINIFY:-default}"
    echo "Debug Mode: ${VITE_DEBUG_MODE:-false}"
    echo "API URL: ${VITE_API_URL:-not set}"
    echo "Build Time: ${VITE_BUILD_TIME}"
    echo "Commit: ${VITE_BUILD_COMMIT}"
    echo "Branch: ${VITE_BUILD_BRANCH}"
    echo "----------------------------------------"
}

# ============= MAIN EXECUTION =============

main() {
    log_info "Starting AWS Amplify environment setup..."
    
    # Detect environment
    local environment=$(detect_environment)
    
    # Setup environment-specific configuration
    case "$environment" in
        "production")
            setup_production_environment
            ;;
        "staging")
            setup_staging_environment
            ;;
        "development")
            setup_development_environment
            ;;
        *)
            log_warning "Unknown environment: $environment, using production defaults"
            setup_production_environment
            ;;
    esac
    
    # Setup additional configurations
    setup_feature_flags "$environment"
    setup_api_configuration "$environment"
    setup_monitoring "$environment"
    setup_security "$environment"
    
    # Validate setup
    validate_environment_setup "$environment"
    
    # Generate summary
    generate_environment_summary "$environment"
    
    log_success "Environment setup completed for $environment!"
}

# Display help if requested
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "AWS Amplify Environment Setup Script"
    echo ""
    echo "Usage: ./scripts/amplify/environment-setup.sh [environment]"
    echo ""
    echo "Environments:"
    echo "  production   - Production optimizations, no debug features"
    echo "  staging      - Production build with debug features enabled"
    echo "  development  - Development build with full debugging"
    echo ""
    echo "Auto-detection based on:"
    echo "  - AWS_BRANCH environment variable"
    echo "  - NODE_ENV environment variable"
    echo "  - Defaults to production if not specified"
    echo ""
    echo "Features:"
    echo "  - Environment-specific build optimizations"
    echo "  - Feature flag configuration"
    echo "  - API endpoint configuration"
    echo "  - Monitoring and analytics setup"
    echo "  - Security policy configuration"
    exit 0
fi

# Run main function if script is executed directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi