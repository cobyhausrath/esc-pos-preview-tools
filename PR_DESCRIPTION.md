# Add Real-Time Printer Status Feedback

## Summary

This PR adds real-time printer status feedback to the ESC-POS printer bridge and React TypeScript editor. Users can now see detailed printer state including paper levels, cover status, online/offline state, and error conditions. The system prevents printing when errors are detected and provides clear visual feedback about printer health.

## Problem

Previously, the printer bridge only checked TCP connectivity (whether it could connect to the printer's port). Users had no visibility into:
- Paper status (out, low, or OK)
- Printer errors (cover open, offline, temperature issues)
- Hardware problems that would prevent successful printing

This made debugging print failures difficult and resulted in poor user experience when print jobs failed silently.

## Solution

### Backend (printer-bridge.js)

Implemented ESC-POS DLE EOT status queries to retrieve real-time printer state:

**Status Commands:**
- `DLE EOT 1` (0x10 0x04 0x01) - Printer status (online/offline, drawer)
- `DLE EOT 2` (0x10 0x04 0x02) - Off-line status (cover, paper shortage, errors)
- `DLE EOT 3` (0x10 0x04 0x03) - Error status (cutter, temperature, unrecoverable)
- `DLE EOT 4` (0x10 0x04 0x04) - Paper roll sensor (near-end, not present)

**New Functions:**
- `parseStatusByte(statusByte, queryType)` - Parses status response bytes according to Netum 80-V-UL documentation
- `queryPrinterStatus(host, port)` - Sends status queries and returns combined status object

**WebSocket Protocol Extension:**
```json
// Request
{
  "action": "status",
  "printer": "Netum 80-V-UL"  // or custom host/port
}

// Response
{
  "success": true,
  "status": {
    "online": true,
    "paperStatus": "ok" | "low" | "out" | "unknown",
    "coverOpen": false,
    "error": false,
    "errorMessage": null,
    "supported": true,
    "details": { ... }
  }
}
```

### Frontend (React TypeScript App)

**Type Definitions (app/src/types/index.ts):**
- `PaperStatus` type: 'ok' | 'low' | 'out' | 'unknown'
- `PrinterStatus` interface with full status fields

**Hook Enhancement (app/src/hooks/usePrinterClient.ts):**
- Added `printerStatus` state
- Added `queryStatus()` method for WebSocket status requests
- Integrated status updates into message handling

**UI Component (app/src/components/PrinterControls.tsx):**
- "🔍 Status" button for manual status checks
- Enhanced connection indicator with color coding:
  - 🟢 Green: Online and OK
  - 🟡 Yellow: Warning (paper low)
  - 🔴 Red: Error (paper out, cover open, offline)
- Detailed status display (paper, cover status)
- Smart print button - disabled when printer has errors
- Automatic status check on connection

**Styling (app/src/styles/app.css):**
- Status indicator colors (green/yellow/red)
- Status text and details layout
- Warning and error state styles

## Technical Details

### Bit Field Parsing

Status bytes are parsed according to Netum 80-V-UL ESC-POS documentation:

**n=1 (Printer Status):**
- Bit 2 (0x04): Drawer open/close
- Bit 3 (0x08): Online/offline (inverted: 0=online, 1=offline)
- Bit 5 (0x20): Waiting for recovery

**n=2 (Off-line Status):**
- Bit 2 (0x04): Top cover open/close
- Bit 3 (0x08): Paper feed button pressed
- Bit 5 (0x20): Paper shortage (low paper)
- Bit 6 (0x40): General error flag

**n=3 (Error Status):**
- Bit 3 (0x08): Auto-cutter error
- Bit 5 (0x20): Unrecoverable error
- Bit 6 (0x40): Temperature error

**n=4 (Paper Roll Sensor):**
- Bits 2-3 (0x0C): Paper near-end (exact match = 0x0C)
- Bits 5-6 (0x60): Paper not present (exact match = 0x60)

### Multi-bit Field Logic

Critical fix for paper sensor parsing:
```javascript
// INCORRECT (checks if ANY bit set):
status.paperNearEnd = !!(statusByte & 0x0C);

// CORRECT (checks for exact value):
status.paperNearEnd = (statusByte & 0x0C) === 0x0C;
```

### TCP Stream Handling

Robust handling for variable-length TCP responses:
```javascript
client.on('data', (data) => {
    if (data.length === 1) {
        // Expected: single status byte
    } else if (data.length > 1) {
        // Multiple responses in one chunk
        for (const byte of data) { /* process each */ }
    } else {
        // Empty chunk, ignore
    }
});
```

### Paper Status Priority

```
if (paperNotPresent) → 'out' + error
else if (paperNearEnd OR paperShortage) → 'low' (warning)
else → 'ok'
```

### Error Handling

- Gracefully handles printers that don't support status queries
- Returns `supported: false` with basic connectivity status
- Timeout protection (2s per query, reset after each response)
- Proper async event listener cleanup to prevent race conditions

## Code Review Feedback Addressed

All critical and important issues from PR review have been fixed:

### Critical Issues Fixed:
1. ✅ **TCP Stream Handling**: Added proper handling for data.length !== 1 cases
2. ✅ **Missing DLE EOT 3**: Added error status query to queries array
3. ✅ **Timeout Reset**: Added `client.setTimeout()` reset after each response
4. ✅ **Race Conditions**: Fixed async event listener cleanup

### Important Issues Fixed:
5. ✅ **Constants**: Added STATUS_TIMEOUT_MS and QUERY_DELAY_MS
6. ✅ **Logging**: Added comprehensive debug logging
7. ✅ **Error Messages**: Made consistent ("Printer is offline", etc.)
8. ✅ **Module Exports**: Exported parseStatusByte and queryPrinterStatus

### Improvements:
9. ✅ **TypeScript Types**: Full type safety with strict interfaces
10. ✅ **React Integration**: Clean hook-based architecture
11. ✅ **State Management**: Proper useState with cleanup

## Testing Instructions

### Manual Testing

1. **Start the printer bridge:**
   ```bash
   ./bin/printer-bridge.js
   ```

2. **Start React app:**
   ```bash
   cd app
   yarn dev
   ```

3. **Test status queries:**
   - Select "Netum 80-V-UL" from printer dropdown
   - Click "Connect to Printer"
   - Status should automatically query after connection
   - Verify status indicator color and text
   - Click "🔍 Status" button for manual check

4. **Test error states:**
   - Open printer cover → Should show red indicator, "Cover open" error
   - Remove paper → Should show red indicator, "Paper out" error
   - Load low paper → Should show yellow indicator, "Paper Low" warning
   - Print button should be disabled during errors

5. **Test status details:**
   - Verify status details show:
     - Paper status with icon (✓/⚠️/✗)
     - Cover status (OPEN/CLOSED)

### Expected Behavior

**Normal Operation:**
- 🟢 Green dot with "Online" text
- Print button enabled (when bytes available)
- Status details: "Paper: ✓ OK • Cover: ✓ CLOSED"

**Paper Low:**
- 🟡 Yellow dot with "Paper Low" text
- Print button enabled (warning only)
- Status details: "Paper: ⚠️ LOW • Cover: ✓ CLOSED"

**Paper Out:**
- 🔴 Red dot with "Paper out" text
- Print button disabled
- Status details: "Paper: ✗ OUT • Cover: ✓ CLOSED"

**Cover Open:**
- 🔴 Red dot with "Cover open" text
- Print button disabled
- Status details: "Paper: ... • Cover: ⚠️ OPEN"

## Files Changed

### Backend
- **bin/printer-bridge.js** (+240 lines)
  - Added `parseStatusByte()` function with complete bit field parsing
  - Added `queryPrinterStatus()` function with robust TCP handling
  - Added 'status' WebSocket action handler
  - Added constants (STATUS_TIMEOUT_MS, QUERY_DELAY_MS)
  - Added comprehensive debug logging
  - Exported functions for testing

### Frontend (React TypeScript)
- **app/src/types/index.ts** (+12 lines)
  - Added `PaperStatus` type
  - Added `PrinterStatus` interface

- **app/src/hooks/usePrinterClient.ts** (+35 lines)
  - Added `printerStatus` state
  - Added `queryStatus()` method
  - Integrated status handling in message listener

- **app/src/components/PrinterControls.tsx** (+60 lines)
  - Added `isCheckingStatus` state
  - Added `handleCheckStatus()` function
  - Added `getStatusIndicatorClass()` helper
  - Added `getStatusText()` helper
  - Added status indicator with color coding
  - Added "🔍 Status" button
  - Added status details display
  - Added automatic status check on connect
  - Updated print button disable logic

- **app/src/styles/app.css** (+15 lines)
  - Added status indicator warning/error colors
  - Added status-text and status-details styles

## Commits

1. `47080c0` - feat: add real-time printer status feedback
2. `bfd456a` - fix: correct printer status bit parsing per documentation
3. `5b0211c` - docs: add comprehensive PR description
4. `d0aaab6` - fix: address critical PR review issues
5. `0f3d2d4` - feat: port printer status feedback to React app

## Benefits

✅ **Real-time visibility** into printer state
✅ **Prevents failed prints** by detecting errors before sending
✅ **Better UX** with clear error messages and visual feedback
✅ **Reduced debugging time** with detailed status information
✅ **Graceful degradation** for printers without status support
✅ **Standard ESC-POS commands** - compatible with most thermal printers
✅ **Type-safe** React TypeScript implementation
✅ **Robust** TCP stream handling and error recovery

## Future Enhancements

Potential improvements for future PRs:
- Periodic status polling (configurable interval)
- Status history/logging
- Desktop notifications for error conditions
- Support for additional printer models with different status bit mappings
- Status indicator in browser tab/favicon

## References

- ESC-POS Command Reference: DLE EOT commands
- Netum 80-V-UL Printer Documentation (provided in issue)
- [Epson ESC-POS Documentation](https://download4.epson.biz/sec_pubs/pos/reference_en/escpos/dle_eot.html)

## Migration Note

This PR replaces the web/editor.html implementation with a React TypeScript version. The legacy HTML editor was deleted from main branch during the React migration. All functionality has been ported to the React app with improvements.
