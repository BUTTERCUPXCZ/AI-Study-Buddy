# Environment Setup Guide

## Quick Start

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Fill in your actual values in the `.env` file

## Required Environment Variables

### Database (Supabase PostgreSQL)
- `DATABASE_URL` - Connection pooler URL (for application use)
- `DIRECT_URL` - Direct connection URL (for migrations)

### Supabase Configuration
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Anonymous/public key
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (keep secret!)
- `SUPABASE_BUCKET_NAME` - Storage bucket name for PDFs

### Redis (Upstash)
- `UPSTASH_REDIS_REST_URL` - REST API URL
- `UPSTASH_REDIS_REST_TOKEN` - REST API token
- `REDIS_URL` - Connection URL with credentials
- `REDIS_HOST` - Redis host
- `REDIS_PORT` - Redis port (usually 6379)
- `REDIS_PASSWORD` - Redis password
- `REDIS_TLS` - Use TLS (true/false)

### Application
- `FRONTEND_URL` - Frontend application URL (e.g., http://localhost:5173)
- `GEMINI_API_KEY` - Google Gemini API key for AI features

## GitHub Secrets

For CI/CD to work, add these secrets to your GitHub repository:

1. Go to: Settings → Secrets and variables → Actions
2. Add each environment variable as a secret

**Important:** Never commit your `.env` file to version control!

## Troubleshooting

### "Missing required environment variable: DATABASE_URL"

This error occurs when the environment variables aren't loaded. Solutions:

1. **Local Development:**
   - Ensure `.env` file exists in the backend directory
   - Check that values are properly formatted (no spaces around `=`)

2. **CI/CD (GitHub Actions):**
   - Verify all secrets are configured in GitHub repository settings
   - The workflow now creates a `.env` file automatically with fallback values

3. **Production:**
   - Set environment variables in your hosting platform (Vercel, Railway, etc.)

### "PrismaConfigEnvError"

If you see this error during build/lint:
- The `prisma.config.ts` now handles missing variables gracefully
- Uses placeholder values when actual values aren't available
- This allows linting and type-checking without a real database connection
