#!/bin/bash

# ============= AWS AMPLIFY MASTER DEPLOYMENT SCRIPT =============
# Orchestrates the complete AWS Amplify deployment process
# Can be used for local testing or as a single-command deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[DEPLOY-MASTER]${NC} $1"
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

log_header() {
    echo -e "${BOLD}${BLUE}========================================${NC}"
    echo -e "${BOLD}${BLUE} $1${NC}"
    echo -e "${BOLD}${BLUE}========================================${NC}"
}

# ============= CONFIGURATION =============

SCRIPT_DIR="scripts/amplify"
START_TIME=$(date +%s)
DEPLOYMENT_LOG="deployment-$(date +%Y%m%d_%H%M%S).log"
SKIP_TESTS=false
ENVIRONMENT=""

# ============= USAGE AND HELP =============

show_usage() {
    echo "AWS Amplify Master Deployment Script"
    echo ""
    echo "Usage: $0 [options] [environment]"
    echo ""
    echo "Options:"
    echo "  --skip-tests     Skip build testing phase"
    echo "  --help, -h       Show this help message"
    echo ""
    echo "Environments:"
    echo "  production       Production deployment (default)"
    echo "  staging          Staging deployment"
    echo "  development      Development deployment"
    echo "  auto             Auto-detect from branch/environment"
    echo ""
    echo "Examples:"
    echo "  $0                           # Production deployment"
    echo "  $0 staging                   # Staging deployment"
    echo "  $0 --skip-tests production   # Production without tests"
    echo "  $0 development               # Development deployment"
    echo ""
    echo "This script orchestrates the complete AWS Amplify deployment process:"
    echo "  1. Environment setup and validation"
    echo "  2. Database configuration (if applicable)"
    echo "  3. Pre-build preparation"
    echo "  4. Frontend build"
    echo "  5. Post-build optimization"
    echo "  6. Deployment validation"
}

# ============= ARGUMENT PARSING =============

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            --help|-h)
                show_usage
                exit 0
                ;;
            production|staging|development|auto)
                ENVIRONMENT="$1"
                shift
                ;;
            *)
                log_error "Unknown argument: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    # Default to production if no environment specified
    if [ -z "$ENVIRONMENT" ]; then
        ENVIRONMENT="production"
    fi
}

# ============= PREREQUISITES =============

