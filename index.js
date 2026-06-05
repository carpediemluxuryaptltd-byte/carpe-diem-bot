const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const { OpenAI } = require('openai');
const fs = require('fs');
const express = require('express');
const path = require('path');
require('dotenv').config();

// Load business knowledge
const knowledge = JSON.parse(fs.readFileSync('./knowledge.json', 'utf8'));

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Express server
const app = express();
const PORT = process.env.PORT || 3000;

// Store QR code and client status
let qrCodeUrl = null;
let clientReady = false;

// Initialize WhatsApp Client
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true,
    }
});

client.on('qr', async (qr) => {
    console.log('QR RECEIVED - Generating QR Code Image');
    try {
        qrCodeUrl = await qrcode.toDataURL(qr);
        console.log('QR Code generated successfully');
    } catch (err) {
        console.error('Error generating QR code:', err);
    }
});

client.on('ready', () => {
    console.log('✅ WhatsApp Client is ready!');
    clientReady = true;
    qrCodeUrl = null; // Clear QR code once logged in
});

client.on('message', async (msg) => {
    if (msg.fromMe) return;

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
            - Be helpful, warm, and professional. Keep responses concise as it is WhatsApp.
            - If you don't know something, ask them to wait while you refer to the manager.
            
            Current conversation context is provided below.
        `;

        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: msg.body }
            ],
        });

        const aiReply = response.choices[0].message.content;
        await msg.reply(aiReply);

    } catch (err) {
        console.error('Error handling message:', err);
    }
});

// Express Routes
app.use(express.static('public'));

app.get('/', (req, res) => {
    if (clientReady) {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Carpe Diem Bot - Status</title>
                <style>
                    body { font-family: Arial; text-align: center; padding: 50px; background: #f5f5f5; }
                    .container { background: white; padding: 30px; border-radius: 10px; max-width: 500px; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .status { color: green; font-size: 24px; font-weight: bold; }
                    .message { margin-top: 20px; color: #333; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🎉 Carpe Diem Bot</h1>
                    <p class="status">✅ CONNECTED & RUNNING</p>
                    <p class="message">Your WhatsApp AI Concierge is now active and ready to handle customer enquiries!</p>
                </div>
            </body>
            </html>
        `);
    } else if (qrCodeUrl) {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Carpe Diem Bot - QR Code</title>
                <style>
                    body { font-family: Arial; text-align: center; padding: 50px; background: #f5f5f5; }
                    .container { background: white; padding: 30px; border-radius: 10px; max-width: 500px; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    h1 { color: #333; }
                    .qr-container { margin: 30px 0; }
                    img { max-width: 300px; border: 2px solid #ddd; padding: 10px; border-radius: 5px; }
                    .instructions { color: #666; margin-top: 20px; text-align: left; }
                    .instructions ol { text-align: left; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>📱 Carpe Diem Bot Setup</h1>
                    <p>Scan the QR code below with your WhatsApp Business App:</p>
                    <div class="qr-container">
                        <img src="${qrCodeUrl}" alt="QR Code">
                    </div>
                    <div class="instructions">
                        <h3>Instructions:</h3>
                        <ol>
                            <li>Open WhatsApp Business on your phone</li>
                            <li>Go to Settings → Linked Devices</li>
                            <li>Tap "Link a Device"</li>
                            <li>Scan the QR code above</li>
                        </ol>
                    </div>
                </div>
            </body>
            </html>
        `);
    } else {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Carpe Diem Bot - Loading</title>
                <style>
                    body { font-family: Arial; text-align: center; padding: 50px; background: #f5f5f5; }
                    .container { background: white; padding: 30px; border-radius: 10px; max-width: 500px; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 20px auto; }
                    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🚀 Carpe Diem Bot</h1>
                    <p>Initializing...</p>
                    <div class="spinner"></div>
                    <p>Please refresh this page in a few seconds.</p>
                </div>
            </body>
            </html>
        `);
    }
});

// Health check endpoint (for keep-alive pinging)
app.get('/health', (req, res) => {
    res.json({ status: 'ok', ready: clientReady });
});

// Start Express server
app.listen(PORT, () => {
    console.log(`🌐 Web server running on port ${PORT}`);
});

// Initialize WhatsApp client
client.initialize();
