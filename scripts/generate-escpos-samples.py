#!/usr/bin/env python3
"""
Generate sample ESC-POS commands for testing with Netum 80-V-UL thermal printer
"""

from escpos import printer
import os
import sys


class FilePrinter(printer.File):
    """Custom printer that writes to a file"""
    def __init__(self, filename):
        super().__init__(filename)


def generate_sample_receipt(output_file):
    """Generate a comprehensive sample receipt with various ESC-POS commands"""

    p = FilePrinter(output_file)

    # Initialize printer
    p._raw(b'\x1b\x40')  # ESC @ - Initialize

    # Sample receipt header with centered text
    p.set(align='center', bold=True)
    p.text("THERMAL PRINTER TEST\n")
    p.text("Netum 80-V-UL\n")
    p.set(align='center', bold=False)
    p.text("=" * 48 + "\n")

    # Left-aligned regular text
    p.set(align='left')
    p.text("\n")
    p.text("Order #12345\n")
    p.text("Date: 2025-11-09 14:30:00\n")
    p.text("\n")

    # Test different text sizes
    p.set(align='center', custom_size=True, width=2, height=2)
    p.text("DOUBLE SIZE\n")

    p.set(align='center', custom_size=True, width=1, height=2)
    p.text("TALL TEXT\n")

    p.set(align='center', custom_size=True, width=2, height=1)
    p.text("WIDE TEXT\n")

    # Reset to normal
    p.set(align='left', normal_textsize=True)
    p.text("\n")

    # Bold and underline
    p.set(align='left', bold=True)
    p.text("BOLD TEXT TEST\n")
    p.set(bold=False)

    p.set(underline=1)
    p.text("Underlined text example\n")
    p.set(underline=0)

    p.text("\n")

    # Sample items with alignment
    p.text("ITEMS:\n")
    p.text("-" * 48 + "\n")
    p.text("Item 1                          $10.00\n")
    p.text("Item 2 with a long name         $25.50\n")
    p.text("Item 3                           $5.99\n")
    p.text("-" * 48 + "\n")

    # Right-aligned total
    p.set(align='right', bold=True)
    p.text("TOTAL: $41.49\n")
    p.set(align='left', bold=False)

    p.text("\n")

    # Test special characters
    p.text("Special chars: @#$%^&*()\n")
    p.text("Numbers: 0123456789\n")
    p.text("\n")

    # Footer
    p.set(align='center')
    p.text("Thank you for your purchase!\n")
    p.text("www.example.com\n")
    p.text("\n")

    # Cut paper
    p.cut()

    p.close()


def generate_minimal_sample(output_file):
    """Generate a minimal test case"""

    p = FilePrinter(output_file)

    p._raw(b'\x1b\x40')  # Initialize
    p.text("Hello, World!\n")
    p.text("This is a test.\n")
    p.cut()

    p.close()


def generate_formatting_test(output_file):
    """Generate a test focusing on text formatting"""

    p = FilePrinter(output_file)

    p._raw(b'\x1b\x40')  # Initialize

    # Test all alignment options
    p.set(align='left')
    p.text("LEFT ALIGNED\n")

    p.set(align='center')
    p.text("CENTER ALIGNED\n")

    p.set(align='right')
    p.text("RIGHT ALIGNED\n")

    p.set(align='left')
    p.text("\n")

    # Test bold combinations
    p.set(bold=True)
    p.text("Bold text\n")

    p.set(bold=True, underline=1)
    p.text("Bold + Underline\n")

    p.set(bold=False, underline=1)
    p.text("Normal + Underline\n")

    p.set(bold=False, underline=0)
    p.text("Normal text\n")

    p.text("\n")

    # Test size combinations
    p.set(custom_size=True, width=1, height=1)
    p.text("Normal size\n")

    p.set(custom_size=True, width=2, height=1)
    p.text("Wide\n")

    p.set(custom_size=True, width=1, height=2)
    p.text("Tall\n")

    p.set(custom_size=True, width=2, height=2)
    p.text("Double\n")

    p.cut()
    p.close()


def main():
    """Generate all sample files"""

    # Create samples directory if it doesn't exist
    samples_dir = "samples"
    if not os.path.exists(samples_dir):
        os.makedirs(samples_dir)

    print("Generating ESC-POS sample files...")

    # Generate different test cases
    samples = [
        ("receipt.bin", generate_sample_receipt, "Comprehensive receipt sample"),
        ("minimal.bin", generate_minimal_sample, "Minimal test case"),
        ("formatting.bin", generate_formatting_test, "Text formatting test"),
    ]

    for filename, generator_func, description in samples:
        filepath = os.path.join(samples_dir, filename)
        print(f"  - {filename}: {description}")
        generator_func(filepath)

        # Print hex dump for inspection
        with open(filepath, 'rb') as f:
            data = f.read()
            print(f"    Size: {len(data)} bytes")
            print(f"    First 64 bytes (hex): {data[:64].hex()}")

    print("\n✓ Sample files generated in 'samples/' directory")
    print("\nYou can test these with:")
    print("  node dist/index.js --input samples/receipt.bin --output preview.html")


if __name__ == "__main__":
    main()
