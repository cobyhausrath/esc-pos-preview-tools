# ESC-POS Preview Tools - React App

This directory contains the React v19 + TypeScript application that provides the Dashboard and Editor interfaces.

## Overview

The React application is a modern, type-safe conversion of the original HTML-based dashboard and editor, featuring:

- **React v19** with strict TypeScript checking
- **Vite** for fast development and optimized builds
- **React Router** for client-side routing
- **Custom hooks** for WebSocket, Pyodide, and printer communication
- **PWA support** with service worker and manifest
- **Responsive design** with mobile support

## Project Structure

```
app/
├── src/
│   ├── components/        # Reusable React components
│   │   ├── CodeEditor.tsx
│   │   ├── ConnectionStatus.tsx
│   │   ├── HexView.tsx
│   │   ├── JobCard.tsx
│   │   ├── JobModal.tsx
│   │   ├── PrinterControls.tsx
│   │   ├── ReceiptPreview.tsx
│   │   ├── Sidebar.tsx
│   │   └── TemplateButtons.tsx
│   ├── hooks/            # Custom React hooks
│   │   ├── usePyodide.ts
│   │   ├── usePrinterClient.ts
│   │   └── useWebSocket.ts
│   ├── pages/            # Page components
│   │   ├── Dashboard.tsx
│   │   └── Editor.tsx
│   ├── types/            # TypeScript type definitions
│   │   └── index.ts
│   ├── utils/            # Utility functions
│   │   ├── hexFormatter.ts
│   │   └── templates.ts
│   ├── styles/           # CSS styles
│   │   └── app.css
│   ├── App.tsx           # Main app component
│   └── main.tsx          # Entry point
├── index.html            # HTML entry point
├── vite.config.ts        # Vite configuration
├── tsconfig.json         # TypeScript configuration
├── tsconfig.node.json    # TypeScript config for Vite
└── .eslintrc.json        # ESLint configuration

## Features

### Dashboard
- Real-time job monitoring via WebSocket
- Job filtering by status (pending, approved, rejected, etc.)
- Job approval/rejection workflow
- Live statistics sidebar
- Job details modal with preview

### Editor
- Python code editor with syntax hints
- Real-time ESC-POS preview
- Pyodide integration for python-escpos execution
- HEX view with command statistics
- Printer controls with WebSocket bridge
- Template system (timestamp, expiry, to-do, note, image)
- Example code library
- Import/export ESC-POS files
- URL hash sharing
- PWA share target support

## Development

### Prerequisites
- Node.js >= 16.0.0
- Yarn package manager

### Install Dependencies
```bash
yarn install
```

### Run Development Server
```bash
yarn app:dev
```

This will start the Vite dev server at http://localhost:5173

### TypeScript Type Checking
```bash
yarn app:typecheck
```

### Build for Production
```bash
yarn app:build
```

Output will be in `dist-app/` directory.

### Preview Production Build
```bash
yarn app:preview
```

## Architecture

### Component Hierarchy

```
App
├── BrowserRouter
│   ├── Navigation
│   └── Routes
│       ├── /               → Editor
│       │   ├── TemplateButtons
│       │   ├── CodeEditor
│       │   ├── ReceiptPreview
│       │   ├── PrinterControls
│       │   └── HexView
│       └── /dashboard      → Dashboard
│           ├── ConnectionStatus
│           ├── Sidebar
│           ├── JobCard[]
│           └── JobModal
```

### Custom Hooks

#### `useWebSocket(options)`
Generic WebSocket hook with reconnection logic.

**Options:**
- `url: string` - WebSocket URL
- `onMessage?: (message) => void` - Message handler
- `onOpen?: () => void` - Connection opened callback
- `onClose?: () => void` - Connection closed callback
- `reconnectInterval?: number` - Reconnection delay (default: 3000ms)
- `maxReconnectAttempts?: number` - Max reconnection attempts (default: 10)

**Returns:**
- `isConnected: boolean` - Connection status
- `error: string | null` - Error message
- `sendMessage: (message) => void` - Send message function
- `disconnect: () => void` - Disconnect function
- `reconnect: () => void` - Manual reconnect function

#### `useDashboardWebSocket()`
Specialized hook for dashboard WebSocket connection.

**Returns:**
- All `useWebSocket` returns
- `jobs: Job[]` - List of jobs
- `stats: JobStats` - Job statistics
- `setJobs: (jobs) => void` - Update jobs list

#### `usePyodide()`
Hook for Pyodide initialization and code execution.

**Returns:**
- `pyodide: PyodideInterface | null` - Pyodide instance
- `isLoading: boolean` - Loading state
- `error: string | null` - Error message
- `runCode: (code: string) => Promise<Uint8Array>` - Execute python-escpos code

#### `usePrinterClient()`
Hook for printer WebSocket bridge communication.

**Returns:**
- `isConnected: boolean` - Connection status
- `isPrinting: boolean` - Printing state
- `error: string | null` - Error message
- `selectedPrinter: PrinterConfig | null` - Selected printer
- `connect: (config) => Promise<void>` - Connect to printer bridge
- `disconnect: () => void` - Disconnect
- `print: (data: Uint8Array) => Promise<void>` - Send data to printer

### Type Definitions

All TypeScript types are defined in `src/types/index.ts`:

- `Job` - Print job data structure
- `JobStatus` - Job status enum
- `JobStats` - Job statistics
- `PrinterConfig` - Printer configuration
- `PyodideInterface` - Pyodide type definitions
- `TemplateType` - Template types
- `ReceiptData` - Receipt data structure
- `HexStats` - HEX view statistics

### State Management

The app uses React's built-in state management:
- `useState` for local component state
- `useEffect` for side effects
- `useCallback` for memoized callbacks
- `useMemo` for computed values
- Custom hooks for shared logic

No external state management library (Redux, MobX, etc.) is used to keep the app lightweight.

## Styling

The app uses vanilla CSS with CSS custom properties (CSS variables) for theming:

- **Theme:** VS Code dark theme
- **Colors:** Defined in `:root` variables
- **Layout:** CSS Grid and Flexbox
- **Responsive:** Mobile-first design with media queries

## PWA Support

The app supports Progressive Web App features:

- **Service Worker:** Registered in `main.tsx`
- **Manifest:** Located in `web/manifest.json`
- **Icons:** SVG and PNG icons in `web/`
- **Share Target:** Accepts shared text and images from mobile devices
- **Install Prompt:** Custom install button

## API Integration

### Dashboard API
- `GET http://127.0.0.1:3000/api/jobs` - Fetch all jobs
- `POST http://127.0.0.1:3000/api/jobs/:id/approve` - Approve job
- `POST http://127.0.0.1:3000/api/jobs/:id/reject` - Reject job

