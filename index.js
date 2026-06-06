const {
    default: makeWASocket,
    DisconnectReason,
    fetchLatestBaileysVersion,
    useMultiFileAuthState,
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const { OpenAI } = require('openai');
const fs = require('fs');
const express = require('express');
const P = require('pino');
require('dotenv').config();

const knowledge = JSON.parse(fs.readFileSync('./knowledge.json', 'utf8'));

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_PATH = process.env.SESSION_PATH || '.baileys_auth';

let sock = null;
let qrCodeUrl = null;
let clientState = 'initializing';
let statusMessage = 'Starting WhatsApp client...';
let lastQrAt = null;
let lastError = null;
let lastMessageAt = null;
let lastReplyAt = null;
let messageCount = 0;
let replyCount = 0;
let ignoredFromMeCount = 0;
let reconnectCount = 0;
let reconnectTimer = null;
let aiMode = 'openai';

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection:', reason);
    lastError = reason?.message || String(reason);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    lastError = err.message;
});

function extractMessageText(message) {
    const content = message.message || {};
    return (
        content.conversation ||
        content.extendedTextMessage?.text ||
        content.imageMessage?.caption ||
        content.videoMessage?.caption ||
        content.documentMessage?.caption ||
        ''
    ).trim();
}

function buildSystemPrompt() {
    return `
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
}

function packageListText() {
    return knowledge.packages
        .map((pkg) => `- ${pkg.name}: ${pkg.price}. ${pkg.details}`)
        .join('\n');
}

function bookingRequirementsText() {
    return knowledge.booking_requirements.map((item) => `- ${item}`).join('\n');
}

function localConciergeReply(text) {
    const normalized = text.toLowerCase();
    const hasAny = (...words) => words.some((word) => normalized.includes(word));

    if (hasAny('hello', 'hi', 'good morning', 'good afternoon', 'good evening')) {
        return `Welcome to ${knowledge.business_name}. How may I assist you today? I can help with prices, room details, photoshoot bookings, location, and booking requirements.`;
    }

    if (hasAny('price', 'prices', 'rate', 'rates', 'cost', 'how much', 'package', 'packages')) {
        return `Here are our current packages:\n${packageListText()}\n\n${knowledge.booking_rule}`;
    }

    if (hasAny('photoshoot', 'photo shoot', 'photography', 'content creation', 'content')) {
        return `Our photoshoot/content creation rate is ${knowledge.photoshoot_policy}\n\nTo book, please send:\n${bookingRequirementsText()}`;
    }

    if (hasAny('book', 'booking', 'reserve', 'reservation', 'availability', 'available', 'date')) {
        return `Bookings are subject to availability and confirmation. Kindly send these details so we can confirm for you:\n${bookingRequirementsText()}`;
    }

    if (hasAny('location', 'address', 'where', 'direction', 'directions')) {
        return `${knowledge.business_name} is located at ${knowledge.location}.`;
    }

    if (hasAny('silver')) {
        const pkg = knowledge.packages.find((item) => item.name.toLowerCase().includes('silver'));
        return `${pkg.name}: ${pkg.price}. ${pkg.details}`;
    }

    if (hasAny('gold', 'executive')) {
        const pkg = knowledge.packages.find((item) => item.name.toLowerCase().includes('gold'));
        return `${pkg.name}: ${pkg.price}. ${pkg.details}`;
    }

    if (hasAny('platinum', 'full property', 'entire')) {
        const pkg = knowledge.packages.find((item) => item.name.toLowerCase().includes('platinum'));
        return `${pkg.name}: ${pkg.price}. ${pkg.details}`;
    }

    if (hasAny('two bedroom', '2 bedroom', '2-bedroom')) {
        const pkg = knowledge.packages.find((item) => item.name.toLowerCase().includes('two bedroom'));
        return `${pkg.name}: ${pkg.price}. ${pkg.details}`;
    }

    return `Thank you for contacting ${knowledge.business_name}. Please tell me if you need prices, availability, photoshoot booking, location, or help making a reservation.`;
}

async function generateReply(text) {
    if (!process.env.OPENAI_API_KEY) {
        aiMode = 'local_fallback';
        return localConciergeReply(text);
    }

    try {
        aiMode = 'openai';
        const response = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-4o',
            messages: [
                { role: 'system', content: buildSystemPrompt() },
                { role: 'user', content: text },
            ],
        });

        return response.choices[0]?.message?.content || localConciergeReply(text);
    } catch (err) {
        console.error('OpenAI error, using local fallback:', err);
        aiMode = 'local_fallback';
        lastError = err.message || String(err);
        return localConciergeReply(text);
    }
}

function scheduleReconnect(reason) {
    if (reconnectTimer) return;

    reconnectCount += 1;
    clientState = 'reconnecting';
    statusMessage = 'WhatsApp disconnected. Reconnecting...';
    lastError = reason || null;

    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        startWhatsApp().catch((err) => {
            console.error('Error reconnecting WhatsApp:', err);
            scheduleReconnect(err.message);
        });
    }, 5000);
}

async function startWhatsApp() {
    if (process.env.SKIP_WHATSAPP === 'true') {
        console.log('WhatsApp client initialization skipped.');
        return;
    }

    clientState = 'initializing';
    statusMessage = 'Starting WhatsApp client...';

    const { state, saveCreds } = await useMultiFileAuthState(SESSION_PATH);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        auth: state,
        version,
        logger: P({ level: 'silent' }),
        browser: ['Carpe Diem Bot', 'Chrome', '1.0.0'],
        markOnlineOnConnect: true,
        syncFullHistory: false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('QR received. Generating browser QR code...');
            qrCodeUrl = await qrcode.toDataURL(qr);
            clientState = 'qr';
            statusMessage = 'Scan this QR code with WhatsApp Linked Devices.';
            lastQrAt = new Date().toISOString();
            lastError = null;
            console.log('QR code generated successfully.');
        }

        if (connection === 'open') {
            console.log('WhatsApp client is ready.');
            clientState = 'ready';
            statusMessage = 'Connected and running.';
            qrCodeUrl = null;
            lastError = null;
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const reason = lastDisconnect?.error?.message || `Disconnected with status ${statusCode || 'unknown'}`;
            console.log('WhatsApp disconnected:', reason);
            qrCodeUrl = null;

            if (statusCode === DisconnectReason.loggedOut) {
                clientState = 'logged_out';
                statusMessage = 'Logged out. Scan a fresh QR code.';
                lastError = reason;
                scheduleReconnect(reason);
                return;
            }

            scheduleReconnect(reason);
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const message of messages) {
            if (!message.message) continue;

            messageCount += 1;
            lastMessageAt = new Date().toISOString();
            const jid = message.key.remoteJid;
            const text = extractMessageText(message);
            console.log(`Incoming message #${messageCount}: from=${jid} fromMe=${message.key.fromMe} hasBody=${Boolean(text)}`);

            if (message.key.fromMe) {
                ignoredFromMeCount += 1;
                console.log('Ignoring message because it was sent from the linked WhatsApp account.');
                continue;
            }

            if (!text || jid === 'status@broadcast') {
                console.log('Ignoring non-text or broadcast message.');
                continue;
            }

            try {
                await sock.sendPresenceUpdate('composing', jid);
                const aiReply = await generateReply(text);
                await sock.sendMessage(jid, { text: aiReply }, { quoted: message });
                replyCount += 1;
                lastReplyAt = new Date().toISOString();
                console.log(`Reply sent #${replyCount} to ${jid}`);
            } catch (err) {
                console.error('Error handling message:', err);
                lastError = err.message || String(err);
                try {
                    await sock.sendMessage(jid, { text: localConciergeReply(text) }, { quoted: message });
                } catch (replyErr) {
                    console.error('Error sending fallback reply:', replyErr);
                }
            }
        }
    });
}

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
        <p class="meta">AI mode: ${aiMode === 'openai' ? 'OpenAI' : 'Local fallback'}</p>
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
        lastMessageAt,
        lastReplyAt,
        messageCount,
        replyCount,
        ignoredFromMeCount,
        reconnectCount,
        aiMode,
    });
});

app.listen(PORT, () => {
    console.log(`Web server running on port ${PORT}`);
});

startWhatsApp().catch((err) => {
    console.error('Error initializing WhatsApp client:', err);
    scheduleReconnect(err.message);
});
