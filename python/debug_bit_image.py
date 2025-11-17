#!/usr/bin/env python3
"""
Debug script for testing ESC * bit image decoding strategies.

This script tests various ways to decode column-major bit image data
to help identify the correct byte and bit ordering.
"""

import base64
from PIL import Image
import io


def decode_strategy_1(width_dots, height_dots, bytes_per_column, data):
    """
    Strategy 1: Bit 0 (LSB) = top pixel, sequential column reading
    This is the current implementation.
    """
    img = Image.new('1', (width_dots, height_dots), 1)
    pixels = img.load()

    data_idx = 0
    for x in range(width_dots):
        for byte_idx in range(bytes_per_column):
            if data_idx >= len(data):
                break
            byte = data[data_idx]
            data_idx += 1

            # Extract 8 vertical pixels from this byte
            # Bit 0 (LSB) = top pixel, bit 7 (MSB) = bottom pixel
            for bit in range(8):
                y = byte_idx * 8 + bit
                if y >= height_dots:
                    break
                pixel_on = (byte & (1 << bit)) != 0
                pixels[x, y] = 0 if pixel_on else 1

    return img


def decode_strategy_2(width_dots, height_dots, bytes_per_column, data):
    """
    Strategy 2: Bit 7 (MSB) = top pixel (inverted bit order)
    """
    img = Image.new('1', (width_dots, height_dots), 1)
    pixels = img.load()

    data_idx = 0
    for x in range(width_dots):
        for byte_idx in range(bytes_per_column):
            if data_idx >= len(data):
                break
            byte = data[data_idx]
            data_idx += 1

            # Bit 7 (MSB) = top pixel, bit 0 (LSB) = bottom pixel
            for bit in range(8):
                y = byte_idx * 8 + bit
                if y >= height_dots:
                    break
                pixel_on = (byte & (1 << (7 - bit))) != 0
                pixels[x, y] = 0 if pixel_on else 1

    return img


def decode_strategy_3(width_dots, height_dots, bytes_per_column, data):
    """
    Strategy 3: Read bytes in reverse order within each column
    """
    img = Image.new('1', (width_dots, height_dots), 1)
    pixels = img.load()

    for x in range(width_dots):
        # Read bytes for this column in reverse order
        for byte_idx in range(bytes_per_column - 1, -1, -1):
            data_idx = x * bytes_per_column + (bytes_per_column - 1 - byte_idx)
            if data_idx >= len(data):
                break
            byte = data[data_idx]

            # Bit 0 (LSB) = top pixel
            actual_byte_idx = bytes_per_column - 1 - byte_idx
            for bit in range(8):
                y = actual_byte_idx * 8 + bit
                if y >= height_dots:
                    break
                pixel_on = (byte & (1 << bit)) != 0
                pixels[x, y] = 0 if pixel_on else 1

    return img


def decode_strategy_4(width_dots, height_dots, bytes_per_column, data):
    """
    Strategy 4: Bit 0 = top, but read bytes within each stripe-section separately
    Assumes data is: all columns for stripe0, then all columns for stripe1, etc.
    """
    img = Image.new('1', (width_dots, height_dots), 1)
    pixels = img.load()

    bytes_per_stripe = 3  # mode 33 = 24 dots = 3 bytes
    num_stripes = bytes_per_column // bytes_per_stripe

    for stripe_idx in range(num_stripes):
        stripe_offset = stripe_idx * width_dots * bytes_per_stripe

        for x in range(width_dots):
            for byte_idx in range(bytes_per_stripe):
                data_idx = stripe_offset + x * bytes_per_stripe + byte_idx
                if data_idx >= len(data):
                    break
                byte = data[data_idx]

                # Y position in the final image
                y_base = stripe_idx * (bytes_per_stripe * 8)

                for bit in range(8):
                    y = y_base + byte_idx * 8 + bit
                    if y >= height_dots:
                        break
                    pixel_on = (byte & (1 << bit)) != 0
                    pixels[x, y] = 0 if pixel_on else 1

    return img


def test_decoding(base64_data, width, height, bytes_per_column):
    """Test all decoding strategies and save outputs"""
    # Decode base64 PNG, extract as bit image bytes
    # For this test, we'll use the actual bit image data from the bin file
    # The user should provide the actual ESC * data bytes

    print(f"Testing decoding for {width}x{height} image, {bytes_per_column} bytes/column")
    print(f"Expected data size: {width * bytes_per_column} bytes")
    print()

    # Load the reference PNG to see what it should look like
    png_data = base64.b64decode(base64_data)
    reference = Image.open(io.BytesIO(png_data))
    reference.save('/tmp/reference.png')
    print("Saved reference image to /tmp/reference.png")
    print()

    # Note: We need actual ESC * binary data to test
    # For now, let's just show the structure
    print("To test decoding, we need the raw ESC * command bytes.")
    print("Please extract them from the .bin file.")


