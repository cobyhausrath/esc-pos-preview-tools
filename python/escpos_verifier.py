#!/usr/bin/env python3
"""
ESC-POS to python-escpos Verification Tool

This module:
1. Parses raw ESC-POS byte sequences
2. Generates equivalent python-escpos API calls
3. Executes those calls to verify they produce the same output
4. Provides a bidirectional verification loop for receipt editing

Usage:
    verifier = EscPosVerifier()
    python_code = verifier.bytes_to_python_escpos(escpos_bytes)
    verified = verifier.verify(escpos_bytes, python_code)
"""

import io
import ast
import logging
from typing import List, Tuple, Dict, Any, Optional
from dataclasses import dataclass, field

from escpos_constants import (
    ESC, GS, LF, CR,
    ESC_INIT, ESC_BOLD, ESC_UNDERLINE, ESC_ALIGN, ESC_PRINT_MODE, ESC_BIT_IMAGE,
    GS_CUT, GS_CHAR_SIZE, GS_RASTER_IMAGE,
    BOLD_ON, UNDERLINE_OFF,
    ALIGN_LEFT, ALIGN_CENTER, ALIGN_RIGHT, ALIGN_VALUE_TO_NAME,
    CUT_PARTIAL, CUT_PARTIAL_ASCII, CUT_VALUE_TO_MODE,
    PRINT_MODE_BOLD, PRINT_MODE_DOUBLE_HEIGHT, PRINT_MODE_DOUBLE_WIDTH,
    ASCII_PRINTABLE_START, ASCII_PRINTABLE_END,
    MAX_INPUT_SIZE
)


@dataclass
class ParsedCommand:
    """Represents a parsed ESC-POS command with its python-escpos equivalent"""
    name: str
    escpos_bytes: bytes
    python_call: str
    params: Dict[str, Any]


