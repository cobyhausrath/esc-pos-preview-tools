#!/usr/bin/env python3
"""
ESC-POS Command Constants

This module defines all ESC-POS command bytes and values as named constants
to improve code readability and maintainability.
"""

# ============================================================================
# Command Prefix Bytes
# ============================================================================

ESC = 0x1B  # ESC prefix for various printer commands
GS = 0x1D   # GS prefix for various printer commands
LF = 0x0A   # Line feed
CR = 0x0D   # Carriage return

# ============================================================================
# ESC Commands (0x1B prefix)
# ============================================================================

# Printer initialization and control
ESC_INIT = 0x40  # ESC @ - Initialize printer

# Text formatting
ESC_BOLD = 0x45  # ESC E - Bold on/off
ESC_UNDERLINE = 0x2D  # ESC - - Underline mode
ESC_ALIGN = 0x61  # ESC a - Alignment
ESC_PRINT_MODE = 0x21  # ESC ! - Print mode (combined formatting)

# Character and font settings
ESC_CHAR_CODE_TABLE = 0x74  # ESC t - Select character code table

# Paper control
ESC_LINE_FEED = 0x64  # ESC d - Print and feed n lines

# ============================================================================
# GS Commands (0x1D prefix)
# ============================================================================

# Paper cutting
GS_CUT = 0x56  # GS V - Cut paper

# Character size
GS_CHAR_SIZE = 0x21  # GS ! - Select character size

# ============================================================================
# Command Values
# ============================================================================

# Bold modes
BOLD_OFF = 0x00
BOLD_ON = 0x01

# Underline modes
UNDERLINE_OFF = 0x00
UNDERLINE_1DOT = 0x01
UNDERLINE_2DOT = 0x02

# Alignment values
ALIGN_LEFT = 0x00
ALIGN_CENTER = 0x01
ALIGN_RIGHT = 0x02

# Cut modes (both numeric and ASCII character representations)
CUT_FULL = 0x00
CUT_FULL_ASCII = 0x30  # ASCII '0'
CUT_PARTIAL = 0x01
CUT_PARTIAL_ASCII = 0x31  # ASCII '1'

# Print mode bits (ESC ! command)
PRINT_MODE_FONT_B = 0x01  # Bit 0: Character font B
PRINT_MODE_BOLD = 0x08  # Bit 3: Bold/emphasized
PRINT_MODE_DOUBLE_HEIGHT = 0x10  # Bit 4: Double height
PRINT_MODE_DOUBLE_WIDTH = 0x20  # Bit 5: Double width
PRINT_MODE_UNDERLINE = 0x80  # Bit 7: Underline

# ============================================================================
# ASCII Ranges
# ============================================================================

ASCII_PRINTABLE_START = 0x20  # Space character
ASCII_PRINTABLE_END = 0x7E  # Tilde character

# ============================================================================
# Limits and Constraints
# ============================================================================

MAX_INPUT_SIZE = 1_000_000  # Maximum ESC-POS data size (1MB)

# ============================================================================
# Mappings
# ============================================================================

ALIGN_VALUE_TO_NAME = {
    ALIGN_LEFT: 'left',
    ALIGN_CENTER: 'center',
    ALIGN_RIGHT: 'right',
}

CUT_VALUE_TO_MODE = {
    CUT_FULL: 'FULL',
    CUT_FULL_ASCII: 'FULL',
    CUT_PARTIAL: 'PART',
    CUT_PARTIAL_ASCII: 'PART',
}
