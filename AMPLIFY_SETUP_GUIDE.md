# AWS Amplify Setup Guide

This guide provides step-by-step instructions for configuring **frontend-only static hosting** in AWS Amplify Console for the modular management system.

## 🏗️ **CRITICAL: Architecture Understanding**

**AWS Amplify Role**: Frontend-only static hosting  
**Backend Location**: External servers (separate from Amplify)  
**Key Point**: Only VITE_* variables should be configured in Amplify Console

⚠️ **WARNING**: Do NOT configure backend variables (SESSION_SECRET, DATABASE_URL, etc.) in Amplify Console - they will not be used in static hosting.

## Prerequisites

Before starting, ensure you have:
- AWS Account with Amplify access
- GitHub/GitLab repository connected to Amplify
- **External backend server** deployed separately (AWS EC2, Railway, Render, etc.)
- Backend API endpoint accessible from the internet

## Step-by-Step Configuration

### Step 1: Access Amplify Console

1. Log in to [AWS Amplify Console](https://console.aws.amazon.com/amplify/)
2. Select your application from the list
3. Navigate to **App settings** → **Environment variables**
4. Click **Manage variables**

### Step 2: Configure Frontend Variables ONLY

**IMPORTANT**: Add only these VITE_* prefixed variables in Amplify Console:

#### VITE_API_URL (Required)
- **Key**: `VITE_API_URL`
- **Value**: Your external backend API endpoint
- **Environment**: All branches

**Examples**:
```bash
# Production
VITE_API_URL=https://api.yourdomain.com

# Staging
VITE_API_URL=https://staging-api.yourdomain.com

# Development
VITE_API_URL=https://dev-api.yourdomain.com
```

#### VITE_SECURE_MODE (Optional)
- **Key**: `VITE_SECURE_MODE`
- **Value**: `true` (production), `false` (development)
- **Environment**: All branches

#### VITE_DISABLE_DEV_TOOLS (Optional)
- **Key**: `VITE_DISABLE_DEV_TOOLS`
- **Value**: `true` (production), `false` (development)
- **Environment**: Production and Staging branches

#### VITE_FEATURE_ANALYTICS (Optional)
- **Key**: `VITE_FEATURE_ANALYTICS`
- **Value**: `true` or `false`
- **Environment**: All branches

### Step 3: Avoid Common Mistakes

**❌ DO NOT add these to Amplify Console:**

```bash
# These are backend-only variables - configure on your external server
SESSION_SECRET=...          # ❌ Backend server only
DATABASE_URL=...            # ❌ Backend server only
ANTHROPIC_API_KEY=...       # ❌ Backend server only
COOKIE_DOMAIN=...           # ❌ Backend server only
ALLOWED_ORIGINS=...         # ❌ Backend server only
PORT=...                    # ❌ Backend server only
NODE_ENV=...                # ❌ Backend server only
```

### Step 4: Configure Your External Backend Server

**IMPORTANT**: Configure these variables on your external backend deployment (NOT in Amplify Console):

#### Required Backend Variables
```bash
# Configure on your external backend server
NODE_ENV=production
SESSION_SECRET=your-secure-random-session-secret-min-32-chars
DATABASE_URL=postgresql://username:password@hostname:port/database
ALLOWED_ORIGINS=https://your-amplify-domain.amplifyapp.com
PORT=5000
```

#### Generate Secure Session Secret
```bash
# Generate secure session secret (run on your backend server)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

#### Optional Backend Variables
```bash
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
COOKIE_DOMAIN=yourdomain.com  # For custom domains only
SENTRY_DSN=https://...@sentry.io/...
```

### Step 5: CORS Configuration

Configure CORS on your backend server to allow requests from your Amplify frontend:

```bash
# Add to your backend server environment
ALLOWED_ORIGINS=https://main.d1234567890.amplifyapp.com,https://staging.d1234567890.amplifyapp.com
```

For custom domains:
```bash
ALLOWED_ORIGINS=https://app.yourdomain.com,https://staging.yourdomain.com
```

### Step 6: Branch-Specific Configuration

#### Production Branch (main/master)
```bash
# Amplify Console (frontend-only)
VITE_API_URL=https://api.yourdomain.com
VITE_SECURE_MODE=true
VITE_DISABLE_DEV_TOOLS=true
VITE_FEATURE_ANALYTICS=true
```

#### Staging Branch (staging/stage)
```bash
# Amplify Console (frontend-only)
VITE_API_URL=https://staging-api.yourdomain.com
VITE_SECURE_MODE=false
VITE_DEBUG_MODE=true
VITE_FEATURE_ANALYTICS=true
```

#### Development Branch (develop/dev)
```bash
# Amplify Console (frontend-only)
VITE_API_URL=https://dev-api.yourdomain.com
VITE_DEBUG_MODE=true
VITE_VERBOSE_LOGGING=true
VITE_FEATURE_ANALYTICS=false
```

### Step 7: Save and Deploy

1. Click **Save** to store frontend variables in Amplify Console
2. Go to **App settings** → **Build settings**
3. Trigger a new build by clicking **Rebuild and deploy**
4. Monitor the build process for any validation errors

## Validation Checklist

After configuring variables, verify:

### ✅ Frontend Variables Check (Amplify Console)
- [ ] `VITE_API_URL` is set and points to your external backend
- [ ] Only VITE_* prefixed variables are configured
- [ ] No backend variables (SESSION_SECRET, DATABASE_URL) in Amplify Console
- [ ] All variables are saved without typos

### ✅ Backend Configuration Check (External Server)
- [ ] `SESSION_SECRET` is at least 32 characters on backend server
- [ ] `DATABASE_URL` is correctly configured on backend server
- [ ] `ALLOWED_ORIGINS` includes your Amplify domain
- [ ] Backend server is running and accessible

### ✅ Build Validation
- [ ] Amplify build completes successfully
- [ ] Frontend loads without JavaScript errors
- [ ] Static site renders correctly
- [ ] No 500 errors during build

### ✅ Integration Validation
- [ ] Frontend can communicate with backend API
- [ ] CORS allows requests from Amplify domain
- [ ] Authentication flow works end-to-end

## Testing Your Configuration

### 1. Frontend Static Site Test
Test that your frontend builds and serves correctly:
```bash
# Frontend should load
curl https://your-amplify-domain.amplifyapp.com
# Should return HTML content
```

### 2. Backend API Test
Test your external backend separately:
```bash
# Test backend health endpoint
curl https://your-backend-api.com/api/health
# Should return API response
```

### 3. Integration Test
Test frontend-backend communication:
1. Visit your Amplify domain
2. Open browser developer tools → Network tab
3. Try to use features that call your backend API
4. Verify API calls are successful (no CORS errors)

### 4. Authentication Test (if applicable)
1. Try to register a new account
2. Log in with the account
3. Verify you can access protected areas
4. Check that sessions persist correctly

## Common Issues and Solutions

### Issue: "VITE_API_URL not defined" Error
**Solution**: Add VITE_API_URL to Amplify Console
```bash
VITE_API_URL=https://your-backend-api.com
```

### Issue: CORS Errors in Browser Console
**Solution**: Configure ALLOWED_ORIGINS on your backend server (NOT Amplify)
```bash
# On your external backend server
ALLOWED_ORIGINS=https://main.d1234567890.amplifyapp.com
```

### Issue: "Cannot connect to API" Errors
**Checks**:
1. Verify VITE_API_URL is correct in Amplify Console
2. Ensure your backend server is running and accessible
3. Test backend endpoint directly with curl
4. Check backend server logs for connection errors

### Issue: Build Fails with Backend Variable Errors
**Solution**: Remove backend variables from Amplify Console
```bash
# ❌ Remove these from Amplify Console if present
SESSION_SECRET
DATABASE_URL
ANTHROPIC_API_KEY
COOKIE_DOMAIN
ALLOWED_ORIGINS
PORT
NODE_ENV
```

### Issue: Authentication Not Working
**Solution**: Configure authentication on your backend server
1. Set SESSION_SECRET on backend server (NOT Amplify)
2. Configure COOKIE_DOMAIN on backend server (for custom domains)
3. Set ALLOWED_ORIGINS on backend server to include Amplify domain

## Advanced Configuration

### Multiple Environment Setup

1. **Create separate backend deployments** for each environment
2. **Configure different VITE_API_URL** values per Amplify branch
3. **Use branch-specific variables** in Amplify Console
4. **Set up separate databases** per backend environment

### Custom Domain Configuration

When using custom domains:

1. **Set up domain** in Amplify Console
2. **Configure DNS** with provided CNAME
3. **Update VITE_API_URL** to use custom domain
4. **Configure ALLOWED_ORIGINS** on backend to include custom domain
5. **Set COOKIE_DOMAIN** on backend server (NOT Amplify)

### Backend Deployment Options

Choose your backend deployment platform:

1. **AWS EC2**: Full control, requires server management
2. **Railway**: Easy deployment, good for Node.js apps
3. **Render**: Simple deployment, automatic scaling
4. **Heroku**: Popular choice, easy setup
5. **DigitalOcean App Platform**: Good performance/price ratio

## Security Best Practices

### Frontend Security (Amplify)
- ✅ Only use VITE_* variables for configuration
- ✅ Enable HTTPS-only in Amplify settings
- ✅ Configure security headers in amplify.yml
- ❌ Never put secrets in VITE_* variables (they're public)

### Backend Security (External Server)
- ✅ Use different secrets for each environment
- ✅ Generate cryptographically random secrets
- ✅ Configure CORS properly to allow only your frontend
- ✅ Use HTTPS for all API endpoints
- ✅ Enable database SSL connections

### API Key Protection
- ✅ Store API keys only on backend server
- ✅ Monitor API usage in provider consoles
- ✅ Set usage alerts and limits
- ❌ Never expose API keys to frontend

## Troubleshooting Deployment Flow

### 1. Check Amplify Build
```bash
# In Amplify Console → Build History
# Look for:
✅ "Frontend build successful"
✅ "Static files generated"
✅ "VITE_API_URL configured"

# Avoid seeing:
❌ "SESSION_SECRET required" (backend-only variable)
❌ "Database connection failed" (not relevant for frontend)
```

### 2. Test Static Site
```bash
# Test frontend loads
curl -I https://your-amplify-domain.amplifyapp.com
# Should return 200 OK

# Check for React/Vite assets
curl https://your-amplify-domain.amplifyapp.com | grep -i "vite\|react"
```

### 3. Test API Communication
```bash
# Test backend separately
curl https://your-backend-api.com/api/health

# Test CORS from browser console on Amplify domain
fetch('https://your-backend-api.com/api/health')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)
```

## Quick Reference

### Essential Frontend Variables (Amplify Console)
```bash
# Minimum required for frontend-only deployment
VITE_API_URL=https://your-backend-api.com
```

### Complete Frontend Setup (Amplify Console)
```bash
# Production-ready frontend configuration
VITE_API_URL=https://api.yourdomain.com
VITE_SECURE_MODE=true
VITE_DISABLE_DEV_TOOLS=true
VITE_FEATURE_ANALYTICS=true
```

### Complete Backend Setup (External Server)
```bash
# Production-ready backend configuration
NODE_ENV=production
SESSION_SECRET=$(node -e 'console.log(require("crypto").randomBytes(64).toString("hex"))')
DATABASE_URL=postgresql://user:pass@host:5432/db
ALLOWED_ORIGINS=https://main.d1234567890.amplifyapp.com
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
PORT=5000
```

---

**Remember**: Amplify = Frontend-only, External Server = Backend-only. Never mix backend variables into Amplify Console.

For comprehensive environment variable details, refer to [AWS_AMPLIFY_ENVIRONMENT_VARIABLES.md](./AWS_AMPLIFY_ENVIRONMENT_VARIABLES.md).