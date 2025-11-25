#!/bin/bash

# 🚀 Quick Migration Script - Deploy Optimized PDF Pipeline
# This script helps you deploy the optimized pipeline safely

set -e  # Exit on any error

echo "🚀 TaskFlow Backend - Optimized PDF Pipeline Migration"
echo "======================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "ℹ️  $1"
}

# Step 1: Check environment
echo "Step 1: Checking environment..."
if [ ! -f ".env" ]; then
    print_error ".env file not found!"
    exit 1
fi

if [ -z "$REDIS_HOST" ] && [ -z "$(grep REDIS_HOST .env)" ]; then
    print_error "REDIS_HOST not configured in .env"
    exit 1
fi

print_success "Environment OK"
echo ""

# Step 2: Check dependencies
echo "Step 2: Checking dependencies..."
if ! command -v node &> /dev/null; then
    print_error "Node.js not found!"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    print_error "npm not found!"
    exit 1
fi

print_success "Dependencies OK"
echo ""

# Step 3: Install packages (if needed)
echo "Step 3: Installing packages..."
npm install --silent
print_success "Packages installed"
echo ""

# Step 4: Build TypeScript
echo "Step 4: Building TypeScript..."
npm run build
print_success "Build completed"
echo ""

# Step 5: Check Redis connection
echo "Step 5: Testing Redis connection..."
node -e "
const Redis = require('ioredis');
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  tls: process.env.REDIS_PASSWORD ? {} : undefined,
  lazyConnect: true,
  maxRetriesPerRequest: 1
});

redis.connect()
  .then(() => redis.ping())
  .then(() => {
    console.log('✅ Redis connection successful');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Redis connection failed:', err.message);
    process.exit(1);
  });
"

if [ $? -eq 0 ]; then
    print_success "Redis connection OK"
else
    print_error "Redis connection failed!"
    echo ""
    print_info "Check your .env file:"
    echo "  REDIS_HOST=${REDIS_HOST}"
    echo "  REDIS_PORT=${REDIS_PORT}"
    exit 1
fi
echo ""

# Step 6: Deployment options
echo "Step 6: Choose deployment strategy"
echo "======================================"
echo ""
echo "1) 🟢 GRADUAL (Recommended) - Deploy alongside existing pipeline"
echo "   - Both queues run in parallel"
echo "   - Test with subset of traffic"
echo "   - Safest option"
echo ""
echo "2) 🟡 A/B TEST - Split traffic 50/50"
echo "   - Half traffic uses optimized pipeline"
echo "   - Compare performance"
echo "   - Good for validation"
echo ""
echo "3) 🔴 FULL MIGRATION - Switch all traffic immediately"
echo "   - Highest impact"
echo "   - Risk: untested in your environment"
echo "   - Not recommended for production"
echo ""
echo "4) 🔵 DRY RUN - Check configuration only (no deployment)"
echo ""

read -p "Enter choice (1-4): " choice

case $choice in
  1)
    print_info "Selected: GRADUAL deployment"
    echo ""
    echo "📋 Next steps:"
    echo "1. Restart your backend: npm run start:dev"
    echo "2. Both queues will run simultaneously"
    echo "3. Upload a test PDF to /upload endpoint"
    echo "4. Check logs for '[OPTIMIZED]' messages"
    echo "5. Monitor performance metrics"
    echo "6. Gradually increase traffic to optimized queue"
    echo ""
    print_warning "Manual testing required before production"
    ;;
    
  2)
    print_info "Selected: A/B TEST deployment"
    echo ""
    print_warning "You need to modify pdf.service.ts:"
    echo ""
    echo "Add this code after line 100:"
    echo ""
    echo "const useOptimized = Math.random() < 0.5; // 50/50 split"
    echo "const queue = useOptimized"
    echo "  ? this.pdfNotesOptimizedQueue"
    echo "  : this.pdfNotesQueue;"
    echo ""
    print_info "Then restart: npm run start:dev"
    ;;
    
  3)
    print_error "FULL MIGRATION selected"
    echo ""
    read -p "⚠️  Are you sure? This will switch ALL traffic. (yes/no): " confirm
    if [ "$confirm" == "yes" ]; then
      print_warning "Manual changes required in pdf.service.ts"
      echo "Replace pdfNotesQueue with pdfNotesOptimizedQueue"
      echo ""
      print_info "After changes: npm run start:dev"
    else
      print_info "Cancelled. Good choice!"
      exit 0
    fi
    ;;
    
  4)
    print_success "DRY RUN - Configuration checked successfully!"
    echo ""
    echo "📊 Environment Summary:"
    echo "  Node version: $(node -v)"
    echo "  npm version: $(npm -v)"
    echo "  Redis: Connected ✅"
    echo "  Build: Successful ✅"
    echo ""
    print_success "Ready to deploy when you're ready!"
    exit 0
    ;;
    
  *)
    print_error "Invalid choice"
    exit 1
    ;;
esac

echo ""
echo "======================================================"
echo "🎉 Migration script completed!"
echo ""
print_info "📚 Documentation:"
echo "  - PERFORMANCE_OPTIMIZATION_PLAN.md - Architecture details"
echo "  - IMPLEMENTATION_GUIDE.md - Step-by-step guide"
echo "  - OPTIMIZATION_SUMMARY.md - Quick reference"
echo ""
print_info "📊 Monitor these metrics:"
echo "  - Average processing time (target: < 10s)"
echo "  - Cache hit rate (target: > 30%)"
echo "  - Error rate (target: < 1%)"
echo ""
print_success "Happy optimizing! 🚀"
