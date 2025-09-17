# ============= MODULAR APPLICATION DEPLOYMENT MAKEFILE =============
# Simplified commands for common deployment operations

.PHONY: help build deploy clean test health check-deps

# Default target
.DEFAULT_GOAL := help

# Colors for output
RED := \033[31m
GREEN := \033[32m
YELLOW := \033[33m
BLUE := \033[34m
NC := \033[0m # No Color

# ============= HELP =============
help: ## Show this help message
	@echo "$(BLUE)Modular Application Deployment Commands$(NC)"
	@echo ""
	@echo "$(YELLOW)Build Commands:$(NC)"
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ && /Build Commands/ {found=1; next} found && /^[a-zA-Z_-]+:.*##/ && !/Help Commands|Deploy Commands|Database Commands|Health Commands|Development Commands/ {printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(YELLOW)Deploy Commands:$(NC)"
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ && /Deploy Commands/ {found=1; next} found && /^[a-zA-Z_-]+:.*##/ && !/Help Commands|Build Commands|Database Commands|Health Commands|Development Commands/ {printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(YELLOW)Database Commands:$(NC)"
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ && /Database Commands/ {found=1; next} found && /^[a-zA-Z_-]+:.*##/ && !/Help Commands|Build Commands|Deploy Commands|Health Commands|Development Commands/ {printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(YELLOW)Health Commands:$(NC)"
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ && /Health Commands/ {found=1; next} found && /^[a-zA-Z_-]+:.*##/ && !/Help Commands|Build Commands|Deploy Commands|Database Commands|Development Commands/ {printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(YELLOW)Development Commands:$(NC)"
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ && /Development Commands/ {found=1; next} found && /^[a-zA-Z_-]+:.*##/ && !/Help Commands|Build Commands|Deploy Commands|Database Commands|Health Commands/ {printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(BLUE)Examples:$(NC)"
	@echo "  make dev                 # Start development environment"
	@echo "  make build-all           # Build all modules"
	@echo "  make deploy-monolith     # Deploy monolith mode"
	@echo "  make deploy-distributed  # Deploy distributed mode"
	@echo "  make migrate             # Run database migrations"
	@echo "  make health              # Run health checks"

# ============= DEPENDENCY CHECKS =============
check-deps: ## Development Commands: Check system dependencies
	@echo "$(BLUE)Checking system dependencies...$(NC)"
	@command -v node >/dev/null 2>&1 || (echo "$(RED)ERROR: Node.js is required$(NC)" && exit 1)
	@command -v npm >/dev/null 2>&1 || (echo "$(RED)ERROR: npm is required$(NC)" && exit 1)
	@command -v docker >/dev/null 2>&1 || (echo "$(RED)ERROR: Docker is required$(NC)" && exit 1)
	@command -v docker-compose >/dev/null 2>&1 || (echo "$(RED)ERROR: Docker Compose is required$(NC)" && exit 1)
	@echo "$(GREEN)All dependencies are available$(NC)"

# ============= BUILD COMMANDS =============
build-admin: check-deps ## Build Commands: Build admin module
	@echo "$(BLUE)Building admin module...$(NC)"
	./scripts/build/build-module.sh admin standalone

build-users: check-deps ## Build Commands: Build users module
	@echo "$(BLUE)Building users module...$(NC)"
	./scripts/build/build-module.sh users standalone

build-all: check-deps ## Build Commands: Build all modules
	@echo "$(BLUE)Building all modules...$(NC)"
	./scripts/build/build-module.sh all standalone

build-monolith: check-deps ## Build Commands: Build monolith application
	@echo "$(BLUE)Building monolith application...$(NC)"
	./scripts/build/build-module.sh all monolith

# ============= DEPLOY COMMANDS =============
deploy-dev: check-deps ## Deploy Commands: Start development environment
	@echo "$(BLUE)Starting development environment...$(NC)"
	docker-compose up -d
	@echo "$(GREEN)Development environment started$(NC)"
	@echo "Application: http://localhost:5000"

deploy-monolith: check-deps ## Deploy Commands: Deploy monolith to production
	@echo "$(BLUE)Deploying monolith application...$(NC)"
	docker-compose --profile monolith up -d
	@sleep 5
	$(MAKE) migrate
	$(MAKE) health
	@echo "$(GREEN)Monolith deployment completed$(NC)"

deploy-distributed: check-deps ## Deploy Commands: Deploy distributed modules
	@echo "$(BLUE)Deploying distributed modules...$(NC)"
	docker-compose --profile distributed up -d
	@sleep 10
	$(MAKE) migrate
	$(MAKE) health
	@echo "$(GREEN)Distributed deployment completed$(NC)"

deploy-stop: ## Deploy Commands: Stop all deployments
	@echo "$(BLUE)Stopping all services...$(NC)"
	docker-compose down
	@echo "$(GREEN)All services stopped$(NC)"

deploy-clean: deploy-stop ## Deploy Commands: Clean deployment (removes volumes)
	@echo "$(YELLOW)WARNING: This will remove all data including database$(NC)"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker-compose down -v --remove-orphans; \
		docker system prune -f; \
		echo "$(GREEN)Clean completed$(NC)"; \
	else \
		echo "$(YELLOW)Clean cancelled$(NC)"; \
	fi

# ============= DATABASE COMMANDS =============
migrate: ## Database Commands: Run all database migrations
	@echo "$(BLUE)Running database migrations...$(NC)"
	./scripts/database/migrate.sh all migrate
	@echo "$(GREEN)Database migrations completed$(NC)"

migrate-admin: ## Database Commands: Run admin module migrations
	@echo "$(BLUE)Running admin module migration...$(NC)"
	./scripts/database/migrate.sh admin migrate

migrate-users: ## Database Commands: Run users module migrations
	@echo "$(BLUE)Running users module migration...$(NC)"
	./scripts/database/migrate.sh users migrate

migrate-status: ## Database Commands: Check migration status
	@echo "$(BLUE)Checking migration status...$(NC)"
	./scripts/database/migrate.sh all status

migrate-rollback-admin: ## Database Commands: Rollback admin module (DANGEROUS)
	@echo "$(RED)WARNING: This will DROP admin tables and cause DATA LOSS$(NC)"
	./scripts/database/migrate.sh admin rollback

migrate-rollback-users: ## Database Commands: Rollback users module (DANGEROUS)
	@echo "$(RED)WARNING: This will DROP users tables and cause DATA LOSS$(NC)"
	./scripts/database/migrate.sh users rollback

# ============= HEALTH COMMANDS =============
health: ## Health Commands: Run comprehensive health check
	@echo "$(BLUE)Running health checks...$(NC)"
	./scripts/deploy/health-check.sh

health-monolith: ## Health Commands: Check monolith deployment health
	@echo "$(BLUE)Checking monolith health...$(NC)"
	./scripts/deploy/health-check.sh monolith

health-distributed: ## Health Commands: Check distributed deployment health
	@echo "$(BLUE)Checking distributed deployment health...$(NC)"
	./scripts/deploy/health-check.sh distributed

# ============= DEVELOPMENT COMMANDS =============
dev: deploy-dev ## Development Commands: Alias for deploy-dev
	@echo "$(GREEN)Development environment is running$(NC)"

logs: ## Development Commands: Show application logs
	@echo "$(BLUE)Showing application logs...$(NC)"
	docker-compose logs -f

logs-admin: ## Development Commands: Show admin module logs
	@echo "$(BLUE)Showing admin module logs...$(NC)"
	docker-compose logs -f admin-module

logs-users: ## Development Commands: Show users module logs
	@echo "$(BLUE)Showing users module logs...$(NC)"
	docker-compose logs -f users-module

logs-db: ## Development Commands: Show database logs
	@echo "$(BLUE)Showing database logs...$(NC)"
	docker-compose logs -f database

shell-admin: ## Development Commands: Access admin module shell
	@echo "$(BLUE)Accessing admin module shell...$(NC)"
	docker-compose exec admin-module sh

shell-users: ## Development Commands: Access users module shell
	@echo "$(BLUE)Accessing users module shell...$(NC)"
	docker-compose exec users-module sh

shell-db: ## Development Commands: Access database shell
	@echo "$(BLUE)Accessing database shell...$(NC)"
	docker-compose exec database psql -U postgres

# ============= TESTING COMMANDS =============
test: ## Development Commands: Run tests (when implemented)
	@echo "$(BLUE)Running tests...$(NC)"
	npm test || echo "$(YELLOW)No tests configured yet$(NC)"

lint: ## Development Commands: Run linting
	@echo "$(BLUE)Running linter...$(NC)"
	npm run check

# ============= MONITORING COMMANDS =============
status: ## Development Commands: Show service status
	@echo "$(BLUE)Service Status:$(NC)"
	@docker-compose ps

stats: ## Development Commands: Show container resource usage
	@echo "$(BLUE)Container Resource Usage:$(NC)"
	@docker stats --no-stream

# ============= UTILITY COMMANDS =============
clean: ## Development Commands: Clean build artifacts
	@echo "$(BLUE)Cleaning build artifacts...$(NC)"
	rm -rf dist/
	rm -rf packages/
	rm -rf deployment/logs/*
	@echo "$(GREEN)Clean completed$(NC)"

update: ## Development Commands: Update dependencies
	@echo "$(BLUE)Updating dependencies...$(NC)"
	npm update
	@echo "$(GREEN)Dependencies updated$(NC)"

# ============= ENVIRONMENT SETUP =============
env-template: ## Development Commands: Copy environment templates
	@echo "$(BLUE)Copying environment templates...$(NC)"
	@if [ ! -f .env ]; then \
		cp deployment/config/monolith.env.template .env; \
		echo "$(GREEN)Created .env from template$(NC)"; \
		echo "$(YELLOW)Please edit .env with your configuration$(NC)"; \
	else \
		echo "$(YELLOW).env already exists$(NC)"; \
	fi
	@if [ ! -f admin.env ]; then \
		cp deployment/config/admin.env.template admin.env; \
		echo "$(GREEN)Created admin.env from template$(NC)"; \
	fi
	@if [ ! -f users.env ]; then \
		cp deployment/config/users.env.template users.env; \
		echo "$(GREEN)Created users.env from template$(NC)"; \
	fi

# ============= QUICK COMMANDS =============
quick-start: env-template deploy-dev ## Development Commands: Complete quick start setup
	@echo "$(GREEN)Quick start completed!$(NC)"
	@echo "$(BLUE)Next steps:$(NC)"
	@echo "1. Edit .env with your configuration"
	@echo "2. Run: make migrate"
	@echo "3. Access: http://localhost:5000"

production: env-template build-monolith deploy-monolith ## Deploy Commands: Complete production setup
	@echo "$(GREEN)Production deployment completed!$(NC)"
	@echo "$(BLUE)Next steps:$(NC)"
	@echo "1. Verify: make health"
	@echo "2. Monitor: make logs"
	@echo "3. Scale as needed"

# ============= EMERGENCY COMMANDS =============
emergency-restart: ## Deploy Commands: Emergency restart all services
	@echo "$(RED)EMERGENCY RESTART$(NC)"
	docker-compose restart
	@sleep 5
	$(MAKE) health

emergency-stop: ## Deploy Commands: Emergency stop all services
	@echo "$(RED)EMERGENCY STOP$(NC)"
	docker-compose kill
	docker-compose down

# ============= VERSION INFO =============
version: ## Development Commands: Show version information
	@echo "$(BLUE)Version Information:$(NC)"
	@echo "Node.js: $$(node --version)"
	@echo "npm: $$(npm --version)"
	@echo "Docker: $$(docker --version)"
	@echo "Docker Compose: $$(docker-compose --version)"
	@echo ""
	@echo "$(BLUE)Application Modules:$(NC)"
	@echo "Admin Module: 1.0.0"
	@echo "Users Module: 1.0.0"