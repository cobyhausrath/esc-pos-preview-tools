# Add Real-Time Printer Status Feedback

## Problem
Currently, the printer bridge only checks TCP connectivity (can connect to port). Users have no visibility into:
- Paper status (low, out)
- Printer errors (cover open, jam, etc.)
- Online/offline status
- Temperature/hardware issues

This makes debugging print failures difficult and provides poor UX.

## Proposed Solution

### Backend (printer-bridge.js)
Add real-time status queries using ESC-POS status commands:

**Commands to implement:**
- `DLE EOT 1` - Printer status
- `DLE EOT 2` - Offline status
- `DLE EOT 3` - Error status
- `DLE EOT 4` - Paper roll sensor status

**Response parsing:**
Each command returns a 1-byte status response that needs to be decoded:
- Bit 3: Paper end sensor (paper out)
- Bit 5: Cover open
- Bit 6: Paper feed button pressed
- etc.

### Frontend (editor.html)
Display status in UI:
- Expand connection status indicator to show detailed printer state
- Show warnings for low paper, errors
- Display status icon with color coding (green/yellow/red)
- Add "Check Status" button to manually query

### WebSocket Protocol Extension
Add new action type:
```json
{
  "action": "status",
  "printer": "netum"
}
```

Response:
```json
{
  "success": true,
  "status": {
    "online": true,
    "paperStatus": "ok" | "low" | "out",
    "coverOpen": false,
    "error": false,
    "errorMessage": null
  }
}
```

## Implementation Details

### printer-bridge.js
```javascript
async function queryPrinterStatus(host, port) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();

    client.on('connect', () => {
      // Send DLE EOT 4 (paper status)
      client.write(Buffer.from([0x10, 0x04, 0x04]));
    });

    client.on('data', (data) => {
      const statusByte = data[0];
      const status = parseStatusByte(statusByte);
      client.end();
      resolve(status);
    });

    // ... error handling
  });
}

function parseStatusByte(byte) {
  return {
    paperEnd: !!(byte & 0x08),      // Bit 3
    coverOpen: !!(byte & 0x20),     // Bit 5
    error: !!(byte & 0x40),         // Bit 6
    // ... other bits
  };
}
```

### UI Mockup
```
[🖨️ Netum 80-V-UL] [●] Online
  Paper: OK ✓
  Cover: Closed ✓

[Print] [Check Status]
```

## References
- [ESC-POS DLE Commands](https://download4.epson.biz/sec_pubs/pos/reference_en/escpos/dle_eot.html)
- Epson TM-T88V Command Reference (DLE EOT section)

## Acceptance Criteria
- [ ] Backend queries printer status after connection
- [ ] Status displayed in UI with clear indicators
- [ ] Paper out/low warnings shown
- [ ] Cover open errors displayed
- [ ] Manual "Check Status" button works
- [ ] Status errors prevent print attempts
- [ ] Works with both named and custom printers
- [ ] Gracefully handles printers that don't support status queries

## Complexity
**Medium** - Requires TCP communication, byte parsing, and UI updates. ESC-POS status commands are well-documented but implementation details vary by printer model.
