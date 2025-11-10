# PWA Setup Guide

This directory contains the Progressive Web App (PWA) configuration for the Thermal Print Preview editor.

## Files

- **manifest.json** - PWA manifest with share target configuration
- **sw.js** - Service worker for offline support and caching
- **editor.html** - Main PWA application (updated with PWA features)
- **icon.svg** - App icon (vector format)
- **generate-icons.html** - Tool to generate PNG icons

## Features

### 📱 Web Share Target
- Receive shared text from any app (Google Keep, Obsidian, Notes, etc.)
- Receive shared images for thermal printing
- Automatic detection of to-do lists vs. regular notes

### 🖨️ Quick Templates
- **📅 Now** - Current date/time stamp
- **⏰ Expiry** - Expiration date calculator (+1 week, +2 weeks, +1 month)
- **✓ To-Do** - To-do list template

### 📴 Offline Support
- Service worker caches static assets
- Pyodide CDN resources cached on first use
- Works without internet connection after initial load

### 📲 Installable
- Add to home screen on mobile devices
- Standalone app experience
- Custom install prompt

## Icon Generation

### Option 1: Using the Icon Generator (Easiest)

1. Open `web/generate-icons.html` in a browser
2. Click "Download icon-192.png" and "Download icon-512.png"
3. Save both files to the `web/` directory

### Option 2: Using ImageMagick (Command Line)

If you have ImageMagick installed:

```bash
cd web
convert icon.svg -resize 192x192 icon-192.png
convert icon.svg -resize 512x512 icon-512.png
```

### Option 3: Using Online Tool

1. Upload `web/icon.svg` to https://svgtopng.com/
2. Export at 192x192 and 512x512
3. Save as `icon-192.png` and `icon-512.png` in `web/` directory

## Testing the PWA

### Local Testing

1. Generate the icon files (see above)
2. Serve the web directory with HTTPS (required for PWA features):

```bash
# Using Python with HTTPS
python3 -m http.server 8000 --directory web
```

Note: For full PWA features (service worker, install prompt), you need HTTPS. Use one of these:
- Chrome/Edge: works on localhost without HTTPS
- Firefox: works on localhost without HTTPS
- ngrok: `ngrok http 8000` for public HTTPS URL
- Local SSL: use `mkcert` to create local SSL certificates

3. Open in browser:
   - Desktop: `https://localhost:8000/editor.html`
   - Mobile (via ngrok): `https://your-ngrok-url.ngrok.io/editor.html`

### Testing Share Target

On Android:

1. Install the PWA (open in Chrome, tap "Add to Home Screen")
2. Open any app with shareable text (Keep, Notes, etc.)
3. Tap Share → Select "Print Preview"
4. The editor will open with your shared content

On iOS:

- iOS has limited Web Share Target support
- Use the installed PWA directly and paste content
- Or use shortcuts/automation to POST data

## Deployment

For production deployment, you need HTTPS. Options:

### GitHub Pages (Free)

```bash
# In your repository
git subtree push --prefix web origin gh-pages
```

Then enable GitHub Pages for the `gh-pages` branch.

### Cloudflare Pages (Free)

1. Connect your GitHub repository
2. Set build directory to `web`
3. Deploy

### Netlify (Free)

1. Drag and drop the `web` folder
2. Or connect GitHub repository

### Vercel (Free)

```bash
cd web
vercel
```

## Mobile Workflow

### Android

1. **Share Text (Google Keep, Obsidian, etc.)**
   - Open your to-do list in Keep
   - Tap Share → Print Preview
   - Review/edit → Tap Print
   - Done!

2. **Share Image**
   - Open image in Photos/Gallery
   - Tap Share → Print Preview
   - Image is auto-dithered for thermal printing
   - Tap Print

3. **Quick Templates**
   - Open Print Preview PWA
   - Tap 📅 Now for date stamp
   - Tap ⏰ Expiry for expiration dates
   - Tap ✓ To-Do for blank to-do list

### iOS

iOS has more limited PWA support:

1. Add to Home Screen (Safari → Share → Add to Home Screen)
2. Open PWA from home screen
3. Use copy/paste for content
4. Or use Shortcuts app to automate

## Printer Setup

The PWA connects to the printer via the WebSocket bridge:

1. Start the printer bridge on your local network:

```bash
npm run bridge
# or
node bin/printer-bridge.js
```

2. Configure your printer in the bridge config
3. The PWA will auto-connect when opened

See the main README for printer bridge configuration.

## Troubleshooting

### Service Worker Not Registering

- Check browser console for errors
- Ensure you're using HTTPS (or localhost)
- Clear browser cache and reload

### Share Target Not Appearing

- Ensure PWA is installed (not just bookmarked)
- Check manifest.json is being served with correct MIME type
- Android: May need to reinstall PWA
- iOS: Not fully supported

### Install Prompt Not Showing

- PWA must be served over HTTPS
- Icons must be present (192x192 and 512x512)
- Site must have a service worker
- User hasn't previously dismissed install prompt

### Icons Not Loading

- Run the icon generator and save PNG files
- Check that icon files exist in `web/` directory
- Clear browser cache

## Architecture

```
User shares text/image
        ↓
Service Worker intercepts POST request
        ↓
Stores data in IndexedDB (images) or URL params (text)
        ↓
Redirects to editor.html with parameters
        ↓
Editor reads shared data
        ↓
Generates ESC-POS code (via Pyodide + python-escpos)
        ↓
Preview rendered
        ↓
User taps Print
        ↓
Data sent to printer-bridge (WebSocket)
        ↓
Bridge sends to thermal printer (TCP)
```

## Future Enhancements

- [ ] Push notifications for print job completion
- [ ] Background sync for offline print queue
- [ ] OCR for image text extraction
- [ ] Barcode/QR code generation
- [ ] Cloud sync for templates
- [ ] Multi-printer management

## Browser Compatibility

| Feature | Chrome/Edge | Firefox | Safari |
|---------|-------------|---------|--------|
| Service Worker | ✅ | ✅ | ✅ |
| Share Target | ✅ | ❌ | ❌ |
| Install Prompt | ✅ | ❌ | ⚠️ |
| Offline | ✅ | ✅ | ✅ |

Best experience: Chrome/Edge on Android

---

**Need Help?** Open an issue on GitHub or check the main project README.
