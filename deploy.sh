#!/bin/bash

# =============================================================================
# BEAST MODE JUNE — Build & Deploy Script
# =============================================================================
#
# FIRST-TIME SETUP (run these once before using this script):
#
# 1. Install the Firebase CLI globally:
#      npm install -g firebase-tools
#
# 2. Log in to Firebase with your Google account:
#      firebase login
#
# 3. Link this project to your Firebase project:
#      firebase use beast-mode-c4809
#
# 4. Make sure your .env.local file is filled in:
#      VITE_FIREBASE_API_KEY=...
#      VITE_FIREBASE_AUTH_DOMAIN=...
#      VITE_FIREBASE_PROJECT_ID=...
#      VITE_FIREBASE_STORAGE_BUCKET=...
#      VITE_FIREBASE_MESSAGING_SENDER_ID=...
#      VITE_FIREBASE_APP_ID=...
#      VITE_GROUP_PASSWORD=...
#      VITE_CLOUDINARY_CLOUD_NAME=...
#      VITE_CLOUDINARY_UPLOAD_PRESET=...
#
# =============================================================================

set -e  # exit immediately if any command fails

echo "🔨 Building..."
npm run build

echo "🚀 Deploying to Firebase Hosting..."
firebase deploy --only hosting

echo "✅ Done! Your app is live."
