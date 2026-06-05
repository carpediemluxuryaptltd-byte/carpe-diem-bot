# Deploy Carpe Diem Bot on Render (Free Tier)

This guide walks you through deploying your WhatsApp AI Concierge on Render's free tier.

## Step 1: Prepare Your GitHub Repository

1. Create a GitHub account at [github.com](https://github.com) if you don't have one.
2. Create a new repository called `carpe-diem-bot`.
3. Upload all the files from this project to your repository (except `node_modules`).
4. Make sure your `.env` file is **NOT** uploaded. Only `.env.example` should be in the repo.

## Step 2: Create a Render Account

1. Go to [render.com](https://render.com)
2. Sign up with your GitHub account (it's easier).
3. Click "New +" and select "Web Service".
4. Connect your GitHub repository `carpe-diem-bot`.

## Step 3: Configure the Render Service

Fill in the following details:

| Field | Value |
| --- | --- |
| **Name** | `carpe-diem-bot` |
| **Environment** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `node index.js` |
| **Plan** | `Free` |

## Step 4: Add Environment Variables

1. In the Render dashboard, go to your service.
2. Click "Environment" on the left.
3. Add a new environment variable:
   - **Key**: `OPENAI_API_KEY`
   - **Value**: Paste your OpenAI API key (get it from [platform.openai.com](https://platform.openai.com))

## Step 5: Deploy

1. Click "Create Web Service".
2. Render will automatically deploy your bot. Wait 2-3 minutes.
3. Once deployed, you'll get a URL like `https://carpe-diem-bot-xxxxx.onrender.com`
4. Visit that URL in your browser to see the QR code.

## Step 6: Scan the QR Code

1. Open the Render URL in your browser.
2. You should see a QR code on the page.
3. Open WhatsApp Business on your phone.
4. Go to **Settings → Linked Devices → Link a Device**.
5. Scan the QR code from the browser.
6. Wait for the page to show "✅ CONNECTED & RUNNING".

## Step 7: Keep the Bot Awake (Critical!)

Render's free tier puts services to sleep after 15 minutes of inactivity. To prevent this, we'll use a free "cron job" service to ping your bot every 10 minutes.

### Using cron-job.org (Free):

1. Go to [cron-job.org](https://cron-job.org)
2. Sign up for a free account.
3. Click "Create Cronjob".
4. Fill in:
   - **Title**: `Carpe Diem Keep Alive`
   - **URL**: `https://carpe-diem-bot-xxxxx.onrender.com/health` (replace with your actual Render URL)
   - **Execution time**: Every 10 minutes
5. Click "Create".

Now your bot will stay awake 24/7!

## Troubleshooting

### The QR code doesn't appear
- Wait 30 seconds and refresh the page.
- Check the Render logs to see if there are any errors.

### WhatsApp says "Device not recognized"
- Make sure you're using **WhatsApp Business**, not regular WhatsApp.
- Try scanning the QR code again.

### The bot stops responding after a while
- Make sure the cron job is running (check cron-job.org dashboard).
- Verify the `/health` endpoint is being pinged.

## Updating Your Bot

To update prices, room details, or the AI's behavior:

1. Edit the `knowledge.json` file in your GitHub repository.
2. Commit and push the changes.
3. Render will automatically redeploy your bot.
4. Wait 2-3 minutes for the update to take effect.

## Important Notes

- **Free tier limitations**: Render's free tier has a 750-hour monthly limit. For a 24/7 service, you'll use ~720 hours/month, which is within the limit.
- **Restart frequency**: Your bot may restart occasionally (every 24-48 hours). You'll need to re-scan the QR code if this happens.
- **Reliability**: Free tier is not 100% reliable. For production use, consider upgrading to a paid plan (~$7/month).

## Need Help?

If you encounter issues, check the Render logs:
1. Go to your Render dashboard.
2. Click on your service.
3. Click "Logs" to see what's happening.

Good luck! 🚀
