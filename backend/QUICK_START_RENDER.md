# Quick Start: Deploy to Render in 5 Steps

## 📋 Prerequisites
- ✅ GitHub account with your code pushed
- ✅ Render account (free): https://render.com
- ✅ Supabase account (for auth & storage)
- ✅ Upstash Redis (for queue management)
- ✅ Google AI API key (for Gemini)

---

## 🚀 Step 1: Create Database (2 minutes)

1. Go to https://dashboard.render.com
2. Click **New +** → **PostgreSQL**
3. Fill in:
   ```
   Name: ai-study-buddy-db
   Database: ai_study_buddy
   Region: Oregon (or closest to you)
   Plan: Free
   ```
4. Click **Create Database**
5. ⚠️ **IMPORTANT**: Copy both connection strings:
   - **Internal Database URL** → Save for `DATABASE_URL`
   - **External Database URL** → Save for `DIRECT_URL`

---

## 🚀 Step 2: Create Web Service (3 minutes)

1. Click **New +** → **Web Service**
2. Click **Connect a repository** → Select `BUTTERCUPXCZ/AI-Study-Buddy`
3. Configure:
   ```
   Name: ai-study-buddy-backend
   Region: Oregon (same as database!)
   Branch: main
   Root Directory: backend
   Runtime: Node
   Build Command: npm install && npm run build
   Start Command: npm run start:prod
   Plan: Free
   ```
4. Click **Create Web Service** (Don't deploy yet!)

---

## 🚀 Step 3: Add Environment Variables (5 minutes)

Go to your web service → **Environment** tab → Add these:

### Database (from Step 1)
```bash
DATABASE_URL=<paste Internal Database URL>
DIRECT_URL=<paste External Database URL>
```

### Server Config
```bash
NODE_ENV=production
PORT=3000
FRONTEND_ORIGIN=http://localhost:5173  # Update later with Vercel URL
```

### Supabase (from your Supabase dashboard)
```bash
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=eyJhbG...  # Anon key
SUPABASE_BUCKET_NAME=pdfs
```

### Redis (from your Upstash dashboard)
```bash
REDIS_HOST=xxxxx.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=your_password
REDIS_TLS=true
```

### AI & Auth
```bash
GEMINI_API_KEY=your_gemini_key
JWT_SECRET=your_random_secret_32_chars
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=application/pdf,text/plain
```

Click **Save Changes**

---

## 🚀 Step 4: Deploy & Migrate (3 minutes)

1. Render will auto-deploy after saving environment variables
2. Watch the **Logs** tab for deployment progress
3. Wait for: `Application is running on: http://[::]:3000` ✅
4. Go to **Shell** tab and run:
   ```bash
   npx prisma migrate deploy
   ```
5. Wait for: `Migration complete` ✅

---

## 🚀 Step 5: Test Your API (1 minute)

Your backend is live at: `https://ai-study-buddy-backend.onrender.com`

Test it:
```bash
# In browser or curl
https://ai-study-buddy-backend.onrender.com/health

# Should return:
{
  "status": "ok",
  "timestamp": "2025-12-07T...",
  "uptime": 123.45
}
```

✅ **SUCCESS!** Your backend is deployed!

---

## 📝 Next Steps

### Update Frontend
1. Deploy frontend to Vercel
2. Get frontend URL: `https://your-app.vercel.app`
3. Update `FRONTEND_ORIGIN` in Render environment variables
4. Update frontend API URL to `https://ai-study-buddy-backend.onrender.com`

### Monitor Your App
- 📊 **Metrics**: Dashboard → Metrics tab
- 📋 **Logs**: Dashboard → Logs tab (real-time)
- 🔔 **Alerts**: Dashboard → Notifications

---

## ⚠️ Important: Free Tier Notes

### Spin Down Behavior
- ❌ App spins down after **15 minutes** of inactivity
- ⏱️ First request takes **30-60 seconds** to wake up
- ✅ Solution: Upgrade to **Starter plan ($7/mo)** for always-on

### Keep Awake (Optional)
Use a ping service to prevent spin-down:
1. Go to https://cron-job.org
2. Create free account
3. Add job to ping: `https://your-backend.onrender.com/health`
4. Frequency: Every 14 minutes

---

## 🆘 Troubleshooting

### Build Fails
```bash
# Check Logs tab for errors
# Common issues:
✓ Missing dependencies in package.json
✓ Wrong Node version
✓ Prisma not generating
```

### Database Connection Error
```bash
✓ Verify DATABASE_URL is the Internal URL
✓ Check database and service are in same region
✓ Ensure database is running (green status)
```

### App Crashes
```bash
✓ Check all environment variables are set
✓ Review startup logs for missing configs
✓ Verify Redis credentials are correct
```

### Migrations Fail
```bash
# Run in Shell tab:
npx prisma migrate reset --force  # Only if needed!
npx prisma migrate deploy
```

---

## 📚 Resources

- 📖 [Full Deployment Guide](./RENDER_DEPLOYMENT.md)
- ✅ [Deployment Checklist](./DEPLOYMENT_CHECKLIST.md)
- 🔐 [Environment Variables](./.env.render)
- 🌐 [Render Docs](https://render.com/docs)
- 💬 [Render Community](https://community.render.com)

---

## 🎉 Congratulations!

Your backend is now live in production! 

**Your API**: `https://ai-study-buddy-backend.onrender.com`

---

## 💡 Pro Tips

1. **Set up staging**: Create a second service for testing
2. **Use secrets**: Store sensitive data in Render secret files
3. **Monitor logs**: Check regularly for errors
4. **Scale up**: Upgrade when traffic increases
5. **Custom domain**: Add your own domain in settings

---

**Need Help?** Check the full guide or Render documentation.
