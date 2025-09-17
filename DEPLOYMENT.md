# 🚀 Comprehensive Deployment Framework

This document provides complete instructions for deploying the modular application in both monolith and distributed modes. Our deployment framework supports independent module deployment while maintaining database isolation and cross-module communication.

## 📋 Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Monolith Deployment](#monolith-deployment)
- [Distributed Module Deployment](#distributed-module-deployment)
- [Database Management](#database-management)
- [Environment Configuration](#environment-configuration)
- [CI/CD Workflows](#cicd-workflows)
- [Monitoring and Health Checks](#monitoring-and-health-checks)
- [Troubleshooting](#troubleshooting)
- [Production Considerations](#production-considerations)

## 🎯 Overview

The deployment framework supports two primary deployment modes:

### **Monolith Mode** (Recommended for most use cases)
- Single application container with all modules
- Shared database with module isolation via table prefixes
- Simpler deployment and management
- Better performance for integrated workloads

### **Distributed Mode** (For high-scale or team separation)
- Independent containers for each module
- Shared database with strict module isolation
- Inter-module communication via service registry
- Individual scaling and deployment flexibility

## ✅ Prerequisites

### System Requirements
- **Node.js** 20+ (for building)
- **Docker** 24+ and **Docker Compose** v2.0+
- **PostgreSQL** 16+ (for database)
- **Git** (for CI/CD workflows)

### Optional Tools
- **kubectl** (for Kubernetes deployment)
- **jq** (for JSON processing in scripts)
- **psql** (for direct database management)

### Environment Setup
```bash
# Clone the repository
git clone <your-repository-url>
cd your-project

# Install dependencies
npm install

# Make scripts executable
chmod +x scripts/build/build-module.sh
chmod +x scripts/database/migrate.sh
chmod +x scripts/deploy/health-check.sh
```

## 🚀 Quick Start

### 1. **Development Setup**
```bash
# Start with docker-compose (development mode)
docker-compose --profile monolith up -d

# Run health check
./scripts/deploy/health-check.sh monolith
```

### 2. **Production Monolith**
```bash
# Build and deploy monolith
docker-compose -f docker-compose.yml --profile monolith up -d

# Apply database migrations
./scripts/database/migrate.sh all migrate

# Verify deployment
./scripts/deploy/health-check.sh monolith
```

### 3. **Distributed Deployment**
```bash
# Build and deploy distributed modules
docker-compose --profile distributed up -d

# Apply database migrations per module
./scripts/database/migrate.sh admin migrate
./scripts/database/migrate.sh users migrate

# Verify deployment
./scripts/deploy/health-check.sh distributed
```

## 🏢 Monolith Deployment

### Local Development
```bash
# Start with development overrides
docker-compose up -d

# Access the application
curl http://localhost:5000/api/health
```

### Production Deployment
```bash
# 1. Configure environment
cp deployment/config/monolith.env.template .env
# Edit .env with your production values

# 2. Build production image
docker build -f Dockerfile.monolith -t your-app:latest .

# 3. Deploy with docker-compose
docker-compose --profile monolith up -d

# 4. Apply database migrations
DATABASE_URL="your-production-db-url" ./scripts/database/migrate.sh all migrate

# 5. Verify deployment
./scripts/deploy/health-check.sh monolith
```

### Production Environment Variables
```bash
# Core settings
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://user:pass@host:port/db

# Security
JWT_SECRET=your-secure-jwt-secret
SESSION_SECRET=your-secure-session-secret
BCRYPT_ROUNDS=12

# Features
MODULE_ADMIN_ENABLED=true
MODULE_USERS_ENABLED=true
FEATURE_REGISTRATION=true
```

## 🌐 Distributed Module Deployment

### Architecture Overview
```
┌─────────────────┐    ┌─────────────────┐
│   Admin Module  │    │  Users Module   │
│   (Port 3001)   │    │   (Port 3002)   │
└─────────────────┘    └─────────────────┘
         │                       │
         └───────┬───────────────┘
                 │
      ┌─────────────────┐
      │  Load Balancer  │
      │  (NGINX/Port 80)│
      └─────────────────┘
                 │
      ┌─────────────────┐
      │   PostgreSQL    │
      │   (Port 5432)   │
      └─────────────────┘
```

### Step-by-Step Deployment

#### 1. **Environment Configuration**
```bash
# Admin module
cp deployment/config/admin.env.template admin.env

# Users module  
cp deployment/config/users.env.template users.env

# Edit both files with your configuration
```

#### 2. **Build Individual Modules**
```bash
# Build admin module
./scripts/build/build-module.sh admin standalone

# Build users module
./scripts/build/build-module.sh users standalone
```

#### 3. **Deploy with Docker Compose**
```bash
# Deploy all distributed services
docker-compose --profile distributed up -d

# Services will be available at:
# - Admin: http://localhost:3001
# - Users: http://localhost:3002  
# - Load Balancer: http://localhost:80
```

#### 4. **Database Migration**
```bash
# Apply migrations for each module
./scripts/database/migrate.sh admin migrate
./scripts/database/migrate.sh users migrate

# Verify module isolation
./scripts/database/migrate.sh all status
```

#### 5. **Health Verification**
```bash
# Comprehensive health check
./scripts/deploy/health-check.sh distributed

# Individual module checks
curl http://localhost:3001/health  # Admin
curl http://localhost:3002/health  # Users
curl http://localhost:80/health    # Load Balancer
```

### Manual Module Deployment
```bash
# Deploy single module (admin example)
docker build -f Dockerfile.module --build-arg MODULE_NAME=admin -t admin-module .
docker run -d --name admin-module -p 3001:3001 --env-file admin.env admin-module

# Deploy single module (users example)  
docker build -f Dockerfile.module --build-arg MODULE_NAME=users -t users-module .
docker run -d --name users-module -p 3002:3002 --env-file users.env users-module
```

## 🗄️ Database Management

### Module Isolation Strategy
Each module maintains its own database tables with strict prefixes:
- **Admin Module**: `admin_*` tables
- **Users Module**: `users_*` tables and `users` table

### Migration Commands
```bash
# Apply all module migrations
./scripts/database/migrate.sh all migrate

# Apply specific module migration
./scripts/database/migrate.sh admin migrate
./scripts/database/migrate.sh users migrate

# Check migration status
./scripts/database/migrate.sh all status

# Rollback module (DANGEROUS - causes data loss)
./scripts/database/migrate.sh admin rollback
```

### Database Health Checks
```bash
# Built-in health functions (requires psql)
psql $DATABASE_URL -c "SELECT * FROM check_module_isolation();"
psql $DATABASE_URL -c "SELECT get_module_health('admin_');"
psql $DATABASE_URL -c "SELECT get_module_health('users_');"
```

### Production Database Setup
```sql
-- Connect to production database
-- Run these commands for initial setup

-- Create application user
CREATE USER app_user WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE app TO app_user;
GRANT CREATE ON DATABASE app TO app_user;

-- Grant schema permissions
GRANT ALL ON SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO app_user;

-- Install required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

## ⚙️ Environment Configuration

### Configuration Files
- `deployment/config/monolith.env.template` - Monolith deployment
- `deployment/config/admin.env.template` - Admin module
- `deployment/config/users.env.template` - Users module

### Key Environment Variables

#### **Database Configuration**
```bash
DATABASE_URL=postgresql://user:password@host:port/database
DB_POOL_SIZE=10        # Connection pool size
DB_TIMEOUT=30000       # Query timeout in ms
```

#### **Security Settings**
```bash
JWT_SECRET=your-secure-jwt-secret-256-bit
SESSION_SECRET=your-secure-session-secret-256-bit
BCRYPT_ROUNDS=12       # Password hashing rounds
```

#### **Module Communication (Distributed Mode)**
```bash
SERVICE_REGISTRY_URL=http://service-registry:8500
INTER_MODULE_SECRET=your-inter-module-secret
ADMIN_MODULE_URL=http://admin-module:3001
USERS_MODULE_URL=http://users-module:3002
```

#### **Feature Flags**
```bash
# Core features
FEATURE_REGISTRATION=true
FEATURE_PASSWORD_RESET=false
FEATURE_EMAIL_VERIFICATION=false

# Admin features  
FEATURE_MODULE_REGISTRATION=true
FEATURE_AUDIT_LOGGING=true
FEATURE_REAL_TIME_MONITORING=false
```

### Environment-Specific Configurations

#### **Development**
```bash
NODE_ENV=development
LOG_LEVEL=debug
CORS_ORIGIN=http://localhost:3000
```

#### **Staging**
```bash
NODE_ENV=staging
LOG_LEVEL=info
CORS_ORIGIN=https://staging.yourdomain.com
METRICS_ENABLED=true
```

#### **Production**
```bash
NODE_ENV=production
LOG_LEVEL=warn
CORS_ORIGIN=https://yourdomain.com
METRICS_ENABLED=true
TRACING_ENABLED=true
```

## 🔄 CI/CD Workflows

### GitHub Actions Workflows

#### **Monolith Deployment** (`.github/workflows/deploy-monolith.yml`)
- Triggers on pushes to `main` and `production` branches
- Builds complete application with all modules
- Deploys to staging and production environments
- Comprehensive health checks

#### **Module Deployment** (`.github/workflows/deploy-modules.yml`)
- Triggers on changes to specific modules
- Builds only changed modules
- Independent deployment per module
- Supports partial deployments

### Workflow Configuration
```yaml
# Set these secrets in your GitHub repository:
secrets:
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
  JWT_SECRET: ${{ secrets.JWT_SECRET }}
  SESSION_SECRET: ${{ secrets.SESSION_SECRET }}
```

### Manual Deployment Triggers
```bash
# Trigger monolith deployment
gh workflow run deploy-monolith.yml \
  --ref main \
  --field environment=production

# Trigger module deployment
gh workflow run deploy-modules.yml \
  --ref main \
  --field modules=admin,users \
  --field environment=staging
```

### Deployment Strategies

#### **Blue-Green Deployment** (Recommended for Production)
1. Deploy new version to "green" environment
2. Run health checks and validation tests
3. Switch traffic from "blue" to "green"  
4. Keep "blue" as fallback for quick rollback

#### **Rolling Updates** (For Distributed Modules)
1. Update one module instance at a time
2. Health check each instance before continuing
3. Maintain service availability throughout deployment
4. Rollback individual modules if issues occur

## 📊 Monitoring and Health Checks

### Health Check Endpoints

#### **Monolith Mode**
```bash
# Application health
GET /health

# Module-specific health
GET /api/admin/health
GET /api/users/health
```

#### **Distributed Mode** 
```bash
# Individual modules
GET http://admin-module:3001/health
GET http://users-module:3002/health

# Load balancer aggregated health
GET http://load-balancer/health
```

### Health Check Script
```bash
# Auto-detect deployment mode and run checks
./scripts/deploy/health-check.sh

# Specific mode with custom timeout
./scripts/deploy/health-check.sh distributed 60

# Results saved to deployment/logs/health-check-*.json
```

### Monitoring Stack Integration

#### **Prometheus Metrics**
```bash
# Enable metrics in environment
METRICS_ENABLED=true
METRICS_PORT=9090

# Access metrics endpoint
curl http://localhost:9090/metrics
```

#### **Health Check JSON Response**
```json
{
  "deployment_mode": "distributed",
  "overall_healthy": true,
  "timestamp": "2025-01-15T12:00:00Z",
  "checks": [
    {
      "endpoint": "http://admin-module:3001/health",
      "description": "Admin Module Health",
      "status_code": 200,
      "healthy": true,
      "response_time_ms": 45
    }
  ]
}
```

### Alerting Configuration
```yaml
# Add to your monitoring system
alerts:
  - name: ModuleUnhealthy
    condition: health_check.healthy == false
    severity: critical
    
  - name: HighResponseTime  
    condition: health_check.response_time_ms > 5000
    severity: warning
```

## 🔧 Troubleshooting

### Common Issues

#### **Module Won't Start**
```bash
# Check logs
docker logs admin-module
docker logs users-module

# Verify environment configuration
docker exec admin-module env | grep DATABASE_URL

# Test database connection
./scripts/database/migrate.sh admin status
```

#### **Database Connection Issues**
```bash
# Test connection directly
psql $DATABASE_URL -c "SELECT 1;"

# Check module table isolation
./scripts/database/migrate.sh all status

# Reset database (DANGEROUS)
./scripts/database/migrate.sh admin rollback
./scripts/database/migrate.sh admin migrate
```

#### **Load Balancer Issues**
```bash
# Check NGINX configuration
docker exec nginx nginx -t

# View NGINX access logs
docker logs nginx

# Test upstream connectivity
docker exec nginx curl http://admin-module:3001/health
```

#### **Build Failures**
```bash
# Clean build artifacts
rm -rf dist/ packages/

# Rebuild specific module
./scripts/build/build-module.sh admin standalone

# Check build logs
ls -la deployment/logs/
```

### Debug Commands
```bash
# Container inspection
docker inspect admin-module
docker exec -it admin-module sh

# Network connectivity
docker network ls
docker network inspect <network-name>

# Resource usage
docker stats admin-module users-module
```

### Log Collection
```bash
# Collect all container logs
mkdir -p logs
docker logs admin-module > logs/admin-$(date +%Y%m%d).log
docker logs users-module > logs/users-$(date +%Y%m%d).log
docker logs nginx > logs/nginx-$(date +%Y%m%d).log

# Application-specific logs
docker exec admin-module cat /var/log/admin.log
```

## 🏭 Production Considerations

### Security Best Practices

#### **Environment Security**
- Use strong, unique secrets for each environment
- Rotate JWT and session secrets regularly
- Enable HTTPS/TLS in production
- Implement proper CORS configuration
- Use environment-specific database credentials

#### **Database Security**
```sql
-- Production database security
REVOKE ALL ON SCHEMA public FROM PUBLIC;
CREATE ROLE app_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_readonly;

-- Module-specific users
CREATE USER admin_user WITH PASSWORD 'strong_password';
GRANT admin_user TO app_user;
```

#### **Container Security**
- Use non-root users in containers
- Implement resource limits
- Regular security scanning of images
- Keep base images updated

### Performance Optimization

#### **Database Optimization**
```sql
-- Add indices for common queries
CREATE INDEX idx_admin_modules_active ON admin_modules(is_active);
CREATE INDEX idx_users_sessions_token ON users_sessions(token);
CREATE INDEX idx_users_sessions_expires ON users_sessions(expires_at);
```

#### **Connection Pooling**
```bash
# Adjust pool sizes based on load
DB_POOL_SIZE=20                    # Monolith
DB_POOL_SIZE=10                    # Per module in distributed
```

#### **Caching Strategy**
```bash
# Redis for session storage (optional)
REDIS_URL=redis://redis:6379
SESSION_STORE=redis

# Enable application caching
CACHE_ENABLED=true
CACHE_TTL=3600
```

### Scaling Considerations

#### **Horizontal Scaling**
```yaml
# Docker Compose scaling
services:
  admin-module:
    scale: 3                       # Run 3 instances
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
```

#### **Load Balancing**
```nginx
# NGINX upstream scaling
upstream admin-module {
    server admin-module-1:3001;
    server admin-module-2:3001;
    server admin-module-3:3001;
}
```

#### **Database Scaling**
- Consider read replicas for heavy read workloads
- Implement connection pooling (PgBouncer)
- Monitor query performance and optimize slow queries
- Consider partitioning for large tables

### Backup and Recovery

#### **Database Backups**
```bash
# Regular backups
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Module-specific backups
pg_dump $DATABASE_URL \
  --table="admin_*" \
  > admin-backup-$(date +%Y%m%d).sql
```

#### **Container State**
```bash
# Export container images
docker save admin-module:latest > admin-module.tar
docker save users-module:latest > users-module.tar

# Volume backups
docker run --rm -v postgres_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/postgres-backup.tar.gz /data
```

### Disaster Recovery Plan

1. **Recovery Time Objective (RTO)**: < 30 minutes
2. **Recovery Point Objective (RPO)**: < 15 minutes  
3. **Backup frequency**: Every 6 hours
4. **Testing frequency**: Monthly disaster recovery drills

---

## 🎉 Conclusion

This deployment framework provides comprehensive support for both monolith and distributed deployment modes. The modular architecture ensures that modules can be deployed independently while maintaining database isolation and inter-module communication.

### Key Benefits
- **Flexibility**: Support for both deployment modes
- **Scalability**: Independent module scaling in distributed mode
- **Reliability**: Comprehensive health checks and monitoring
- **Maintainability**: Clear separation of concerns and automated deployments
- **Security**: Production-ready security configurations

### Next Steps
1. Set up CI/CD workflows in your repository
2. Configure environment variables for your target deployment
3. Run health checks to verify deployment
4. Set up monitoring and alerting
5. Plan your scaling and backup strategies

For additional support or questions, refer to the module documentation or create an issue in the repository.

---

**Happy Deploying!** 🚀