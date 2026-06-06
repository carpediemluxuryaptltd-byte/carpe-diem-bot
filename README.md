# Carpe Diem Luxury Home WhatsApp AI Concierge

This bot connects to WhatsApp through `whatsapp-web.js`, displays a browser QR code for pairing your phone, and uses OpenAI to answer Carpe Diem Luxury Home enquiries.

## Local Setup

1. Install Node.js 18 or newer.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create `.env` from `.env.example` and add your OpenAI API key:
   ```bash
   OPENAI_API_KEY=sk-your-key
   SESSION_PATH=.wwebjs_auth
   ```
4. Start the bot:
   ```bash
   npm start
   ```
5. Open `http://localhost:3000` and scan the QR code with WhatsApp.

For web-only smoke tests, set `SKIP_WHATSAPP=true` before starting. Do not set this on Render when you want the bot to connect to WhatsApp.

## Render Deployment

This repo includes `render.yaml`, so Render can detect the service settings automatically.

Required Render environment variable:

```text
OPENAI_API_KEY=sk-your-key
```

Optional Render environment variable:

```text
SESSION_PATH=.wwebjs_auth
```

After deployment, open your Render service URL. The page will show one of these states:

- `Starting WhatsApp Bot`: wait a few seconds; the page refreshes automatically.
- `Scan WhatsApp QR Code`: scan the QR code from your phone.
- `Connected & Running`: the bot is linked and replying.

## Scan Instructions

1. Open WhatsApp or WhatsApp Business on your phone.
2. Go to Settings, then Linked Devices.
3. Tap Link a Device.
4. Scan the QR code shown on your Render URL.

## Keep Alive

Render free services can sleep after inactivity. Add a monitor from a service like cron-job.org or UptimeRobot that pings:

```text
https://your-render-url.onrender.com/health
```

Use a 10 minute interval.

## Business Knowledge

Edit `knowledge.json` to update package names, prices, booking rules, tone, or common questions. Push changes to GitHub and Render will redeploy.
