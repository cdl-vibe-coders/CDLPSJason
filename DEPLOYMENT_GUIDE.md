# 🚀 Deployment Guide

This guide covers the complete deployment process for both monolith and distributed module architectures.

## 🏗️ Architecture Options

### Option 1: Monolith Deployment
Deploy the complete application with all modules in a single container.

### Option 2: Distributed Modules  
Deploy individual modules as separate services (admin, users, etc.).

---

## 📦 Building Docker Images

### Prerequisites
- Docker 20.10+
- Node.js 20+ (for local development)
- Access to container registry (GitHub Container Registry)

### Monolith Build

```bash
# Build monolith image
docker build -f Dockerfile.monolith -t myapp-monolith:latest .

# Tag for registry
docker tag myapp-monolith:latest ghcr.io/username/myapp-monolith:latest

# Push to registry
docker push ghcr.io/username/myapp-monolith:latest
```

### Module Builds

```bash
# Build admin module
docker build -f Dockerfile.module --build-arg MODULE_NAME=admin -t myapp-admin:latest .

# Build users module  
docker build -f Dockerfile.module --build-arg MODULE_NAME=users -t myapp-users:latest .

# Tag and push
docker tag myapp-admin:latest ghcr.io/username/myapp-admin:latest
docker tag myapp-users:latest ghcr.io/username/myapp-users:latest
docker push ghcr.io/username/myapp-admin:latest
docker push ghcr.io/username/myapp-users:latest
```

---

## 🚀 Local Development

### Running Monolith Locally

```bash
# Install dependencies
npm ci

# Start development server
npm run dev

# Application runs on http://localhost:5000
# Health check: http://localhost:5000/api/health
```

### Running Modules Locally

```bash
# Build individual modules  
chmod +x scripts/build/build-module.sh
./scripts/build/build-module.sh admin standalone
./scripts/build/build-module.sh users standalone

# Run admin module
cd dist/admin && npm install && npm start
# Admin runs on http://localhost:3001
# Health check: http://localhost:3001/health

# Run users module  
cd dist/users && npm install && npm start  
# Users runs on http://localhost:3002
# Health check: http://localhost:3002/health
```

---

## 🐳 Docker Deployment

### Monolith with Docker Compose

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    image: ghcr.io/username/myapp-monolith:latest
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
    ports:
      - "5000:5000"
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:5000/api/health').then(() => process.exit(0)).catch(() => process.exit(1))"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    restart: unless-stopped
```

### Distributed Modules with Docker Compose

```yaml
# docker-compose.modules.yml
version: '3.8'
services:
  admin-module:
    image: ghcr.io/username/myapp-admin:latest
    environment:
      - NODE_ENV=production
      - PORT=3001
      - DATABASE_URL=${DATABASE_URL}
      - MODULE_NAME=admin
    ports:
      - "3001:3001"
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:3001/health').then(() => process.exit(0)).catch(() => process.exit(1))"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 15s
    restart: unless-stopped

  users-module:
    image: ghcr.io/username/myapp-users:latest
    environment:
      - NODE_ENV=production
      - PORT=3002
      - DATABASE_URL=${DATABASE_URL}
      - MODULE_NAME=users
    ports:
      - "3002:3002"
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:3002/health').then(() => process.exit(0)).catch(() => process.exit(1))"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 15s
    restart: unless-stopped
```

---

## ⚙️ Environment Configuration

### Required Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# Application  
NODE_ENV=production
PORT=5000  # For monolith, 3001/3002 for modules

# Module-specific (for distributed deployment)
MODULE_NAME=admin  # or users
```

### Environment File Templates

The deployment includes environment templates:
- `deployment/config/monolith.env.template`
- `deployment/config/admin.env.template`
- `deployment/config/users.env.template`

---

## 🔄 CI/CD Pipeline

### Automatic Deployments

The project includes GitHub Actions workflows:

1. **Monolith Deployment** (`.github/workflows/deploy-monolith.yml`)
   - Builds and pushes Docker image
   - Deploys to staging/production
   - Runs health checks

2. **Module Deployment** (`.github/workflows/deploy-modules.yml`) 
   - Detects changed modules
   - Builds only affected modules
   - Deploys independently

### Manual Deployment

```bash
# Trigger deployment manually
gh workflow run deploy-monolith.yml -f environment=production
gh workflow run deploy-modules.yml -f modules=admin,users -f environment=staging
```

---

## 🏥 Health Checks

### Endpoints

| Architecture | Endpoint | Port |
|--------------|----------|------|
| Monolith | `/api/health` | 5000 |
| Admin Module | `/health` | 3001 |
| Users Module | `/health` | 3002 |

### Health Check Scripts

```bash
# Test monolith health
curl -f http://localhost:5000/api/health

# Test module health
curl -f http://localhost:3001/health  # Admin
curl -f http://localhost:3002/health  # Users
```

### Expected Response

```json
{
  "status": "healthy",
  "timestamp": "2025-09-17T21:59:57.792Z",
  "architecture": "modular",
  "module": "admin"  // For modules only
}
```

---

## 📊 Monitoring & Logging

### Docker Logs

```bash
# View monolith logs
docker compose logs -f app

# View module logs  
docker compose -f docker-compose.modules.yml logs -f admin-module
docker compose -f docker-compose.modules.yml logs -f users-module
```

### Application Metrics

Both architectures provide:
- Health check endpoints
- Request logging
- Error tracking
- Performance metrics

---

## 🛠️ Troubleshooting

### Common Issues

1. **Build Failures**
   ```bash
   # Clear Docker cache
   docker system prune -a
   
   # Rebuild without cache
   docker build --no-cache -f Dockerfile.monolith .
   ```

2. **Health Check Failures**
   ```bash
   # Check container logs
   docker logs <container-id>
   
   # Test health endpoint manually
   docker exec -it <container-id> curl localhost:5000/api/health
   ```

3. **Database Connection Issues**
   ```bash
   # Verify DATABASE_URL format
   echo $DATABASE_URL
   
   # Test database connectivity
   docker exec -it <container-id> node -e "console.log(process.env.DATABASE_URL)"
   ```

### Performance Optimization

1. **Resource Limits**: Configured in docker-compose files
2. **Memory Usage**: 512MB max per module, 1GB for monolith
3. **CPU Limits**: 0.3 CPU per module, 0.5 for monolith

---

## 🔒 Security Considerations

### Container Security
- Non-root user (nodeuser:nodejs)
- Minimal base image (node:20-alpine)
- No unnecessary packages

### Network Security  
- Expose only required ports
- Use internal Docker networks
- Environment variable management

### Database Security
- Use connection pooling
- Rotate DATABASE_URL regularly
- Enable SSL/TLS connections

---

## 📋 Deployment Checklist

### Pre-Deployment
- [ ] Environment variables configured
- [ ] Database accessible
- [ ] Docker registry access
- [ ] Health check endpoints tested

### Deployment
- [ ] Build Docker images
- [ ] Push to registry
- [ ] Update docker-compose files
- [ ] Deploy services
- [ ] Verify health checks

### Post-Deployment
- [ ] Monitor application logs
- [ ] Verify all endpoints responding
- [ ] Check database connections
- [ ] Monitor resource usage

---

*This deployment guide covers both monolith and distributed architectures. Choose the approach that best fits your scaling and operational requirements.*