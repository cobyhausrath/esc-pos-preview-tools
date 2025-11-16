#!/usr/bin/env python3
"""
Test script for Netum 80-V-UL thermal printer image printing.

This script connects directly to the printer via network and prints a test image
to verify that python-escpos can print continuous images without gaps.

Requirements:
    pip install python-escpos pillow

Usage:
    python3 test-netum-image.py
"""

from escpos.printer import Network
from PIL import Image, ImageDraw, ImageFont
import sys

# Printer configuration
PRINTER_IP = "192.168.1.100"
PRINTER_PORT = 9100
PRINTER_PROFILE = "NT-80-V-UL"  # Netum 80-V-UL (203 DPI, 576px width)

def create_test_image(width=384, height=200):
    """
    Create a test image with clear visual markers to detect gaps.

    Args:
        width: Image width in pixels (default 384 for 80mm at 203 DPI)
        height: Image height in pixels

    Returns:
        PIL Image object
    """
    # Create white image
    img = Image.new('RGB', (width, height), 'white')
    draw = ImageDraw.Draw(img)

    # Draw horizontal lines every 24 pixels (one image strip at 203 DPI)
    # If there are gaps, these lines will be broken
    for y in range(0, height, 24):
        draw.line([(0, y), (width-1, y)], fill='black', width=2)
        # Add strip number labels
        if y > 0:
            draw.text((10, y - 20), f'Strip {y//24}', fill='black')

    # Draw vertical lines to make gaps more obvious
    for x in range(0, width, 50):
        draw.line([(x, 0), (x, height-1)], fill='black', width=1)

    # Draw border
    draw.rectangle([(0, 0), (width-1, height-1)], outline='black', width=2)

    # Add title
    draw.text((width//2 - 100, 10), 'Netum 80-V-UL Test', fill='black')
    draw.text((width//2 - 120, 30), 'Continuous Image Test', fill='black')

    return img

def test_printer_direct():
    """Test printing directly to the Netum printer."""

    print(f"Connecting to Netum 80-V-UL at {PRINTER_IP}:{PRINTER_PORT}...")

    try:
        # Create Network printer with NT-80-V-UL profile
        p = Network(
            host=PRINTER_IP,
            port=PRINTER_PORT,
            profile=PRINTER_PROFILE
        )

        print(f"✓ Connected successfully")
        print(f"✓ Using profile: {PRINTER_PROFILE}")
        print(f"  - DPI: {p.profile.profile_data.get('media', {}).get('dpi', 'unknown')}")
        print(f"  - Width: {p.profile.profile_data.get('media', {}).get('width', {}).get('pixels', 'unknown')} pixels")

        # Create test image
        print("\nCreating test image...")
        img = create_test_image(width=384, height=200)

        # Save image for reference
        img_path = '/tmp/netum_test_image.png'
        img.save(img_path)
        print(f"✓ Test image saved to: {img_path}")

        # Test all three image implementations
        implementations = [
            ('bitImageColumn', 'ESC * column format'),
            ('bitImageRaster', 'GS v 0 raster format'),
            ('graphics', 'GS ( L graphics format'),
        ]

        for impl, desc in implementations:
            print(f"\n{'='*60}")
            print(f"Testing implementation: {impl}")
            print(f"Description: {desc}")
            print(f"{'='*60}")

            p.set(align='center')
            p.text("=" * 48 + "\n")
            p.text(f"TEST: {impl}\n")
            p.text(f"{desc}\n")
            p.text("=" * 48 + "\n\n")

            try:
                p.image(img, impl=impl)
                print(f"✓ {impl} sent successfully")
            except Exception as e:
                print(f"✗ {impl} failed: {e}")
                p.text(f"ERROR: {impl} failed\n")

            p.text("\n")
            p.text("Check for gaps between\n")
            p.text("horizontal lines\n")
            p.text("=" * 48 + "\n\n\n")

        # Cut paper
        p.cut()

        print("\n✓ All tests sent successfully")
        print("\nCheck the printed output:")
        print("  - Compare all 3 implementations")
        print("  - Look for the one with NO gaps between horizontal lines")
        print("  - That's the implementation we should use")

        # Close connection
        p.close()
        print("\n✓ Connection closed")

    except Exception as e:
        print(f"\n✗ Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

def test_printer_with_raw_output():
    """Test and show raw ESC-POS bytes generated."""

    print(f"\nGenerating raw ESC-POS bytes with Dummy printer...")

    from escpos.printer import Dummy

    # Create test image
    img = create_test_image(width=384, height=200)

    # Test each implementation
    implementations = ['bitImageColumn', 'bitImageRaster', 'graphics']

    for impl in implementations:
        print(f"\n{'='*60}")
        print(f"Testing implementation: {impl}")
        print(f"{'='*60}")

        # Create fresh Dummy printer with same profile
        p = Dummy(profile=PRINTER_PROFILE)

        print(f"✓ Using profile: {PRINTER_PROFILE}")

        # Generate ESC-POS
        p.set(align='center')
        p.text(f"{impl} TEST\n\n")
        try:
            p.image(img, impl=impl)
        except Exception as e:
            print(f"✗ {impl} failed: {e}")
            continue
        p.text("\n")

        # Get raw bytes
        raw_bytes = p.output

        print(f"✓ Generated {len(raw_bytes)} bytes")

        # Show first 200 bytes in hex
        print(f"\nFirst 200 bytes (hex):")
        hex_output = ' '.join(f'{b:02X}' for b in raw_bytes[:200])
        print(hex_output)

        # Look for ESC 3 commands (line spacing)
        print(f"\nSearching for ESC 3 (line spacing) commands...")
        i = 0
        esc3_count = 0
        while i < len(raw_bytes) - 1:
            if raw_bytes[i] == 0x1B and raw_bytes[i+1] == 0x33:  # ESC 3
                if i + 2 < len(raw_bytes):
                    spacing = raw_bytes[i+2]
                    print(f"  Offset {i:5d}: ESC 3 {spacing} (line spacing = {spacing}/180 inch = {spacing/180*203.2:.1f} dots at 203 DPI)")
                    esc3_count += 1
                i += 3
            else:
                i += 1

        print(f"Total ESC 3 commands found: {esc3_count}")

        # Look for ESC 2 commands (reset to default line spacing)
        print(f"\nSearching for ESC 2 (reset line spacing) commands...")
        i = 0
        esc2_count = 0
        while i < len(raw_bytes) - 1:
            if raw_bytes[i] == 0x1B and raw_bytes[i+1] == 0x32:  # ESC 2
                print(f"  Offset {i:5d}: ESC 2 (reset to default line spacing)")
                esc2_count += 1
                i += 2
            else:
                i += 1

        print(f"Total ESC 2 commands found: {esc2_count}")

        # Save raw bytes for inspection
        raw_path = f'/tmp/netum_test_{impl}.bin'
        with open(raw_path, 'wb') as f:
            f.write(raw_bytes)
        print(f"✓ Raw bytes saved to: {raw_path}")

    return None  # We generated multiple outputs

if __name__ == '__main__':
    print("=" * 60)
    print("Netum 80-V-UL Thermal Printer Image Test")
    print("=" * 60)

    # First, show what python-escpos generates
    raw_bytes = test_printer_with_raw_output()

    print("\n" + "=" * 60)
    input("\nPress ENTER to send test print to printer (or Ctrl+C to cancel)...")

    # Then actually print to the physical printer
    test_printer_direct()

    print("\n" + "=" * 60)
    print("Test complete!")
    print("=" * 60)
