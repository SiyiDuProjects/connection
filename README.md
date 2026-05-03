# LinkedIn Find Contacts Extension

Chrome Extension + Node server for finding company contacts from LinkedIn job pages.

## Structure

- `extension/`: Manifest V3 Chrome extension injected only on LinkedIn job pages.
- `server/`: Express API proxy that keeps Apollo credentials private.

## Local Server

```powershell
cd server
copy .env.example .env
npm install
npm run dev
```

Set `APOLLO_API_KEY` in `server/.env`.

## Chrome Extension

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Load unpacked.
4. Select the `extension/` folder.
5. Open a LinkedIn job page like `https://www.linkedin.com/jobs/view/...`.

The extension defaults to `https://contacts.gaid.studio`. Change the API base URL in the extension options page if you need to use a local or staging server.
