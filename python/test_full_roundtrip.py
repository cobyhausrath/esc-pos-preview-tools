#!/usr/bin/env python3
"""
Full roundtrip test: Generate ESC-POS, parse it, decode images.
Tests different bit image decoding strategies.

Requires: pip install python-escpos pillow
"""

import sys
import os

try:
    from escpos.printer import Dummy
    from PIL import Image
    import io
    import base64
except ImportError as e:
    print(f"Error: {e}")
    print("\nPlease install requirements:")
    print("  pip install python-escpos pillow")
    sys.exit(1)

# Import our verifier
sys.path.insert(0, os.path.dirname(__file__))
from escpos_verifier import EscPosVerifier


def create_test_image(width, height, pattern='checkerboard'):
    """Create a test image with a known pattern"""
    img = Image.new('1', (width, height), 1)  # White background
    pixels = img.load()

    if pattern == 'checkerboard':
        # Checkerboard pattern (8x8 squares)
        for y in range(height):
            for x in range(width):
                if ((x // 8) + (y // 8)) % 2 == 0:
                    pixels[x, y] = 0  # Black

    elif pattern == 'horizontal_stripes':
        # Horizontal stripes (8 pixels each)
        for y in range(height):
            for x in range(width):
                if (y // 8) % 2 == 0:
                    pixels[x, y] = 0

    elif pattern == 'vertical_stripes':
        # Vertical stripes (8 pixels each)
        for y in range(height):
            for x in range(width):
                if (x // 8) % 2 == 0:
                    pixels[x, y] = 0

    elif pattern == 'gradient':
        # Vertical gradient (top black, bottom white)
        for y in range(height):
            for x in range(width):
                if y < height // 2:
                    pixels[x, y] = 0

    return img


def decode_bit_image_alt1(width_dots, height_dots, bytes_per_column, data):
    """Alternative decoding: Bit 7 (MSB) = top pixel"""
    img = Image.new('1', (width_dots, height_dots), 1)
    pixels = img.load()

    data_idx = 0
    for x in range(width_dots):
        for byte_idx in range(bytes_per_column):
            if data_idx >= len(data):
                break
            byte = data[data_idx]
            data_idx += 1

            # Bit 7 (MSB) = top pixel
            for bit in range(8):
                y = byte_idx * 8 + bit
                if y >= height_dots:
                    break
                pixel_on = (byte & (1 << (7 - bit))) != 0
                pixels[x, y] = 0 if pixel_on else 1

    return img


def decode_bit_image_alt2(width_dots, height_dots, bytes_per_column, data):
    """Alternative decoding: Inverted pixel values"""
    img = Image.new('1', (width_dots, height_dots), 1)
    pixels = img.load()

    data_idx = 0
    for x in range(width_dots):
        for byte_idx in range(bytes_per_column):
            if data_idx >= len(data):
                break
            byte = data[data_idx]
            data_idx += 1

            for bit in range(8):
                y = byte_idx * 8 + bit
                if y >= height_dots:
                    break
                pixel_on = (byte & (1 << bit)) != 0
                # Inverted: 1 = black, 0 = white
                pixels[x, y] = 1 if pixel_on else 0

    return img


def test_roundtrip(pattern='checkerboard', impl='bitImageColumn'):
    """Test full roundtrip: Image -> ESC-POS -> Parse -> Decode -> Image"""

    print(f"\n{'='*70}")
    print(f"Testing: {pattern} pattern with {impl}")
    print(f"{'='*70}\n")

    # Create test image
    test_img = create_test_image(128, 120, pattern)
    test_img.save(f'/tmp/test_input_{pattern}.png')
    print(f"✓ Created test image: /tmp/test_input_{pattern}.png")

    # Generate ESC-POS using python-escpos
    p = Dummy()
    p.image(test_img, impl=impl)
    escpos_bytes = p.output

    print(f"✓ Generated {len(escpos_bytes)} bytes of ESC-POS data")

    # Parse with verifier
    verifier = EscPosVerifier()
    python_code = verifier.bytes_to_python_escpos(escpos_bytes)

    print(f"✓ Parsed ESC-POS back to Python code")

    # Extract the generated image from verifier's parsed commands
    bit_image_cmds = [cmd for cmd in verifier.commands if cmd.name == 'bit_image']

    if not bit_image_cmds:
        print("✗ No bit image commands found!")
        return False

    print(f"✓ Found {len(bit_image_cmds)} bit image command(s)")

    # If there are multiple (stripes), the verifier should have merged them
    # Check if the last command is a merged one
    last_cmd = verifier.commands[-1]
    if 'merged_stripes' in last_cmd.params:
        print(f"✓ Stripes were merged: {last_cmd.params['merged_stripes']} stripes")
        decoded_img_b64 = last_cmd.params.get('image_base64')
    else:
        # Single stripe
        decoded_img_b64 = bit_image_cmds[0].params.get('image_base64')

    if not decoded_img_b64:
        print("✗ No decoded image found in parsed commands!")
        return False

    # Decode the image
    decoded_img_data = base64.b64decode(decoded_img_b64)
    decoded_img = Image.open(io.BytesIO(decoded_img_data))
    decoded_img.save(f'/tmp/test_output_{pattern}_{impl}.png')

    print(f"✓ Decoded image: {decoded_img.size}")
    print(f"✓ Saved output: /tmp/test_output_{pattern}_{impl}.png")

    # Compare images
    if test_img.size != decoded_img.size:
        print(f"✗ Size mismatch! Input: {test_img.size}, Output: {decoded_img.size}")
        return False

    # Pixel-by-pixel comparison
    pixels_in = test_img.load()
    pixels_out = decoded_img.load()

    differences = 0
    for y in range(test_img.size[1]):
        for x in range(test_img.size[0]):
            if pixels_in[x, y] != pixels_out[x, y]:
                differences += 1

    total_pixels = test_img.size[0] * test_img.size[1]
    accuracy = 100.0 * (total_pixels - differences) / total_pixels

    print(f"\nAccuracy: {accuracy:.2f}% ({differences}/{total_pixels} different pixels)")

    if accuracy == 100.0:
        print("✓ Perfect match!")
        return True
    elif accuracy > 95.0:
        print("~ Close match (might be acceptable)")
        return True
    else:
        print("✗ Significant differences detected")
        return False


if __name__ == '__main__':
    patterns = ['horizontal_stripes', 'vertical_stripes', 'checkerboard', 'gradient']

    print("ESC-POS Bit Image Decoding Test Suite")
    print("=" * 70)

    results = {}

    for pattern in patterns:
        try:
            success = test_roundtrip(pattern, 'bitImageColumn')
            results[pattern] = success
        except Exception as e:
            print(f"\n✗ Test failed with error: {e}")
            import traceback
            traceback.print_exc()
            results[pattern] = False

    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)

    for pattern, success in results.items():
        status = "✓ PASS" if success else "✗ FAIL"
        print(f"{status}: {pattern}")

    print("\nGenerated files in /tmp/:")
    print("  - test_input_*.png (original images)")
    print("  - test_output_*.png (decoded images)")
    print("\nCompare them visually to see the differences.")
