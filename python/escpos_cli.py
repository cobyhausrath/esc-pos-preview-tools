#!/usr/bin/env python3
"""
ESC-POS CLI Tool

Command-line interface for converting ESC-POS byte sequences to python-escpos code
and verifying the conversion.

Usage:
    # Convert ESC-POS file to Python code
    python escpos_cli.py convert input.bin -o output.py

    # Verify conversion
    python escpos_cli.py verify input.bin -c code.py

    # Convert and verify in one step
    python escpos_cli.py convert input.bin -o output.py --verify
"""

import argparse
import logging
import sys
from pathlib import Path
from typing import Optional

from escpos_verifier import EscPosVerifier


def setup_logging(verbose: bool = False) -> None:
    """Configure logging based on verbosity level"""
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format='%(levelname)s: %(message)s'
    )


def convert_command(args: argparse.Namespace) -> int:
    """
    Convert ESC-POS bytes to python-escpos code

    Args:
        args: Command-line arguments

    Returns:
        Exit code (0 for success, 1 for error)
    """
    try:
        # Read input file
        input_path = Path(args.input)
        if not input_path.exists():
            print(f"Error: Input file '{args.input}' not found", file=sys.stderr)
            return 1

        with open(input_path, 'rb') as f:
            escpos_bytes = f.read()

        print(f"Read {len(escpos_bytes)} bytes from {args.input}")

        # Create verifier
        verifier = EscPosVerifier()

        # Convert to Python code
        python_code = verifier.bytes_to_python_escpos(escpos_bytes)

        # Display warnings if any
        if verifier.warnings:
            print(f"\nWarnings ({len(verifier.warnings)}):")
            for warning in verifier.warnings:
                print(f"  - {warning}")

        # Output result
        if args.output:
            output_path = Path(args.output)
            with open(output_path, 'w') as f:
                f.write(python_code)
            print(f"\nWrote Python code to {args.output}")
        else:
            print("\nGenerated Python code:")
            print("-" * 60)
            print(python_code)
            print("-" * 60)

        # Verify if requested
        if args.verify:
            print("\nVerifying conversion...")
            success, message = verifier.verify(escpos_bytes, python_code)
            print(message)
            if not success:
                return 1

        return 0

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        if args.verbose:
            import traceback
            traceback.print_exc()
        return 1


def verify_command(args: argparse.Namespace) -> int:
    """
    Verify that python-escpos code produces equivalent ESC-POS output

    Args:
        args: Command-line arguments

    Returns:
        Exit code (0 for success, 1 for error)
    """
    try:
        # Read input files
        input_path = Path(args.input)
        code_path = Path(args.code)

        if not input_path.exists():
            print(f"Error: Input file '{args.input}' not found", file=sys.stderr)
            return 1

        if not code_path.exists():
            print(f"Error: Code file '{args.code}' not found", file=sys.stderr)
            return 1

        with open(input_path, 'rb') as f:
            escpos_bytes = f.read()

        with open(code_path, 'r') as f:
            python_code = f.read()

        print(f"Read {len(escpos_bytes)} bytes from {args.input}")
        print(f"Read {len(python_code)} characters from {args.code}")

        # Create verifier
        verifier = EscPosVerifier()

        # Verify
        print("\nVerifying...")
        semantic = not args.strict
        success, message = verifier.verify(escpos_bytes, python_code, semantic=semantic)
        print(message)

        return 0 if success else 1

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        if args.verbose:
            import traceback
            traceback.print_exc()
        return 1


def parse_command(args: argparse.Namespace) -> int:
    """
    Parse ESC-POS bytes and display commands

    Args:
        args: Command-line arguments

    Returns:
        Exit code (0 for success, 1 for error)
    """
    try:
        # Read input file
        input_path = Path(args.input)
        if not input_path.exists():
            print(f"Error: Input file '{args.input}' not found", file=sys.stderr)
            return 1

        with open(input_path, 'rb') as f:
            escpos_bytes = f.read()

        print(f"Read {len(escpos_bytes)} bytes from {args.input}\n")

        # Create verifier and parse
        verifier = EscPosVerifier()
        commands = verifier.parse_escpos(escpos_bytes)

        # Display commands
        print(f"Parsed {len(commands)} commands:\n")
        for i, cmd in enumerate(commands, 1):
            print(f"{i:3}. {cmd.name:15} → {cmd.python_call}")
            if args.show_bytes:
                hex_str = ' '.join(f'{b:02X}' for b in cmd.escpos_bytes)
                print(f"     Bytes: {hex_str}")

        # Display warnings if any
        if verifier.warnings:
            print(f"\n\nWarnings ({len(verifier.warnings)}):")
            for warning in verifier.warnings:
                print(f"  - {warning}")

        return 0

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        if args.verbose:
            import traceback
            traceback.print_exc()
        return 1


def main() -> int:
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description='ESC-POS to python-escpos converter and verifier',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Convert ESC-POS to Python code
  %(prog)s convert receipt.bin -o receipt.py

  # Convert and verify
  %(prog)s convert receipt.bin -o receipt.py --verify

  # Verify existing conversion
  %(prog)s verify receipt.bin -c receipt.py

  # Parse and display commands
  %(prog)s parse receipt.bin --show-bytes

  # Use strict byte-for-byte verification
  %(prog)s verify receipt.bin -c receipt.py --strict
        """
    )

    parser.add_argument('-v', '--verbose', action='store_true',
                        help='Enable verbose output')

    subparsers = parser.add_subparsers(dest='command', help='Command to execute')
    subparsers.required = True

    # Convert command
    convert_parser = subparsers.add_parser('convert',
                                            help='Convert ESC-POS bytes to python-escpos code')
    convert_parser.add_argument('input', help='Input ESC-POS file')
    convert_parser.add_argument('-o', '--output', help='Output Python file (optional)')
    convert_parser.add_argument('--verify', action='store_true',
                                 help='Verify conversion after generating code')
    convert_parser.set_defaults(func=convert_command)

    # Verify command
    verify_parser = subparsers.add_parser('verify',
                                           help='Verify python-escpos code against ESC-POS bytes')
    verify_parser.add_argument('input', help='Input ESC-POS file')
    verify_parser.add_argument('-c', '--code', required=True,
                                help='Python code file to verify')
    verify_parser.add_argument('--strict', action='store_true',
                                help='Use strict byte-for-byte verification (default: semantic)')
    verify_parser.set_defaults(func=verify_command)

    # Parse command
    parse_parser = subparsers.add_parser('parse',
                                          help='Parse and display ESC-POS commands')
    parse_parser.add_argument('input', help='Input ESC-POS file')
    parse_parser.add_argument('--show-bytes', action='store_true',
                               help='Show raw bytes for each command')
    parse_parser.set_defaults(func=parse_command)

    # Parse arguments
    args = parser.parse_args()

    # Setup logging
    setup_logging(args.verbose)

    # Execute command
    return args.func(args)


if __name__ == '__main__':
    sys.exit(main())