check_prerequisites() {
    log_header "CHECKING PREREQUISITES"
    
    local errors=0
    
    # Check if we're in the right directory
    if [ ! -f "package.json" ]; then
        log_error "package.json not found. Please run from project root."
        errors=$((errors + 1))
    fi
    
    # Check if amplify scripts exist
    if [ ! -d "$SCRIPT_DIR" ]; then
        log_error "Amplify scripts directory not found: $SCRIPT_DIR"
        errors=$((errors + 1))
    fi
    
    # Check for required scripts
    local required_scripts=(
        "environment-setup.sh"
        "validate-env.sh"
        "database-prod.sh"
        "prebuild.sh"
        "build-frontend.sh"
        "postbuild.sh"
        "optimize-build.sh"
        "deploy-helpers.sh"
    )
    
    for script in "${required_scripts[@]}"; do
        if [ ! -f "$SCRIPT_DIR/$script" ]; then
            log_error "Required script missing: $SCRIPT_DIR/$script"
            errors=$((errors + 1))
        elif [ ! -x "$SCRIPT_DIR/$script" ]; then
            log_warning "Script not executable: $SCRIPT_DIR/$script (fixing...)"
            chmod +x "$SCRIPT_DIR/$script"
        fi
    done
    
    # Check Node.js and npm
    if ! command -v node >/dev/null 2>&1; then
        log_error "Node.js not found"
        errors=$((errors + 1))
    else
        log_success "✓ Node.js: $(node --version)"
    fi
    
    if ! command -v npm >/dev/null 2>&1; then
        log_error "npm not found"
        errors=$((errors + 1))
    else
        log_success "✓ npm: $(npm --version)"
    fi
    
    if [ $errors -gt 0 ]; then
        log_error "Prerequisites check failed with $errors errors"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# ============= DEPLOYMENT PHASES =============

phase_environment_setup() {
    log_header "PHASE 1: ENVIRONMENT SETUP"
    
    log_info "Setting up environment for: $ENVIRONMENT"
    
    if [ "$ENVIRONMENT" = "auto" ]; then
        ./"$SCRIPT_DIR/environment-setup.sh"
    else
        OVERRIDE_ENVIRONMENT="$ENVIRONMENT" ./"$SCRIPT_DIR/environment-setup.sh"
    fi
    
    log_success "Environment setup completed"
}

phase_validation() {
    log_header "PHASE 2: ENVIRONMENT VALIDATION"
    
    ./"$SCRIPT_DIR/validate-env.sh"
    
    log_success "Environment validation completed"
}

phase_database_setup() {
    log_header "PHASE 3: DATABASE SETUP"
    
    ./"$SCRIPT_DIR/database-prod.sh"
    
    log_success "Database setup completed"
}

phase_prebuild() {
    log_header "PHASE 4: PRE-BUILD PREPARATION"
    
    ./"$SCRIPT_DIR/prebuild.sh"
    
    log_success "Pre-build preparation completed"
}

phase_build() {
    log_header "PHASE 5: FRONTEND BUILD"
    
    local build_start=$(date +%s)
    
    ./"$SCRIPT_DIR/build-frontend.sh"
    
    local build_end=$(date +%s)
    local build_duration=$((build_end - build_start))
    
    log_success "Frontend build completed in ${build_duration}s"
}

phase_postbuild() {
    log_header "PHASE 6: POST-BUILD OPTIMIZATION"
    
    ./"$SCRIPT_DIR/postbuild.sh"
    
    log_success "Post-build optimization completed"
}

phase_optimization() {
    log_header "PHASE 7: ADVANCED OPTIMIZATION"
    
    ./"$SCRIPT_DIR/optimize-build.sh"
    
    log_success "Advanced optimization completed"
}

phase_validation_final() {
    log_header "PHASE 8: FINAL VALIDATION"
    
    if [ "$SKIP_TESTS" = "false" ]; then
        ./"$SCRIPT_DIR/deploy-helpers.sh" health-check
    else
        log_info "Skipping final health check (--skip-tests specified)"
        ./"$SCRIPT_DIR/deploy-helpers.sh" validate
    fi
    
    log_success "Final validation completed"
}

# ============= DEPLOYMENT SUMMARY =============

generate_deployment_summary() {
    log_header "DEPLOYMENT SUMMARY"
    
    local end_time=$(date +%s)
    local total_duration=$((end_time - START_TIME))
    local minutes=$((total_duration / 60))
    local seconds=$((total_duration % 60))
    
    echo "Deployment Details:"
    echo "  Environment: $ENVIRONMENT"
    echo "  Start Time: $(date -d @$START_TIME)"
    echo "  End Time: $(date -d @$end_time)"
    echo "  Total Duration: ${minutes}m ${seconds}s"
    echo "  Skip Tests: $SKIP_TESTS"
    
    if [ -d "dist/public" ]; then
        local build_size=$(du -sh dist/public 2>/dev/null | cut -f1)
        local file_count=$(find dist/public -type f | wc -l)
        echo "  Build Output: $build_size ($file_count files)"
    fi
    
    echo ""
    echo "Environment Summary:"
    echo "  NODE_ENV: ${NODE_ENV:-'not set'}"
    echo "  Database: $([ ! -z "$DATABASE_URL" ] && echo "configured" || echo "not configured")"
    echo "  Branch: ${AWS_BRANCH:-'local'}"
    echo "  Commit: ${AWS_COMMIT_ID:-'local'}"
    
    echo ""
    echo "Next Steps:"
    if [ -f "amplify.optimized.yml" ]; then
        echo "  1. Copy amplify.optimized.yml to amplify.yml"
        echo "  2. Deploy to AWS Amplify"
        echo "  3. Configure environment variables in Amplify console"
    else
        echo "  1. Use the current amplify.yml configuration"
        echo "  2. Deploy to AWS Amplify"
    fi
    
    echo ""
    log_success "Deployment process completed successfully!"
    echo "Build artifacts are ready in dist/public/"
}

# ============= ERROR HANDLING =============

handle_error() {
    local exit_code=$?
    local line_number=$1
    
    log_error "Deployment failed at line $line_number with exit code $exit_code"
    
    # Try to provide helpful debugging information
    if [ -f "$DEPLOYMENT_LOG" ]; then
        echo "Check deployment log: $DEPLOYMENT_LOG"
    fi
    
    echo ""
    echo "Troubleshooting steps:"
    echo "  1. Check the error message above"
    echo "  2. Run: ./scripts/amplify/deploy-helpers.sh diagnose"
    echo "  3. Run: ./scripts/amplify/deploy-helpers.sh debug"
    echo "  4. Check individual script logs"
    
    exit $exit_code
}

# ============= MAIN EXECUTION =============

main() {
    # Set up error handling
    trap 'handle_error ${LINENO}' ERR
    
    # Start logging
    exec 1> >(tee -a "$DEPLOYMENT_LOG")
    exec 2> >(tee -a "$DEPLOYMENT_LOG" >&2)
    
    log_header "AWS AMPLIFY MASTER DEPLOYMENT SCRIPT"
    
    # Parse command line arguments
    parse_arguments "$@"
    
    # Show configuration
    log_info "Configuration:"
    log_info "  Environment: $ENVIRONMENT"
    log_info "  Skip Tests: $SKIP_TESTS"
    log_info "  Log File: $DEPLOYMENT_LOG"
    
    # Execute deployment phases
    check_prerequisites
    phase_environment_setup
    phase_validation
    phase_database_setup
    phase_prebuild
    phase_build
    phase_postbuild
    phase_optimization
    phase_validation_final
    
    # Generate summary
    generate_deployment_summary
}

# Run main function if script is executed directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi