#!/usr/bin/env node

/**
 * Standalone Users Module Entry Point  
 * Run with: node server/standalone/users.js [port]
 */

import { runUsersStandalone } from "../registry/standalone";

const port = parseInt(process.env.PORT || process.argv[2] || '3002', 10);

console.log(`🚀 Starting Users Module as standalone service on port ${port}...`);

runUsersStandalone(port).catch(error => {
  console.error('❌ Failed to start users module:', error);
  process.exit(1);
});