-- ============= DATABASE INITIALIZATION SCRIPT =============
-- Creates databases and users for modular application deployment
-- This script runs when the PostgreSQL container starts for the first time

-- Create application database if it doesn't exist
-- Note: This file runs as postgres user, so we have full privileges

\echo 'Creating application databases and users...'

-- ============= PRODUCTION DATABASE SETUP =============

-- Create main application database
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'app') THEN
        PERFORM dblink_exec('dbname=postgres', 'CREATE DATABASE app');
        RAISE NOTICE 'Database "app" created successfully';
    ELSE
        RAISE NOTICE 'Database "app" already exists';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- Fallback method without dblink
        RAISE NOTICE 'Using fallback database creation method';
END $$;

-- Create application user with appropriate permissions
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_user WHERE usename = 'app_user') THEN
        CREATE USER app_user WITH PASSWORD 'app_secure_password';
        RAISE NOTICE 'User "app_user" created successfully';
    ELSE
        RAISE NOTICE 'User "app_user" already exists';
    END IF;
END $$;

-- Grant permissions to application user
GRANT CONNECT ON DATABASE app TO app_user;
GRANT CREATE ON DATABASE app TO app_user;

-- Connect to the application database to set up schema permissions
\c app;

-- Grant schema permissions
GRANT ALL ON SCHEMA public TO app_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO app_user;

-- ============= DEVELOPMENT DATABASE SETUP =============

-- Create development database
\c postgres;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'app_dev') THEN
        CREATE DATABASE app_dev;
        RAISE NOTICE 'Database "app_dev" created successfully';
    ELSE
        RAISE NOTICE 'Database "app_dev" already exists';
    END IF;
END $$;

-- Create development user
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_user WHERE usename = 'dev_user') THEN
        CREATE USER dev_user WITH PASSWORD 'dev_password';
        RAISE NOTICE 'User "dev_user" created successfully';
    ELSE
        RAISE NOTICE 'User "dev_user" already exists';
    END IF;
END $$;

-- Grant permissions to development user
GRANT CONNECT ON DATABASE app_dev TO dev_user;
GRANT CREATE ON DATABASE app_dev TO dev_user;

-- Connect to the development database to set up schema permissions
\c app_dev;

-- Grant schema permissions
GRANT ALL ON SCHEMA public TO dev_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO dev_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO dev_user;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO dev_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO dev_user;

-- ============= MODULE-SPECIFIC SETUP =============

-- Create extension for UUID generation (needed for our schema)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create a function to check module table isolation
CREATE OR REPLACE FUNCTION check_module_isolation()
RETURNS TABLE(
    module_name TEXT,
    table_count BIGINT,
    table_names TEXT[]
) 
LANGUAGE plpgsql
AS $$
BEGIN
    -- Admin module tables
    RETURN QUERY
    SELECT 
        'admin'::TEXT,
        COUNT(*)::BIGINT,
        ARRAY_AGG(table_name::TEXT)
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name LIKE 'admin_%';
    
    -- Users module tables
    RETURN QUERY
    SELECT 
        'users'::TEXT,
        COUNT(*)::BIGINT,
        ARRAY_AGG(table_name::TEXT)
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND (table_name LIKE 'users_%' OR table_name = 'users');
END $$;

-- Create a function to get module health information
CREATE OR REPLACE FUNCTION get_module_health(module_prefix TEXT)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
    result JSON;
    table_count INTEGER;
    total_rows BIGINT := 0;
    table_name_var TEXT;
    row_count BIGINT;
BEGIN
    -- Count tables for this module
    SELECT COUNT(*)
    INTO table_count
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name LIKE module_prefix || '%';
    
    -- Count total rows across all module tables
    FOR table_name_var IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name LIKE module_prefix || '%'
    LOOP
        EXECUTE format('SELECT COUNT(*) FROM %I', table_name_var) INTO row_count;
        total_rows := total_rows + row_count;
    END LOOP;
    
    -- Build JSON result
    result := json_build_object(
        'module', module_prefix,
        'table_count', table_count,
        'total_rows', total_rows,
        'status', CASE WHEN table_count > 0 THEN 'healthy' ELSE 'no_tables' END,
        'checked_at', NOW()
    );
    
    RETURN result;
END $$;

\echo 'Database initialization completed successfully!'
\echo 'Available databases:'
\echo '  - app (production)'
\echo '  - app_dev (development)'
\echo ''
\echo 'Available functions:'
\echo '  - check_module_isolation() - Check table isolation per module'
\echo '  - get_module_health(prefix) - Get health info for a module'
\echo ''
\echo 'Example usage:'
\echo '  SELECT * FROM check_module_isolation();'
\echo '  SELECT get_module_health(''admin_'');'