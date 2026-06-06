# Deploy Carpe Diem Bot on Render

## 1. Push This Repo to GitHub

Create a GitHub repository, then upload these project files. Do not upload `.env`, `node_modules`, `.npm-cache`, `.wwebjs_auth`, or `.wwebjs_cache`.

## 2. Create the Render Service

1. Open Render.
2. Click New, then Web Service.
3. Connect your GitHub repository.
4. Use these settings if Render does not auto-detect `render.yaml`:

| Field | Value |
| --- | --- |
| Name | `carpe-diem-bot` |
| Environment | `Node` |
| Build Command | `npm install && npm run render-build` |
| Start Command | `npm start` |
| Health Check Path | `/health` |

## 3. Add Environment Variables

Add this required variable:

| Key | Value |
| --- | --- |
| `OPENAI_API_KEY` | Your OpenAI API key |

Optional:

| Key | Value |
| --- | --- |
| `SESSION_PATH` | `.wwebjs_auth` |

## 4. Deploy and Pair WhatsApp

1. Deploy the service.
2. Open the Render URL, for example `https://carpe-diem-bot.onrender.com`.
3. Wait for `Scan WhatsApp QR Code`.
4. On your phone, open WhatsApp or WhatsApp Business.
5. Go to Settings, then Linked Devices.
6. Tap Link a Device.
7. Scan the QR code in the browser.
8. Wait until the page says `Connected & Running`.

## 5. Keep the Service Awake

Render free services may sleep after inactivity. Create a monitor that visits:

```text
https://your-render-url.onrender.com/health
```

Use a 10 minute interval.

## Notes

- If Render restarts or redeploys and the WhatsApp session is lost, open the Render URL and scan the new QR code.
- For a more stable 24/7 bot, use a paid Render instance or another host with persistent storage.
- Update `knowledge.json` when Carpe Diem prices, rooms, or policies change.