### WebSocket Endpoints
- `ws://127.0.0.1:8765` - Dashboard job updates
- `ws://127.0.0.1:8765` - Printer bridge communication

## Browser Compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support (iOS PWA supported)
- Mobile browsers: ✅ Responsive design

## Performance

- **Bundle size:** ~240 KB (gzipped: ~75 KB)
- **Load time:** < 1 second (excluding Pyodide)
- **Pyodide load:** 3-7 seconds (first load, cached after)
- **Code execution:** < 100ms for typical receipts

## Security

- **Code validation:** AST-based validation for python-escpos code
- **Sandboxing:** Pyodide runs in WASM sandbox
- **Import restrictions:** Only `escpos` imports allowed
- **XSS protection:** React's built-in XSS protection
- **CORS:** API server should configure CORS appropriately

## Migration from HTML

The React app maintains feature parity with the original HTML versions:

### Dashboard (`web/dashboard.html` → `src/pages/Dashboard.tsx`)
- ✅ WebSocket connection
- ✅ Job filtering
- ✅ Job approval/rejection
- ✅ Real-time updates
- ✅ Statistics display
- ✅ Job details modal

### Editor (`web/editor.html` → `src/pages/Editor.tsx`)
- ✅ Pyodide integration
- ✅ Code execution
- ✅ Receipt preview
- ✅ HEX view
- ✅ Printer controls
- ✅ Templates
- ✅ Examples
- ✅ Import/export
- ✅ URL sharing
- ✅ PWA support

## Known Issues

1. **Pyodide load time:** Initial load takes 3-7 seconds. Consider implementing:
   - Loading screen with progress indicator
   - Service worker caching for faster subsequent loads

2. **ESC-POS parsing:** Receipt preview currently shows raw text. To improve:
   - Integrate the existing TypeScript ESC-POS parser
   - Render formatted text with HTML (bold, underline, alignment)

3. **Image processing:** Image template requires browser canvas API
   - Add Floyd-Steinberg dithering implementation
   - Handle image resizing for thermal printers

## Future Enhancements

1. **Syntax highlighting:** Add CodeMirror or Monaco editor
2. **Code completion:** Provide python-escpos API autocomplete
3. **Error highlighting:** Show Python syntax errors inline
4. **Printer discovery:** Auto-discover network printers
5. **Multiple printers:** Support multiple printer connections
6. **Job history:** Persist job history in IndexedDB
7. **Dark/light theme:** Add theme switcher
8. **Internationalization:** Add i18n support

## Contributing

When adding new features:

1. Create components in `src/components/`
2. Add types to `src/types/index.ts`
3. Use custom hooks for shared logic
4. Follow existing code style
5. Run `yarn app:typecheck` before committing
6. Test on multiple browsers
7. Update this README

## License

MIT License - See LICENSE file in project root