def test_with_actual_data():
    """
    Test with actual ESC * data extracted from a bin file.
    Usage: Replace 'actual_data' with bytes from your bin file.
    """

    # Example: Load from a file
    # with open('image.bin', 'rb') as f:
    #     full_data = f.read()
    #
    # # Find ESC * sequences and extract
    # # Format: 1B 2A 21 80 00 [384 bytes of data]
    # # Mode 33 (0x21), width 128 (0x80 0x00), 384 bytes (128 * 3)

    print("Example of extracting ESC * data from bin file:")
    print()
    print("with open('your_image.bin', 'rb') as f:")
    print("    data = f.read()")
    print()
    print("# Find ESC * sequence (1B 2A)")
    print("idx = data.find(b'\\x1b\\x2a')")
    print()
    print("# Extract mode, width, and image data")
    print("mode = data[idx + 2]")
    print("nL = data[idx + 3]")
    print("nH = data[idx + 4]")
    print("width = nL + nH * 256")
    print()
    print("# For mode 33: 24 dots = 3 bytes per column")
    print("bytes_per_col = 3")
    print("data_size = width * bytes_per_col")
    print("image_data = data[idx + 5 : idx + 5 + data_size]")
    print()
    print("# Test all strategies")
    print("img1 = decode_strategy_1(width, 24, bytes_per_col, image_data)")
    print("img1.save('strategy1.png')")
    print()
    print("img2 = decode_strategy_2(width, 24, bytes_per_col, image_data)")
    print("img2.save('strategy2.png')")
    print()
    print("# etc...")


def analyze_stripe_interleaving():
    """
    Analyze how stripe data should be interleaved for combined images.
    """
    print("=== Stripe Interleaving Analysis ===")
    print()
    print("For a 128x120 image sent as 5 stripes of mode 33 (24-dot):")
    print()
    print("Each stripe:")
    print("  - Width: 128 columns")
    print("  - Height: 24 dots")
    print("  - Bytes per column: 3")
    print("  - Total bytes: 128 * 3 = 384 bytes")
    print()
    print("Stripe layout in bin file:")
    print("  ESC * 33 128 0 [384 bytes] - Stripe 0 (rows 0-23)")
    print("  ESC * 33 128 0 [384 bytes] - Stripe 1 (rows 24-47)")
    print("  ESC * 33 128 0 [384 bytes] - Stripe 2 (rows 48-71)")
    print("  ESC * 33 128 0 [384 bytes] - Stripe 3 (rows 72-95)")
    print("  ESC * 33 128 0 [384 bytes] - Stripe 4 (rows 96-119)")
    print()
    print("Current interleaving strategy:")
    print("  For each column X:")
    print("    - Take bytes stripe0[X*3 : X*3+3]  (rows 0-23)")
    print("    - Take bytes stripe1[X*3 : X*3+3]  (rows 24-47)")
    print("    - Take bytes stripe2[X*3 : X*3+3]  (rows 48-71)")
    print("    - Take bytes stripe3[X*3 : X*3+3]  (rows 72-95)")
    print("    - Take bytes stripe4[X*3 : X*3+3]  (rows 96-119)")
    print("    - Concatenate: 15 bytes for column X")
    print()
    print("Expected combined data:")
    print("  - 128 columns")
    print("  - 15 bytes per column (5 stripes * 3 bytes)")
    print("  - Total: 1920 bytes")
    print()
    print("Alternative interleaving strategies to test:")
    print()
    print("  A) Current (vertical concatenation):")
    print("     col0: s0[0:3] + s1[0:3] + s2[0:3] + s3[0:3] + s4[0:3]")
    print()
    print("  B) Byte-level interleaving:")
    print("     col0: s0[0] + s1[0] + s2[0] + s3[0] + s4[0] +")
    print("           s0[1] + s1[1] + s2[1] + s3[1] + s4[1] +")
    print("           s0[2] + s1[2] + s2[2] + s3[2] + s4[2]")
    print()
    print("  C) No interleaving (sequential):")
    print("     s0_all + s1_all + s2_all + s3_all + s4_all")
    print("     Then read as single tall image")
    print()


if __name__ == '__main__':
    print("ESC * Bit Image Decoding Debug Script")
    print("=" * 50)
    print()

    analyze_stripe_interleaving()
    print()
    print("=" * 50)
    print()
    test_with_actual_data()
    print()
    print("=" * 50)
    print()
    print("To use this script with actual data:")
    print("1. Extract ESC * sequences from your .bin file")
    print("2. Call decode_strategy_X() with the actual bytes")
    print("3. Compare outputs to reference PNG")
    print()
    print("Available decoding strategies:")
    print("  - decode_strategy_1: Bit 0 = top (current)")
    print("  - decode_strategy_2: Bit 7 = top (inverted)")
    print("  - decode_strategy_3: Reverse byte order in column")
    print("  - decode_strategy_4: Stripe-aware decoding")
