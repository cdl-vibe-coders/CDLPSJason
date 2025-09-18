# Overview

This is a modular backend management system built with Express.js, React, and PostgreSQL. The application features a dynamic module architecture that supports both monolith and distributed deployment modes. It includes modules for admin management, user authentication, and code review functionality with AI-powered analysis. The system provides a management dashboard for configuring modules, managing user permissions, and monitoring system health.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **React with TypeScript**: Main frontend framework using functional components and hooks
- **Vite**: Build tool and development server for fast hot module replacement
- **Wouter**: Lightweight routing library for client-side navigation
- **TanStack Query**: Data fetching and caching library for API state management
- **Tailwind CSS + shadcn/ui**: Utility-first CSS framework with pre-built component library
- **Theme System**: Dark/light mode support with system preference detection

## Backend Architecture
- **Modular Express.js**: Dynamic module loading system supporting both monolith and distributed deployment
- **Module Registry**: Central registry for discovering, loading, and managing modules at runtime
- **Inter-Module Communication**: Service registry and event bus for module-to-module communication
- **Session-based Authentication**: Secure session management with HTTP-only cookies
- **Role-based Access Control**: Permission system with user roles and module-specific access

## Module System
- **Core Modules**: Admin (system management), Users (authentication), CodeReview (AI analysis)
- **Bootstrap Pattern**: Each module has a bootstrap function that registers routes, storage, and lifecycle hooks
- **Isolated Storage**: Modules have their own storage implementations with namespace isolation
- **API Prefixing**: Each module uses distinct API prefixes (/api/admin, /api/users, etc.)

## Data Architecture
- **Drizzle ORM**: Type-safe database ORM with PostgreSQL dialect
- **Schema Isolation**: Module tables use prefixes (admin_, users_, codereview_) for logical separation
- **Cross-Module References**: Opaque references between modules without foreign key constraints
- **Migration System**: Centralized migration management through Drizzle Kit

## Deployment Modes
- **Monolith Mode**: Single container with all modules and shared database
- **Distributed Mode**: Independent containers per module with service discovery
- **Docker Support**: Multi-stage builds for both deployment patterns
- **Standalone Runners**: Individual module entry points for distributed deployment

# External Dependencies

## Database
- **PostgreSQL 16+**: Primary database with Neon serverless support
- **Connection Pooling**: @neondatabase/serverless for scalable connections

## AI Services
- **Anthropic Claude**: AI-powered code review using claude-sonnet-4-20250514 model
- **Code Analysis**: Security, performance, and best practices evaluation

## Authentication & Security
- **bcrypt**: Password hashing with configurable salt rounds
- **Session Management**: Secure token generation and expiration handling
- **Middleware Protection**: Route-level authentication and authorization

## Frontend Libraries
- **Radix UI**: Accessible component primitives for forms, dialogs, and navigation
- **React Hook Form**: Form handling with validation
- **Zod**: Runtime type validation for API contracts
- **Lucide React**: Icon library for consistent UI elements

## Development Tools
- **TypeScript**: Type safety across frontend and backend
- **ESBuild**: Fast JavaScript bundling for production builds
- **TailwindCSS**: Utility-first styling with custom design system
- **Date-fns**: Date manipulation and formatting utilities