class EscPosVerifier:
    """
    Bidirectional converter and verifier between ESC-POS bytes and python-escpos API
    """

    def __init__(self, logger: Optional[logging.Logger] = None):
        self.logger = logger or logging.getLogger(__name__)
        self.position = 0
        self.commands: List[ParsedCommand] = []
        self.warnings: List[str] = []

    def parse_escpos(self, data: bytes) -> List[ParsedCommand]:
        """
        Parse ESC-POS byte sequences into structured commands

        Args:
            data: Raw ESC-POS bytes

        Returns:
            List of ParsedCommand objects

        Raises:
            TypeError: If data is not bytes
            ValueError: If data exceeds maximum size
        """
        # Input validation
        if not isinstance(data, bytes):
            raise TypeError(f"Expected bytes, got {type(data).__name__}")
        if len(data) > MAX_INPUT_SIZE:
            raise ValueError(f"ESC-POS data too large (>{MAX_INPUT_SIZE} bytes)")

        self.logger.debug(f"Parsing {len(data)} bytes of ESC-POS data")
        self.position = 0
        self.commands = []
        self.warnings = []

        while self.position < len(data):
            # Check for ESC sequences
            if data[self.position] == ESC:
                self._parse_esc_sequence(data)
            # Check for GS sequences
            elif data[self.position] == GS:
                self._parse_gs_sequence(data)
            # Line feed
            elif data[self.position] == LF:
                self.commands.append(ParsedCommand(
                    name="line_feed",
                    escpos_bytes=bytes([LF]),
                    python_call="p.text('\\n')",
                    params={}
                ))
                self.position += 1
            # Carriage return
            elif data[self.position] == CR:
                # Often paired with LF, skip it
                self.position += 1
            # Plain text
            elif ASCII_PRINTABLE_START <= data[self.position] <= ASCII_PRINTABLE_END:
                self._parse_text(data)
            else:
                # Unknown byte, track for debugging
                warning = f"Unknown byte 0x{data[self.position]:02X} at position {self.position}"
                self.warnings.append(warning)
                self.logger.warning(warning)
                self.position += 1

        # Merge sequential bit images (ESC * stripes of the same image)
        self._merge_bit_image_stripes()

        if self.warnings:
            self.logger.info(f"Parsing completed with {len(self.warnings)} warning(s)")

        return self.commands

    def _parse_esc_sequence(self, data: bytes):
        """Parse ESC sequences"""
        if self.position + 1 >= len(data):
            self.position += 1
            return

        command = data[self.position + 1]

        # ESC @ - Initialize printer
        if command == ESC_INIT:
            self.commands.append(ParsedCommand(
                name="initialize",
                escpos_bytes=bytes([ESC, ESC_INIT]),
                python_call="p.hw('init')",
                params={}
            ))
            self.position += 2
            self.logger.debug("Parsed initialize command")

        # ESC E - Bold on/off
        elif command == ESC_BOLD:
            if self.position + 2 >= len(data):
                self.position += 2
                return
            value = data[self.position + 2]
            enabled = value != 0
            self.commands.append(ParsedCommand(
                name="bold",
                escpos_bytes=bytes([ESC, ESC_BOLD, value]),
                python_call=f"p.set(bold={str(enabled)})",
                params={"enabled": enabled}
            ))
            self.position += 3
            self.logger.debug(f"Parsed bold command: {enabled}")

        # ESC - - Underline on/off
        elif command == ESC_UNDERLINE:
            if self.position + 2 >= len(data):
                self.position += 2
                return
            value = data[self.position + 2]
            # value: 0=off, 1=on (1-dot), 2=on (2-dot)
            self.commands.append(ParsedCommand(
                name="underline",
                escpos_bytes=bytes([ESC, ESC_UNDERLINE, value]),
                python_call=f"p.set(underline={value})",
                params={"mode": value}
            ))
            self.position += 3
            self.logger.debug(f"Parsed underline command: {value}")

        # ESC a - Alignment
        elif command == ESC_ALIGN:
            if self.position + 2 >= len(data):
                self.position += 2
                return
            value = data[self.position + 2]
            align = ALIGN_VALUE_TO_NAME.get(value, 'left')
            self.commands.append(ParsedCommand(
                name="align",
                escpos_bytes=bytes([ESC, ESC_ALIGN, value]),
                python_call=f"p.set(align='{align}')",
                params={"align": align}
            ))
            self.position += 3
            self.logger.debug(f"Parsed alignment command: {align}")

        # ESC * - Bit image
        elif command == ESC_BIT_IMAGE:
            if self.position + 4 >= len(data):
                self.position += 2
                return
            mode = data[self.position + 2]
            nL = data[self.position + 3]
            nH = data[self.position + 4]
            width_dots = nL + (nH * 256)

            # Calculate data bytes based on mode
            # Mode determines vertical dot density:
            # 0, 1: 8 dots (1 byte per column)
            # 2, 3: 16 dots (2 bytes per column)
            # 32, 33: 24 dots (3 bytes per column)
            if mode in [0, 1]:
                bytes_per_column = 1
                height_dots = 8
            elif mode in [2, 3]:
                bytes_per_column = 2
                height_dots = 16
            elif mode in [32, 33]:
                bytes_per_column = 3
                height_dots = 24
            else:
                # Unknown mode, guess 1 byte per column
                bytes_per_column = 1
                height_dots = 8

            data_bytes = width_dots * bytes_per_column
            total_size = 5 + data_bytes

            if self.position + total_size <= len(data):
                # Extract image data
                image_data = data[self.position + 5:self.position + total_size]

                # Try to decode the image
                b64_image = self._decode_bit_image(width_dots, height_dots, bytes_per_column, image_data)

                if b64_image:
                    # Generate code with embedded image
                    # Note: ESC * images are sent as horizontal stripes without alignment changes
                    python_call = f"""# Bit image ({width_dots}x{height_dots} dots, mode {mode})
img_data = base64.b64decode('''{b64_image}''')
img = Image.open(io.BytesIO(img_data))
p.image(img, impl='bitImageColumn')"""
                else:
                    # Fallback if decode fails
                    python_call = f"# Bit image ({width_dots}x{height_dots} dots, mode {mode}) - decode failed"

                self.commands.append(ParsedCommand(
                    name="bit_image",
                    escpos_bytes=data[self.position:self.position + total_size],
                    python_call=python_call,
                    params={
                        "width": width_dots,
                        "height": height_dots,
                        "mode": mode,
                        "type": "bit_image",
                        "base64": b64_image if b64_image else None
                    }
                ))
                self.position += total_size
                self.logger.debug(f"Parsed bit image: {width_dots}x{height_dots} dots, mode {mode}")
            else:
                # Not enough data
                self.position += 2

        # ESC ! - Print mode (size, bold, etc.)
        elif command == ESC_PRINT_MODE:
            if self.position + 2 >= len(data):
                self.position += 2
                return
            value = data[self.position + 2]

            # Parse the mode byte using constants
            # Bit 0: Character font (ignored)
            # Bit 3: Bold
            # Bit 4: Double height
            # Bit 5: Double width
            # Bit 7: Underline (ignored, use ESC -)

            bold = bool(value & PRINT_MODE_BOLD)
            double_height = bool(value & PRINT_MODE_DOUBLE_HEIGHT)
            double_width = bool(value & PRINT_MODE_DOUBLE_WIDTH)

            # Determine size string for python-escpos
            if double_height and double_width:
                size = '2x'
            elif double_width:
                size = '2w'
            elif double_height:
                size = '2h'
            else:
                size = 'normal'

            params_list = []
            if bold:
                params_list.append("bold=True")
            if size != 'normal':
                params_list.append(f"width={2 if double_width else 1}")
                params_list.append(f"height={2 if double_height else 1}")

            python_call = f"p.set({', '.join(params_list)})" if params_list else "p.set()"

            self.commands.append(ParsedCommand(
                name="print_mode",
                escpos_bytes=bytes([ESC, ESC_PRINT_MODE, value]),
                python_call=python_call,
                params={"mode": value, "bold": bold, "size": size}
            ))
            self.position += 3
            self.logger.debug(f"Parsed print mode: bold={bold}, size={size}")

        else:
            # Unknown ESC command
            warning = f"Unknown ESC command 0x{command:02X} at position {self.position}"
            self.warnings.append(warning)
            self.logger.warning(warning)
            self.position += 2

    def _parse_gs_sequence(self, data: bytes):
        """Parse GS sequences"""
        if self.position + 1 >= len(data):
            self.position += 1
            return

        command = data[self.position + 1]

        # GS V - Paper cut
        if command == GS_CUT:
            if self.position + 2 >= len(data):
                self.position += 2
                return
            mode = data[self.position + 2]
            cut_mode = CUT_VALUE_TO_MODE.get(mode, 'FULL')
            self.commands.append(ParsedCommand(
                name="cut",
                escpos_bytes=bytes([GS, GS_CUT, mode]),
                python_call=f"p.cut(mode='{cut_mode}')",
                params={"mode": cut_mode}
            ))
            self.position += 3
            self.logger.debug(f"Parsed cut command: {cut_mode}")

        # GS v - Raster image (GS v 0 format)
        elif command == GS_RASTER_IMAGE:
            if self.position + 7 >= len(data):
                self.position += 2
                return

            # Check for GS v 0 format (0x30 = ASCII '0')
            sub_command = data[self.position + 2]
            if sub_command == 0x30 or sub_command == 0x00:  # Support both 0 and ASCII '0'
                mode = data[self.position + 3]
                xL = data[self.position + 4]
                xH = data[self.position + 5]
                yL = data[self.position + 6]
                yH = data[self.position + 7]

                width_bytes = xL + (xH * 256)
                height_dots = yL + (yH * 256)
                data_bytes = width_bytes * height_dots
                total_size = 8 + data_bytes

                if self.position + total_size <= len(data):
                    width_pixels = width_bytes * 8

                    # Extract image data
                    image_data = data[self.position + 8:self.position + total_size]

                    # Try to decode the image
                    b64_image = self._decode_raster_image(width_bytes, height_dots, image_data)

                    if b64_image:
                        # Generate code with embedded image
                        python_call = f"""# Raster image ({width_pixels}x{height_dots}px)
img_data = base64.b64decode('''{b64_image}''')
img = Image.open(io.BytesIO(img_data))
p.set(align='center')
p.image(img, impl='bitImageRaster')
p.set(align='left')"""
                    else:
                        # Fallback if decode fails
                        python_call = f"# TODO: Image ({width_pixels}x{height_dots}px) - decode failed"

                    self.commands.append(ParsedCommand(
                        name="raster_image",
                        escpos_bytes=data[self.position:self.position + total_size],
                        python_call=python_call,
                        params={
                            "width_bytes": width_bytes,
                            "width_pixels": width_pixels,
                            "height": height_dots,
                            "mode": mode,
                            "type": "raster_image",
                            "base64": b64_image if b64_image else None
                        }
                    ))
                    self.position += total_size
                    self.logger.debug(f"Parsed raster image: {width_pixels}x{height_dots}px, mode {mode}")
                else:
                    # Not enough data
                    self.position += 2
            else:
                # Unknown GS v sub-command
                warning = f"Unknown GS v sub-command 0x{sub_command:02X} at position {self.position}"
                self.warnings.append(warning)
                self.logger.warning(warning)
                self.position += 3

        # GS ! - Character size
        elif command == GS_CHAR_SIZE:
            if self.position + 2 >= len(data):
                self.position += 2
                return
            value = data[self.position + 2]
            # Lower 3 bits: width (0-7, means 1-8x)
            # Upper 3 bits: height (0-7, means 1-8x)
            width = (value & 0x07) + 1
            height = ((value >> 4) & 0x07) + 1

            self.commands.append(ParsedCommand(
                name="size",
                escpos_bytes=bytes([GS, GS_CHAR_SIZE, value]),
                python_call=f"p.set(width={width}, height={height})",
                params={"width": width, "height": height}
            ))
            self.position += 3
            self.logger.debug(f"Parsed size command: width={width}, height={height}")

        else:
            # Unknown GS command
            warning = f"Unknown GS command 0x{command:02X} at position {self.position}"
            self.warnings.append(warning)
            self.logger.warning(warning)
            self.position += 2

    def _parse_text(self, data: bytes):
        """Parse plain text"""
        start = self.position
        while (self.position < len(data) and
               ASCII_PRINTABLE_START <= data[self.position] <= ASCII_PRINTABLE_END):
            self.position += 1

        text_bytes = data[start:self.position]
        text = text_bytes.decode('ascii', errors='replace')

        # Escape special characters for Python string
        escaped_text = text.replace('\\', '\\\\').replace("'", "\\'")

        self.commands.append(ParsedCommand(
            name="text",
            escpos_bytes=text_bytes,
            python_call=f"p.text('{escaped_text}')",
            params={"text": text}
        ))
        self.logger.debug(f"Parsed text: {len(text)} characters")

    def _merge_bit_image_stripes(self):
        """
        Merge sequential ESC * bit images into single tall images

        ESC * mode 33 (24-dot) is often used to send tall images as horizontal stripes.
        This method detects and combines sequential bit images with the same width/mode.
        """
        if not self.commands:
            return

        merged_commands = []
        i = 0

        while i < len(self.commands):
            cmd = self.commands[i]

            # Check if this is a bit image
            if cmd.name == "bit_image":
                # Look ahead for sequential bit images with same width and mode
                stripes = [cmd]
                j = i + 1

                # Skip line feeds between stripes
                while j < len(self.commands):
                    next_cmd = self.commands[j]

                    # Allow line feeds between stripes (they're often present)
                    if next_cmd.name == "line_feed":
                        j += 1
                        continue

                    # Check if it's another bit image with matching parameters
                    if (next_cmd.name == "bit_image" and
                        next_cmd.params.get("width") == cmd.params.get("width") and
                        next_cmd.params.get("mode") == cmd.params.get("mode")):
                        stripes.append(next_cmd)
                        j += 1
                    else:
                        break

                # If we found multiple stripes, merge them
                if len(stripes) > 1:
                    merged_cmd = self._combine_bit_image_stripes(stripes)
                    merged_commands.append(merged_cmd)
                    i = j  # Skip all merged commands
                    self.logger.debug(f"Merged {len(stripes)} bit image stripes into single image")
                else:
                    # Single image, add as-is
                    merged_commands.append(cmd)
                    i += 1
            else:
                # Not a bit image, add as-is
                merged_commands.append(cmd)
                i += 1

        self.commands = merged_commands

    def _combine_bit_image_stripes(self, stripes: List[ParsedCommand]) -> ParsedCommand:
        """
        Combine multiple bit image stripes into a single tall image

        Args:
            stripes: List of bit image commands to combine

        Returns:
            Single ParsedCommand with combined image
        """
        # Get parameters from first stripe
        width_dots = stripes[0].params["width"]
        height_per_stripe = stripes[0].params["height"]
        mode = stripes[0].params["mode"]

        # Determine bytes per column based on mode
        if mode in [32, 33]:
            bytes_per_column_per_stripe = 3  # 24 dots
        elif mode in [2, 3]:
            bytes_per_column_per_stripe = 2  # 16 dots
        elif mode in [0, 1]:
            bytes_per_column_per_stripe = 1  # 8 dots
        else:
            bytes_per_column_per_stripe = 1  # default

        # Total bytes per column for the combined image
        bytes_per_column = bytes_per_column_per_stripe * len(stripes)
        total_height = height_per_stripe * len(stripes)

        # Extract raw image data from each stripe's escpos_bytes
        # ESC * format: ESC 0x2A mode nL nH [data...]
        # Important: ESC * uses column-major format, so we need to interleave stripe data
        # by column, not concatenate all stripes sequentially

        # Extract data from each stripe (skip 5-byte header)
        stripe_data_list = []
        for stripe in stripes:
            stripe_data = stripe.escpos_bytes[5:]
            stripe_data_list.append(stripe_data)

        # Interleave by column: for each column, concatenate bytes from all stripes
        combined_data = bytearray()
        bytes_per_stripe_column = bytes_per_column_per_stripe

        for col in range(width_dots):
            # For this column, gather bytes from each stripe
            for stripe_data in stripe_data_list:
                # Calculate offset for this column in this stripe's data
                offset = col * bytes_per_stripe_column
                # Take the bytes for this column from this stripe
                col_bytes = stripe_data[offset:offset + bytes_per_stripe_column]
                combined_data.extend(col_bytes)

        # Now decode the combined raw data as a single tall image
        b64_image = self._decode_bit_image(width_dots, total_height, bytes_per_column, bytes(combined_data))

        if b64_image:
            # Generate python call for combined image
            python_call = f"""# Bit image ({width_dots}x{total_height} dots, {len(stripes)} stripes of mode {mode})
img_data = base64.b64decode('''{b64_image}''')
img = Image.open(io.BytesIO(img_data))
p.image(img, impl='bitImageColumn')"""
        else:
            # Fallback if decode fails
            python_call = f"# Bit image ({width_dots}x{total_height} dots, {len(stripes)} stripes) - decode failed"

        # Combine all ESC-POS bytes
        combined_bytes = b''.join(stripe.escpos_bytes for stripe in stripes)

        return ParsedCommand(
            name="bit_image",
            escpos_bytes=combined_bytes,
            python_call=python_call,
            params={
                "width": width_dots,
                "height": total_height,
                "mode": mode,
                "type": "bit_image_combined",
                "stripe_count": len(stripes),
                "base64": b64_image if b64_image else None
            }
        )

    def _decode_bit_image(self, width_dots: int, height_dots: int, bytes_per_column: int, data: bytes) -> str:
        """
        Decode ESC * bit image data to base64 PNG

        ESC * format uses column-major order (vertical strips)

        Args:
            width_dots: Width in dots
            height_dots: Height in dots (8, 16, or 24)
            bytes_per_column: Bytes per column (1, 2, or 3)
            data: Raw image data

        Returns:
            Base64-encoded PNG string
        """
        try:
            from PIL import Image
            import io
            import base64

            # Create a new black and white image
            img = Image.new('1', (width_dots, height_dots), 1)  # 1 = white background
            pixels = img.load()

            # Decode bitmap data (column-major order)
            data_idx = 0
            for x in range(width_dots):
                # Read bytes for this column
                for byte_idx in range(bytes_per_column):
                    if data_idx >= len(data):
                        break

                    byte = data[data_idx]
                    data_idx += 1

                    # Extract 8 vertical pixels from this byte
                    # Bit 7 (MSB) = top pixel, bit 0 (LSB) = bottom pixel
                    for bit in range(8):
                        y = byte_idx * 8 + (7 - bit)
                        if y >= height_dots:
                            break

                        pixel_on = (byte & (1 << bit)) != 0
                        pixels[x, y] = 0 if pixel_on else 1  # 0 = black, 1 = white

            # Convert to PNG and encode as base64
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            png_data = buffer.getvalue()
            b64_data = base64.b64encode(png_data).decode('ascii')

            return b64_data

        except Exception as e:
            self.logger.error(f"Failed to decode bit image: {e}")
            return ""

    def _decode_raster_image(self, width_bytes: int, height_dots: int, data: bytes) -> str:
        """
        Decode raster image data to base64 PNG

        Args:
            width_bytes: Width in bytes (each byte = 8 pixels)
            height_dots: Height in dots/pixels
            data: Raw image data

        Returns:
            Base64-encoded PNG string
        """
        try:
            from PIL import Image
            import io
            import base64

            width_pixels = width_bytes * 8

            # Create a new black and white image
            img = Image.new('1', (width_pixels, height_dots), 1)  # 1 = white background
            pixels = img.load()

            # Decode bitmap data (row-major order)
            data_idx = 0
            for y in range(height_dots):
                for x_byte in range(width_bytes):
                    if data_idx >= len(data):
                        break

                    byte = data[data_idx]
                    data_idx += 1

                    # Extract 8 horizontal pixels from this byte
                    # GS v 0 format: bit 7 (MSB) = leftmost pixel, bit 0 (LSB) = rightmost
                    for bit in range(8):
                        x = x_byte * 8 + (7 - bit)
                        if x >= width_pixels:
                            break

                        pixel_on = (byte & (1 << bit)) != 0
                        pixels[x, y] = 0 if pixel_on else 1  # 0 = black, 1 = white

            # Convert to PNG and encode as base64
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            png_data = buffer.getvalue()
            b64_data = base64.b64encode(png_data).decode('ascii')

            return b64_data

        except Exception as e:
            self.logger.error(f"Failed to decode raster image: {e}")
            return ""

    def generate_python_code(self, commands: List[ParsedCommand],
                            printer_class: str = "Dummy") -> str:
        """
        Generate complete python-escpos code from parsed commands

        Args:
            commands: List of parsed commands
            printer_class: Printer class to use (Dummy, USB, Network, etc.)

        Returns:
            Complete Python script as string
        """
        # Check if we need PIL for images
        has_images = any(cmd.name in ['raster_image', 'bit_image'] for cmd in commands)

        lines = []
        if has_images:
            lines.extend([
                "from escpos.printer import Dummy",
                "from PIL import Image",
                "import io",
                "import base64",
                "",
            ])
        else:
            lines.extend([
                "from escpos.printer import Dummy",
                "",
            ])

        lines.extend([
            "# Create a Dummy printer to capture output",
            "p = Dummy()",
            "",
            "# Execute commands",
        ])

        for cmd in commands:
            lines.append(cmd.python_call)

        lines.extend([
            "",
            "# Get the generated ESC-POS bytes",
            "escpos_output = p.output",
        ])

        return "\n".join(lines)

    def validate_python_code(self, code: str) -> Tuple[bool, str]:
        """
        Validate Python code using AST parsing before execution

        This provides a basic security check to ensure the code only contains
        allowed python-escpos operations.

        Args:
            code: Python code string to validate

        Returns:
            Tuple of (is_valid: bool, message: str)
        """
        try:
            tree = ast.parse(code)

            # Check for dangerous operations
            dangerous_ops = []

            # Allowed import prefixes (more permissive)
            allowed_import_prefixes = ['escpos']
            # Allowed standard library imports for python-escpos code
            allowed_stdlib_imports = ['io', 'sys', 'typing', 'dataclasses', 'logging', 'ast']

            for node in ast.walk(tree):
                # Check for dangerous imports
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        # Check if it's an allowed module
                        is_allowed = (
                            alias.name in allowed_stdlib_imports or
                            any(alias.name.startswith(prefix) for prefix in allowed_import_prefixes)
                        )
                        if not is_allowed:
                            dangerous_ops.append(f"Import not allowed: {alias.name}")

                elif isinstance(node, ast.ImportFrom):
                    if node.module:
                        # Check if it's an allowed module
                        is_allowed = (
                            node.module in allowed_stdlib_imports or
                            any(node.module.startswith(prefix) for prefix in allowed_import_prefixes)
                        )
                        if not is_allowed:
                            dangerous_ops.append(f"Import from not allowed: {node.module}")

                # Check for file operations
                elif isinstance(node, ast.Call):
                    if isinstance(node.func, ast.Name):
                        if node.func.id in ['open', 'exec', 'eval', 'compile', '__import__']:
                            dangerous_ops.append(f"Dangerous function call: {node.func.id}")

            if dangerous_ops:
                return False, "Security validation failed:\n" + "\n".join(dangerous_ops)

            return True, "Code validation passed"

        except SyntaxError as e:
            return False, f"Syntax error: {e}"

    def execute_python_code(self, code: str, validate: bool = True) -> bytes:
        """
        Execute python-escpos code and return generated bytes

        WARNING: This function executes arbitrary Python code. Only execute code
        from trusted sources. Use validate=True (default) for basic security checks.

        Args:
            code: Python code string to execute
            validate: Whether to validate code before execution (default: True)

        Returns:
            Generated ESC-POS bytes

        Raises:
            RuntimeError: If code execution fails or validation fails
        """
        # Validate code if requested
        if validate:
            is_valid, message = self.validate_python_code(code)
            if not is_valid:
                self.logger.error(f"Code validation failed: {message}")
                raise RuntimeError(f"Code validation failed: {message}")
            self.logger.debug("Code validation passed")

        try:
            # Import required modules for execution context
            from escpos.printer import Dummy

            # Create execution context with minimal namespace
            local_vars = {}

            self.logger.debug("Executing python-escpos code")
            # Execute the generated code
            exec(code, {"Dummy": Dummy}, local_vars)

            # Return the captured output
            result = local_vars.get('escpos_output', b'')
            self.logger.debug(f"Execution completed, generated {len(result)} bytes")
            return result

        except Exception as e:
            self.logger.error(f"Code execution failed: {e}")
            raise RuntimeError(f"Failed to execute python-escpos code: {e}")

    def verify(self, original_bytes: bytes, generated_code: str,
               semantic: bool = True) -> Tuple[bool, str]:
        """
        Verify that python-escpos code generates equivalent ESC-POS output

        Args:
            original_bytes: Original ESC-POS byte sequence
            generated_code: Generated python-escpos code
            semantic: If True, compare semantic equivalence (default).
                     If False, compare byte-for-byte (stricter).

        Returns:
            Tuple of (success: bool, message: str)
        """
        try:
            generated_bytes = self.execute_python_code(generated_code)

            if original_bytes == generated_bytes:
                return True, "✓ Verification successful: Byte-for-byte match"

            if semantic:
                # Compare semantic equivalence by parsing both sequences
                original_cmds = self.parse_escpos(original_bytes)
                generated_cmds = self.parse_escpos(generated_bytes)

                # Compare commands semantically (ignoring python-escpos internals)
                if self._semantically_equivalent(original_cmds, generated_cmds):
                    msg = ["✓ Verification successful: Semantically equivalent",
                           "",
                           "Note: python-escpos adds implementation-specific commands:",
                           "  - ESC t (character code table)",
                           "  - ESC d (line feed before cut)",
                           "These are normal and don't affect visual output."]
                    return True, "\n".join(msg)

            # Provide detailed diff
            diff_msg = self._create_byte_diff(original_bytes, generated_bytes)
            return False, f"✗ Verification failed:\n{diff_msg}"

        except Exception as e:
            return False, f"✗ Verification error: {str(e)}"

    def _semantically_equivalent(self, cmds1: List[ParsedCommand],
                                 cmds2: List[ParsedCommand]) -> bool:
        """
        Check if two command lists are semantically equivalent

        Ignores python-escpos implementation details like:
        - ESC t (character code table selection)
        - ESC d (line feed)
        """
        # Filter out implementation-specific commands
        def filter_impl_details(cmds):
            filtered = []
            for cmd in cmds:
                # Skip unknown commands (likely python-escpos internals)
                if cmd.name == 'unknown':
                    continue
                filtered.append(cmd)
            return filtered

        filtered1 = filter_impl_details(cmds1)
        filtered2 = filter_impl_details(cmds2)

        if len(filtered1) != len(filtered2):
            return False

        # Compare each command
        for c1, c2 in zip(filtered1, filtered2):
            if c1.name != c2.name:
                return False
            # Compare key parameters (not raw bytes)
            if c1.params != c2.params:
                return False

        return True

    def _create_byte_diff(self, original: bytes, generated: bytes) -> str:
        """Create a readable diff of two byte sequences"""
        lines = []
        lines.append(f"Original length: {len(original)} bytes")
        lines.append(f"Generated length: {len(generated)} bytes")
        lines.append("")

        max_len = max(len(original), len(generated))

        # Show first difference
        for i in range(min(len(original), len(generated))):
            if original[i] != generated[i]:
                lines.append(f"First difference at byte {i}:")
                lines.append(f"  Original:  0x{original[i]:02X} ({original[i]})")
                lines.append(f"  Generated: 0x{generated[i]:02X} ({generated[i]})")
                break

        if len(original) != len(generated):
            lines.append(f"Length mismatch: {len(original)} vs {len(generated)}")

        return "\n".join(lines)

    def bytes_to_python_escpos(self, escpos_bytes: bytes) -> str:
        """
        Main conversion function: ESC-POS bytes → python-escpos code

        Args:
            escpos_bytes: Raw ESC-POS byte sequence

        Returns:
            Complete Python script using python-escpos API
        """
        commands = self.parse_escpos(escpos_bytes)
        return self.generate_python_code(commands)


