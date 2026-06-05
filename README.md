# Carpe Diem Luxury Home - WhatsApp AI Concierge

This is a custom AI-driven WhatsApp bot designed for Carpe Diem Luxury Home. It uses OpenAI's GPT-4o to handle customer enquiries, bookings, and support.

## 🚀 Quick Start: Deploy on Render (Free!)

For the easiest free deployment, follow the [Render Deployment Guide](./RENDER_DEPLOYMENT.md). Your bot will be live in minutes!

## Setup Instructions

### 1. Prerequisites
- A Cloud Server (Ubuntu recommended).
- Node.js installed (v18 or higher).
- An OpenAI API Key.

### 2. Installation
1. Upload this folder to your server.
2. Open the terminal in the folder and run:
   ```bash
   npm install
   ```
3. Rename `.env.example` to `.env` and add your OpenAI API Key:
   ```bash
   OPENAI_API_KEY=sk-xxxx...
   ```

### 3. Running the Bot
To start the bot, run:
```bash
node index.js
```
A QR code will appear in the terminal. Scan it with your **WhatsApp Business App** (Settings > Linked Devices > Link a Device).

### 4. Running 24/7
To keep the bot running even after you close the terminal, use `pm2`:
```bash
sudo npm install -g pm2
pm2 start index.js --name "carpe-diem-bot"
pm2 save
pm2 startup
```

## 🌐 Web Dashboard

Your bot now includes a web interface:
- **QR Code Page**: Displays the QR code for linking to WhatsApp Business.
- **Status Page**: Shows when the bot is connected and running.
- **Health Check**: `/health` endpoint for keep-alive pinging.

## Customization
- To update prices or room details, edit the `knowledge.json` file and restart the bot.
- To change the AI's personality, edit the `systemPrompt` in `index.js`.
- To modify the web interface, edit the HTML in the Express routes in `index.js`.
