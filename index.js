const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const { OpenAI } = require('openai');
const fs = require('fs');
const express = require('express');
require('dotenv').config();

const knowledge = JSON.parse(fs.readFileSync('./knowledge.json', 'utf8'));

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const app = express();
const PORT = process.env.PORT || 3000;

let qrCodeUrl = null;
let clientState = 'initializing';
let statusMessage = 'Starting WhatsApp client...';
let lastQrAt = null;
let lastError = null;

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: process.env.SESSION_PATH || '.wwebjs_auth',
    }),
    puppeteer: {
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu',
        ],
        headless: true,
    },
});

client.on('qr', async (qr) => {
    console.log('QR received. Generating browser QR code...');
    try {
        qrCodeUrl = await qrcode.toDataURL(qr);
        clientState = 'qr';
        statusMessage = 'Scan this QR code with WhatsApp Linked Devices.';
        lastQrAt = new Date().toISOString();
        lastError = null;
        console.log('QR code generated successfully.');
    } catch (err) {
        clientState = 'error';
        statusMessage = 'Could not generate QR code.';
        lastError = err.message;
        console.error('Error generating QR code:', err);
    }
});

client.on('authenticated', () => {
    console.log('WhatsApp authenticated.');
    clientState = 'authenticated';
    statusMessage = 'Authenticated. Finishing startup...';
    lastError = null;
});

client.on('ready', () => {
    console.log('WhatsApp client is ready.');
    clientState = 'ready';
    statusMessage = 'Connected and running.';
    qrCodeUrl = null;
    lastError = null;
});

client.on('auth_failure', (message) => {
    console.error('WhatsApp auth failure:', message);
    clientState = 'auth_failure';
    statusMessage = 'Authentication failed. Restart the service and scan a fresh QR code.';
    lastError = message;
});

client.on('disconnected', (reason) => {
    console.log('WhatsApp disconnected:', reason);
    clientState = 'disconnected';
    statusMessage = 'Disconnected. The service will try to reconnect.';
    lastError = reason;
    qrCodeUrl = null;
});

client.on('message', async (msg) => {
    if (msg.fromMe || !msg.body) return;

    try {
        const chat = await msg.getChat();
        await chat.sendStateTyping();

        const systemPrompt = `
You are the AI Concierge for ${knowledge.business_name}, a ${knowledge.business_type}.
Location: ${knowledge.location}

Tone: ${knowledge.tone}

Business Knowledge:
- Packages: ${JSON.stringify(knowledge.packages)}
- Photoshoot Policy: ${knowledge.photoshoot_policy}
- Booking Rule: ${knowledge.booking_rule}

Your Goal:
- Handle ${knowledge.common_questions.join(', ')}.
- If a user wants to book, you MUST collect these details: ${knowledge.booking_requirements.join(', ')}.
- Be helpful, warm, and professional. Keep responses concise because this is WhatsApp.
- If you do not know something, ask them to wait while you refer to the manager.
`;

        const response = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: msg.body },
            ],
        });

        const aiReply = response.choices[0]?.message?.content || 'Please hold on while I confirm that for you.';
        await msg.reply(aiReply);
    } catch (err) {
        console.error('Error handling message:', err);
        await msg.reply('Please hold on while I confirm that for you.');
    }
});

function renderPage() {
    const isReady = clientState === 'ready';
    const hasQr = Boolean(qrCodeUrl);
    const statusClass = isReady
        ? 'ready'
        : hasQr
            ? 'scan'
            : clientState === 'error' || clientState === 'auth_failure'
                ? 'error'
                : 'pending';
    const title = isReady ? 'Connected & Running' : hasQr ? 'Scan WhatsApp QR Code' : 'Starting WhatsApp Bot';
    const qrMarkup = hasQr ? `<div class="qr-wrap"><img src="${qrCodeUrl}" alt="WhatsApp pairing QR code"></div>` : '';
    const retryMarkup = lastError ? `<p class="error-text">Last error: ${lastError}</p>` : '';
    const refreshSeconds = isReady ? 30 : 5;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="refresh" content="${refreshSeconds}">
    <title>Carpe Diem Bot</title>
    <style>
        :root {
            color-scheme: light;
            --ink: #1f2933;
            --muted: #596579;
            --line: #dde3ea;
            --paper: #ffffff;
            --bg: #f4f6f8;
            --gold: #b88735;
            --green: #13795b;
            --blue: #2364aa;
            --red: #b42318;
        }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            padding: 24px;
            background: var(--bg);
            color: var(--ink);
            font-family: Arial, Helvetica, sans-serif;
        }
        main {
            width: min(560px, 100%);
            background: var(--paper);
            border: 1px solid var(--line);
            border-radius: 8px;
            padding: 28px;
            box-shadow: 0 16px 40px rgba(31, 41, 51, 0.08);
        }
        h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: 0; }
        h2 { margin: 0 0 18px; font-size: 18px; font-weight: 600; color: var(--muted); }
        .badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 20px;
            padding: 8px 10px;
            border: 1px solid var(--line);
            border-radius: 6px;
            font-size: 14px;
            font-weight: 700;
        }
        .badge.ready { color: var(--green); }
        .badge.scan { color: var(--blue); }
        .badge.pending { color: var(--gold); }
        .badge.error { color: var(--red); }
        .dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: currentColor;
        }
        .qr-wrap {
            display: grid;
            place-items: center;
            margin: 22px 0;
            padding: 14px;
            border: 1px solid var(--line);
            border-radius: 8px;
            background: #fafafa;
        }
        img { width: min(320px, 100%); height: auto; }
        ol { margin: 18px 0 0; padding-left: 22px; color: var(--muted); line-height: 1.6; }
        p { color: var(--muted); line-height: 1.55; margin: 0; }
        .meta { margin-top: 16px; font-size: 13px; color: var(--muted); }
        .error-text { margin-top: 12px; color: var(--red); }
    </style>
</head>
<body>
    <main>
        <h1>Carpe Diem Bot</h1>
        <h2>${title}</h2>
        <div class="badge ${statusClass}"><span class="dot"></span>${statusMessage}</div>
        ${qrMarkup}
        ${hasQr ? `
        <ol>
            <li>Open WhatsApp or WhatsApp Business on your phone.</li>
            <li>Go to Settings, then Linked Devices.</li>
            <li>Tap Link a Device.</li>
            <li>Scan this QR code.</li>
        </ol>
        ` : `<p>${isReady ? 'Your AI concierge is active and can now reply to WhatsApp messages.' : 'Keep this page open. It refreshes automatically while WhatsApp starts.'}</p>`}
        ${retryMarkup}
        <p class="meta">Status: ${clientState}${lastQrAt ? ` | QR generated: ${lastQrAt}` : ''}</p>
    </main>
</body>
</html>
`;
}

app.get('/', (req, res) => {
    res.send(renderPage());
});

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        whatsapp: clientState,
        ready: clientState === 'ready',
        hasQr: Boolean(qrCodeUrl),
        lastQrAt,
        lastError,
    });
});

app.listen(PORT, () => {
    console.log(`Web server running on port ${PORT}`);
});

if (process.env.SKIP_WHATSAPP === 'true') {
    console.log('WhatsApp client initialization skipped.');
} else {
    client.initialize();
}
