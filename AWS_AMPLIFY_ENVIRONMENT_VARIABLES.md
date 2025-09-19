# AWS Amplify Environment Variables Guide

This guide provides comprehensive documentation for configuring environment variables for AWS Amplify deployment of the **frontend-only static hosting** for the modular management system.

## 🏗️ **IMPORTANT: Deployment Architecture**

**AWS Amplify Configuration**: Frontend-only static hosting  
**Backend Deployment**: External servers (separate from Amplify)  
**Environment Variables**: Only VITE_* variables affect the frontend build

⚠️ **Critical Understanding**: Backend environment variables (SESSION_SECRET, DATABASE_URL, etc.) are **NOT used** in Amplify static hosting and should **NOT** be configured in Amplify Console.

## Table of Contents
- [Architecture Overview](#architecture-overview)
- [Frontend Environment Variables](#frontend-environment-variables)
- [Backend Configuration](#backend-configuration)
- [AWS Amplify Console Setup](#aws-amplify-console-setup)
- [Branch-Specific Configuration](#branch-specific-configuration)
- [Validation and Testing](#validation-and-testing)
- [Troubleshooting](#troubleshooting)

## Architecture Overview

### Frontend (AWS Amplify)
- **Purpose**: Static React/Vite application hosting
- **Build Output**: `dist/public` directory
- **Environment Variables**: Only VITE_* prefixed variables
- **Runtime**: Client-side JavaScript in browser
- **Configuration**: amplify.yml with frontend-only build

### Backend (External Deployment)
- **Purpose**: API server, database, authentication
- **Deployment**: Separate servers (AWS EC2, Railway, Render, etc.)
- **Environment Variables**: SESSION_SECRET, DATABASE_URL, ANTHROPIC_API_KEY
- **Runtime**: Node.js/Express server
- **CORS**: Must allow requests from Amplify domain

## Frontend Environment Variables

### 🟢 FRONTEND (For Amplify Console)

These are the **ONLY** variables that should be configured in AWS Amplify Console:

| Variable | Description | Required | Example Value |
|----------|-------------|----------|---------------|
| `VITE_API_URL` | External backend API endpoint | ✅ | `https://api.yourdomain.com` |
| `VITE_ENVIRONMENT` | Build environment indicator | ❌ | `production` |
| `VITE_SECURE_MODE` | Enhanced security features | ❌ | `true` |
| `VITE_DISABLE_DEV_TOOLS` | Disable React dev tools | ❌ | `true` |
| `VITE_FEATURE_ANALYTICS` | Enable frontend analytics | ❌ | `true` |
| `VITE_FEATURE_ERROR_REPORTING` | Enable error reporting | ❌ | `true` |

### ❌ BACKEND (NOT for Amplify Console)

**These variables are for your external backend server only:**

| Variable | Backend Purpose | Deploy Location |
|----------|----------------|----------------|
| `SESSION_SECRET` | Authentication session encryption | Backend server only |
| `DATABASE_URL` | PostgreSQL connection | Backend server only |
| `ANTHROPIC_API_KEY` | AI code review features | Backend server only |
| `COOKIE_DOMAIN` | Custom domain cookie settings | Backend server only |
| `ALLOWED_ORIGINS` | CORS configuration | Backend server only |
| `PORT` | Server port | Backend server only |
| `NODE_ENV` | Runtime environment | Backend server only |

## Backend Configuration

**Important**: These variables must be configured on your external backend deployment, not in AWS Amplify Console.

### Required Backend Variables

```bash
# External backend server environment
NODE_ENV=production
SESSION_SECRET=your-secure-random-session-secret-min-32-chars
DATABASE_URL=postgresql://username:password@hostname:port/database
ALLOWED_ORIGINS=https://your-amplify-domain.amplifyapp.com
PORT=5000
```

### Optional Backend Variables

```bash
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
COOKIE_DOMAIN=yourdomain.com
SENTRY_DSN=https://...@sentry.io/...
```

### CORS Configuration for Backend

Your backend server must be configured to accept requests from your Amplify frontend:

```bash
# Add your Amplify domain to ALLOWED_ORIGINS
ALLOWED_ORIGINS=https://main.d1234567890.amplifyapp.com,https://yourdomain.com
```

### Cross-Origin Authentication Requirements

**CRITICAL**: The backend authentication system supports cross-origin requests through a hybrid approach:

#### Authentication Methods Supported:
1. **Same-origin requests**: Secure cookies with `sameSite: 'lax'`
2. **Cross-origin requests**: `Authorization: Bearer` headers

#### Required Backend Configuration:
```bash
# Production: Exact origins only (no wildcards allowed)
NODE_ENV=production
ALLOWED_ORIGINS=https://main.d1234567890.amplifyapp.com

# Multiple origins (comma-separated, no spaces)
ALLOWED_ORIGINS=https://main.d1234567890.amplifyapp.com,https://staging.d1234567890.amplifyapp.com
```

#### Authentication Flow for Amplify Frontend:
1. **Login/Registration**: POST to `/api/auth/login` or `/api/auth/register`
   - Returns JSON: `{"success": true, "user": {...}, "sessionToken": "..."}`
   - Frontend stores `sessionToken` for subsequent requests

2. **Authenticated Requests**: Use `Authorization: Bearer <sessionToken>`
   ```javascript
   fetch('https://your-backend-api.com/api/auth/me', {
     headers: {
       'Authorization': `Bearer ${sessionToken}`,
       'Content-Type': 'application/json'
     }
   })
   ```

#### Security Features:
- **Production**: Only exactly matching origins in `ALLOWED_ORIGINS` are allowed
- **Blocked origins are logged**: Check backend logs for unauthorized access attempts
- **Session validation**: All endpoints verify token expiration and user status
- **Automatic cleanup**: Expired sessions are removed automatically

#### Production Verification:
```bash
# Test cross-origin authentication flow:

# 1. Register/Login from Amplify frontend
curl -X POST https://your-backend-api.com/api/auth/login \
  -H "Content-Type: application/json" \
  -H "Origin: https://main.d1234567890.amplifyapp.com" \
  -d '{"username":"user","password":"pass"}'

# 2. Use returned token for authenticated requests
curl -X GET https://your-backend-api.com/api/auth/me \
  -H "Authorization: Bearer <sessionToken>" \
  -H "Origin: https://main.d1234567890.amplifyapp.com"
```

## AWS Amplify Console Setup

### Step 1: Access Environment Variables

1. Open AWS Amplify Console
2. Select your application
3. Go to **App settings** → **Environment variables**
4. Click **Manage variables**

### Step 2: Add Frontend Variables Only

**IMPORTANT**: Only add VITE_* prefixed variables in Amplify Console.

| Key | Value | Environment |
|-----|-------|-------------|
| `VITE_API_URL` | `https://your-backend-api.com` | All |
| `VITE_SECURE_MODE` | `true` | Production |
| `VITE_DISABLE_DEV_TOOLS` | `true` | Production |

### Step 3: Avoid Common Mistakes

**❌ DO NOT add these to Amplify Console:**
```bash
# These are backend-only variables - DO NOT add to Amplify
SESSION_SECRET=...          # ❌ Backend only
DATABASE_URL=...            # ❌ Backend only
ANTHROPIC_API_KEY=...       # ❌ Backend only
COOKIE_DOMAIN=...           # ❌ Backend only
ALLOWED_ORIGINS=...         # ❌ Backend only
PORT=...                    # ❌ Backend only
NODE_ENV=...                # ❌ Backend only
```

### Step 4: Save and Deploy

1. Click **Save**
2. Trigger a new deployment to apply variables
3. Monitor build logs for validation

## Branch-Specific Configuration

### Production Branch (main/master)
```bash
# Amplify Console variables (frontend-only)
VITE_API_URL=https://api.yourdomain.com
VITE_SECURE_MODE=true
VITE_DISABLE_DEV_TOOLS=true
VITE_FEATURE_ANALYTICS=true
```

### Staging Branch (staging/stage)
```bash
# Amplify Console variables (frontend-only)
VITE_API_URL=https://staging-api.yourdomain.com
VITE_SECURE_MODE=false
VITE_DEBUG_MODE=true
VITE_FEATURE_ANALYTICS=true
```

### Development Branch (develop/dev)
```bash
# Amplify Console variables (frontend-only)
VITE_API_URL=https://dev-api.yourdomain.com
VITE_DEBUG_MODE=true
VITE_VERBOSE_LOGGING=true
VITE_FEATURE_ANALYTICS=false
```

## Validation and Testing

### Frontend Validation (Amplify)

The application validates frontend environment variables during build:

```bash
# Runs automatically during Amplify build
./scripts/amplify/validate-env.sh
```

**Manual Frontend Validation**:
```bash
# Check frontend variables are set
echo "VITE_API_URL: $VITE_API_URL"
echo "VITE_SECURE_MODE: $VITE_SECURE_MODE"
```

### Backend Validation (External Server)

Your backend server should validate its own environment variables:

```bash
# Check backend variables on your external server
echo "NODE_ENV: $NODE_ENV"
echo "SESSION_SECRET length: ${#SESSION_SECRET}"
echo "DATABASE_URL format: ${DATABASE_URL:0:15}..."

# Test database connection
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT 1').then(() => console.log('✅ Database connected')).catch(e => console.log('❌ Database error:', e.message));
"
```

### Integration Testing

Test frontend-backend communication:

```bash
# Test API connectivity from frontend
curl https://your-amplify-domain.amplifyapp.com
# Should load the React application

# Test backend API separately
curl https://your-backend-api.com/api/health
# Should return backend health status
```

## Troubleshooting

### Common Issues

#### Build Failures

**Error**: "VITE_API_URL not configured"
```bash
# Solution: Add to Amplify Console
VITE_API_URL=https://your-backend-api.com
```

#### CORS Errors

**Error**: "Access to XMLHttpRequest blocked by CORS policy"
```bash
# Solution: Configure ALLOWED_ORIGINS on your backend server (NOT Amplify)
ALLOWED_ORIGINS=https://main.d1234567890.amplifyapp.com,https://yourdomain.com
```

#### API Connection Issues

**Error**: Frontend cannot connect to backend
1. **Check VITE_API_URL** is correctly set in Amplify Console
2. **Verify backend server** is running and accessible
3. **Check CORS configuration** on backend server
4. **Test backend endpoints** directly with curl

### Debug Steps

1. **Check Amplify Build Logs**
   - Go to Amplify Console → Build History
   - Review frontend build process
   - Look for VITE_* variable validation

2. **Verify Frontend Variables**
   - Amplify Console → App Settings → Environment Variables
   - Ensure only VITE_* variables are set
   - Check for typos in variable names

3. **Test Static Site**
   ```bash
   # Frontend should load without API calls
   curl https://your-amplify-domain.amplifyapp.com
   ```

4. **Test Backend Separately**
   ```bash
   # Backend health check
   curl https://your-backend-api.com/api/health
   ```

### Performance Optimization

1. **Frontend Optimization**
   ```bash
   # Already configured in build process
   VITE_MINIFY=true
   GENERATE_SOURCEMAP=false
   ```

2. **Backend Optimization**
   ```bash
   # Configure on your backend server
   NODE_OPTIONS=--max-old-space-size=4096
   DATABASE_URL=postgresql://user:pass@host:5432/db?max_connections=20
   ```

## Support and Maintenance

### Monitoring

1. **Frontend Monitoring** (Amplify):
   - Build success/failure rates
   - Static asset delivery
   - CDN performance

2. **Backend Monitoring** (External Server):
   - API response times
   - Database connections
   - Authentication errors

### Documentation Updates

This guide should be updated when:
- New frontend features require VITE_* variables
- Backend API endpoints change
- CORS requirements change
- New deployment environments are added

### Contact and Resources

- **AWS Amplify Documentation**: [docs.amplify.aws](https://docs.amplify.aws)
- **Vite Environment Variables**: [vitejs.dev/guide/env-and-mode](https://vitejs.dev/guide/env-and-mode.html)
- **CORS Configuration**: [developer.mozilla.org/docs/Web/HTTP/CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

---

**Last Updated**: September 2025  
**Version**: 2.0 - **CORRECTED ARCHITECTURE**  
**Compatible with**: AWS Amplify Static Hosting, External Backend Servers