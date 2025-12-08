# Google OAuth Redirect Fix for Production

## 🔴 Problem
After deploying, Google OAuth redirects to `localhost:5173` instead of your production frontend URL.

## ✅ Solution

### Step 1: Update Render.com Environment Variables

1. Go to [Render.com Dashboard](https://dashboard.render.com/)
2. Select your **backend** service
3. Go to **Environment** tab
4. Add or update this variable:
   - **Key**: `FRONTEND_URL`
   - **Value**: `https://your-frontend-url.vercel.app` (replace with your actual frontend URL)
5. Click **Save Changes**
6. Your backend will automatically redeploy

### Step 2: Update Google OAuth Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to: **APIs & Services** → **Credentials**
4. Click on your **OAuth 2.0 Client ID**
5. Under **Authorized redirect URIs**, add:
   ```
   https://your-frontend-url.vercel.app/supabaseCallback
   ```
6. Keep the localhost URI for local development:
   ```
   http://localhost:5173/supabaseCallback
   ```
7. Click **Save**

### Step 3: Update Supabase Settings

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to: **Authentication** → **URL Configuration**
4. Under **Redirect URLs**, add:
   ```
   https://your-frontend-url.vercel.app/supabaseCallback
   ```
5. Keep the localhost URL for development:
   ```
   http://localhost:5173/supabaseCallback
   ```
6. Click **Save**

### Step 4: Verify Your Frontend URLs

Make sure your frontend (Vercel) is using the correct backend URL:

1. Check Vercel environment variables
2. Ensure `VITE_API_URL` or similar points to your Render backend:
   ```
   https://your-backend.onrender.com
   ```

## 🧪 Testing

1. Go to your production site: `https://your-frontend-url.vercel.app`
2. Click "Login" → "Continue with Google"
3. Complete Google sign-in
4. **Expected**: Redirects to `https://your-frontend-url.vercel.app/supabaseCallback`
5. **Expected**: Then redirects to `https://your-frontend-url.vercel.app/notes`

## 📝 What Each URL Does

| URL | Purpose |
|-----|---------|
| `FRONTEND_URL` in backend | Tells backend where to redirect after OAuth |
| Google OAuth Redirect URI | Tells Google where to send users after sign-in |
| Supabase Redirect URL | Tells Supabase which URLs are allowed for auth redirects |

## ⚠️ Common Issues

### Issue: Still redirecting to localhost
**Solution**: Clear browser cache and cookies, or try in incognito mode

### Issue: "Redirect URI mismatch" error
**Solution**: Make sure the redirect URI in Google Console exactly matches: `https://your-frontend-url.vercel.app/supabaseCallback` (no trailing slash)

### Issue: Backend can't read FRONTEND_URL
**Solution**: Verify the environment variable is set in Render dashboard and the service has redeployed

## 🔍 Quick Checklist

- [ ] `FRONTEND_URL` set in Render backend environment variables
- [ ] Production URL added to Google OAuth redirect URIs
- [ ] Production URL added to Supabase redirect URLs
- [ ] Backend redeployed on Render
- [ ] Frontend has correct backend API URL
- [ ] Tested in incognito/private browsing mode

## 📊 Environment Variable Summary

### Backend (Render.com)
```
FRONTEND_URL=https://your-frontend.vercel.app
```

### Frontend (Vercel)
```
VITE_API_URL=https://your-backend.onrender.com
```

## ✨ After Setup

Once configured, the OAuth flow works like this:

1. User clicks "Continue with Google" on your site
2. Backend generates OAuth URL with correct redirect
3. User signs in with Google
4. Google redirects to: `https://your-frontend.vercel.app/supabaseCallback`
5. Frontend handles token and redirects to: `/notes`

Everything should work smoothly! 🎉
