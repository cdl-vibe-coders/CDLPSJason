#!/usr/bin/env node

/**
 * Standalone Admin Module Entry Point
 * Run with: node server/standalone/admin.js [port]
 */

import { runAdminStandalone } from "../registry/standalone";

const port = parseInt(process.env.PORT || process.argv[2] || '3001', 10);

console.log(`🚀 Starting Admin Module as standalone service on port ${port}...`);

runAdminStandalone(port).catch(error => {
  console.error('❌ Failed to start admin module:', error);
  process.exit(1);
});