def demo():
    """Demonstration of the verification loop"""

    # Example ESC-POS sequence for a simple receipt
    sample_escpos = bytes([
        0x1B, 0x40,              # Initialize
        0x1B, 0x61, 0x01,        # Center align
        0x1B, 0x45, 0x01,        # Bold on
        ord('M'), ord('Y'), ord(' '), ord('S'), ord('T'), ord('O'), ord('R'), ord('E'),
        0x1B, 0x45, 0x00,        # Bold off
        0x0A,                     # Line feed
        0x1B, 0x61, 0x00,        # Left align
        ord('I'), ord('t'), ord('e'), ord('m'), ord(':'), ord(' '), ord('$'), ord('9'), ord('.'), ord('9'), ord('9'),
        0x0A,                     # Line feed
        0x1D, 0x56, 0x00,        # Full cut
    ])

    print("=" * 60)
    print("ESC-POS to python-escpos Verification Demo")
    print("=" * 60)
    print()

    # Create verifier
    verifier = EscPosVerifier()

    # Convert to python-escpos code
    print("1. Parsing ESC-POS bytes...")
    python_code = verifier.bytes_to_python_escpos(sample_escpos)

    print("\n2. Generated python-escpos code:")
    print("-" * 60)
    print(python_code)
    print("-" * 60)

    # Verify the conversion
    print("\n3. Verifying output...")
    success, message = verifier.verify(sample_escpos, python_code)
    print(message)

    # Show parsed commands
    print("\n4. Parsed commands:")
    commands = verifier.parse_escpos(sample_escpos)
    for i, cmd in enumerate(commands, 1):
        print(f"   {i}. {cmd.name:15} → {cmd.python_call}")

    print("\n" + "=" * 60)
    print(f"Verification: {'PASSED ✓' if success else 'FAILED ✗'}")
    print("=" * 60)


if __name__ == "__main__":
    demo()
