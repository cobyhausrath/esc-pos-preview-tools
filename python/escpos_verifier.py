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
    ESC_INIT, ESC_BOLD, ESC_UNDERLINE, ESC_ALIGN, ESC_PRINT_MODE,
    GS_CUT, GS_CHAR_SIZE,
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
        lines = [
            "from escpos.printer import Dummy",
            "",
            "# Create a Dummy printer to capture output",
            "p = Dummy()",
            "",
            "# Execute commands",
        ]

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

            for node in ast.walk(tree):
                # Check for dangerous imports
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        if alias.name not in ['escpos.printer', 'escpos']:
                            dangerous_ops.append(f"Import not allowed: {alias.name}")

                elif isinstance(node, ast.ImportFrom):
                    if node.module and not node.module.startswith('escpos'):
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
