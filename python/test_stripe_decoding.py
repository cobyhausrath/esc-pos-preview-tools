#!/usr/bin/env python3
"""
Test script to decode ESC * bit image with different stripe interleaving strategies.

Run this with: python3 test_stripe_decoding.py <input.bin>
"""

import sys


def extract_bit_images(data):
    """Extract all ESC * sequences from binary data"""
    sequences = []
    i = 0

    while i < len(data) - 5:
        if data[i] == 0x1B and data[i + 1] == 0x2A:  # ESC *
            mode = data[i + 2]
            nL = data[i + 3]
            nH = data[i + 4]

            width = nL + nH * 256

            # Determine bytes per column based on mode
            if mode in [32, 33]:
                bytes_per_col = 3  # 24 dots
            elif mode in [2, 3]:
                bytes_per_col = 2  # 16 dots
            elif mode in [0, 1]:
                bytes_per_col = 1  # 8 dots
            else:
                i += 1
                continue

            data_size = width * bytes_per_col
            if i + 5 + data_size > len(data):
                break

            image_data = data[i + 5 : i + 5 + data_size]

            sequences.append({
                'mode': mode,
                'width': width,
                'height': bytes_per_col * 8,
                'bytes_per_col': bytes_per_col,
                'data': image_data,
                'offset': i
            })

            i += 5 + data_size
        else:
            i += 1

    return sequences


def print_hex_sample(data, label, max_bytes=48):
    """Print hex dump of data sample"""
    print(f"\n{label}:")
    for i in range(0, min(len(data), max_bytes), 16):
        hex_str = ' '.join(f'{b:02X}' for b in data[i:i+16])
        print(f"  {i:04X}: {hex_str}")
    if len(data) > max_bytes:
        print(f"  ... ({len(data)} bytes total)")


def test_interleaving_strategies(sequences):
    """Test different ways to interleave sequential bit image stripes"""

    if not sequences:
        print("No bit image sequences found")
        return

    print(f"\nFound {len(sequences)} bit image sequences:")
    for i, seq in enumerate(sequences):
        print(f"  {i}: Mode {seq['mode']}, {seq['width']}x{seq['height']}, "
              f"{len(seq['data'])} bytes at offset {seq['offset']:04X}")

    # Group sequential stripes with same width/mode
    groups = []
    current_group = [sequences[0]]

    for i in range(1, len(sequences)):
        prev = current_group[-1]
        curr = sequences[i]

        # Check if this continues the current group
        if (curr['width'] == prev['width'] and
            curr['mode'] == prev['mode'] and
            curr['offset'] - prev['offset'] < 1000):  # Reasonably close
            current_group.append(curr)
        else:
            groups.append(current_group)
            current_group = [curr]

    groups.append(current_group)

    print(f"\nGrouped into {len(groups)} stripe set(s):")
    for i, group in enumerate(groups):
        total_height = len(group) * group[0]['height']
        print(f"  Group {i}: {len(group)} stripes, "
              f"{group[0]['width']}x{total_height} combined")

    # Test each group
    for group_idx, group in enumerate(groups):
        if len(group) == 1:
            print(f"\nGroup {group_idx}: Single stripe, no interleaving needed")
            continue

        print(f"\n{'='*60}")
        print(f"Testing Group {group_idx}: {len(group)} stripes")
        print(f"{'='*60}")

        width = group[0]['width']
        bytes_per_stripe_col = group[0]['bytes_per_col']
        total_bytes_per_col = bytes_per_stripe_col * len(group)

        print(f"Width: {width} columns")
        print(f"Bytes per column per stripe: {bytes_per_stripe_col}")
        print(f"Total bytes per column: {total_bytes_per_col}")

        stripe_data_list = [seq['data'] for seq in group]

        # Strategy A: Current (vertical concatenation)
        print("\n--- Strategy A: Vertical Concatenation (Current) ---")
        combined_a = bytearray()
        for col in range(width):
            for stripe_data in stripe_data_list:
                offset = col * bytes_per_stripe_col
                col_bytes = stripe_data[offset:offset + bytes_per_stripe_col]
                combined_a.extend(col_bytes)

        print(f"Combined size: {len(combined_a)} bytes")
        print_hex_sample(combined_a, "First 3 columns (Strategy A)", 3 * total_bytes_per_col)

        # Strategy B: Byte-level interleaving
        print("\n--- Strategy B: Byte-Level Interleaving ---")
        combined_b = bytearray()
        for col in range(width):
            for byte_idx in range(bytes_per_stripe_col):
                for stripe_data in stripe_data_list:
                    offset = col * bytes_per_stripe_col + byte_idx
                    combined_b.append(stripe_data[offset])

        print(f"Combined size: {len(combined_b)} bytes")
        print_hex_sample(combined_b, "First 3 columns (Strategy B)", 3 * total_bytes_per_col)

        # Strategy C: Sequential (no interleaving)
        print("\n--- Strategy C: Sequential (No Interleaving) ---")
        combined_c = bytearray()
        for stripe_data in stripe_data_list:
            combined_c.extend(stripe_data)

        print(f"Combined size: {len(combined_c)} bytes")
        print_hex_sample(combined_c, "First stripe data (Strategy C)", 48)

        # Strategy D: Reverse stripe order
        print("\n--- Strategy D: Reverse Stripe Order ---")
        combined_d = bytearray()
        for col in range(width):
            for stripe_data in reversed(stripe_data_list):
                offset = col * bytes_per_stripe_col
                col_bytes = stripe_data[offset:offset + bytes_per_stripe_col]
                combined_d.extend(col_bytes)

        print(f"Combined size: {len(combined_d)} bytes")
        print_hex_sample(combined_d, "First 3 columns (Strategy D)", 3 * total_bytes_per_col)

        # Compare first column across strategies
        print("\n--- Column 0 Comparison ---")
        print(f"Strategy A: {' '.join(f'{b:02X}' for b in combined_a[0:total_bytes_per_col])}")
        print(f"Strategy B: {' '.join(f'{b:02X}' for b in combined_b[0:total_bytes_per_col])}")
        print(f"Strategy D: {' '.join(f'{b:02X}' for b in combined_d[0:total_bytes_per_col])}")

        # Show individual stripe bytes for column 0
        print("\n--- Individual Stripes for Column 0 ---")
        for i, stripe_data in enumerate(stripe_data_list):
            col0_bytes = stripe_data[0:bytes_per_stripe_col]
            print(f"Stripe {i}: {' '.join(f'{b:02X}' for b in col0_bytes)}")


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 test_stripe_decoding.py <input.bin>")
        print("\nThis script extracts ESC * bit image sequences and tests")
        print("different strategies for interleaving sequential stripes.")
        sys.exit(1)

    with open(sys.argv[1], 'rb') as f:
        data = f.read()

    sequences = extract_bit_images(data)
    test_interleaving_strategies(sequences)
