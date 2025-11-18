#!/usr/bin/env python3
"""
Diagnostic script to visualize bit patterns in ESC * data.
Shows the actual bit patterns to help debug decoding issues.
"""

import sys


def visualize_byte(byte_val):
    """Convert a byte to visual representation (0=white, 1=black)"""
    bits = []
    for bit in range(8):
        if byte_val & (1 << bit):
            bits.append('█')  # Black
        else:
            bits.append('░')  # White
    return bits


def visualize_byte_reversed(byte_val):
    """Byte visualization with reversed bit order"""
    bits = []
    for bit in range(7, -1, -1):
        if byte_val & (1 << bit):
            bits.append('█')
        else:
            bits.append('░')
    return bits


def visualize_column(bytes_list, strategy='lsb_top'):
    """
    Visualize a column of bytes as vertical pixels.

    Args:
        bytes_list: List of bytes for this column
        strategy: 'lsb_top' (bit 0 = top) or 'msb_top' (bit 7 = top)
    """
    print("    Bit position:")
    if strategy == 'lsb_top':
        print("    0→7 (LSB→MSB)")
    else:
        print("    7→0 (MSB→LSB)")

    for i, byte_val in enumerate(bytes_list):
        if strategy == 'lsb_top':
            bits = visualize_byte(byte_val)
        else:
            bits = visualize_byte_reversed(byte_val)

        print(f"  B{i:2d} (0x{byte_val:02X}): {' '.join(bits)}")


def analyze_stripe_file(filename):
    """Analyze a bin file containing ESC * sequences"""

    with open(filename, 'rb') as f:
        data = f.read()

    print(f"File: {filename}")
    print(f"Size: {len(data)} bytes\n")

    # Find ESC * sequences
    sequences = []
    i = 0
    while i < len(data) - 5:
        if data[i] == 0x1B and data[i + 1] == 0x2A:
            mode = data[i + 2]
            nL = data[i + 3]
            nH = data[i + 4]
            width = nL + nH * 256

            if mode in [32, 33]:
                bytes_per_col = 3
            elif mode in [2, 3]:
                bytes_per_col = 2
            elif mode in [0, 1]:
                bytes_per_col = 1
            else:
                i += 1
                continue

            data_size = width * bytes_per_col
            if i + 5 + data_size > len(data):
                break

            sequences.append({
                'offset': i,
                'mode': mode,
                'width': width,
                'bytes_per_col': bytes_per_col,
                'data': data[i + 5 : i + 5 + data_size]
            })

            i += 5 + data_size
        else:
            i += 1

    if not sequences:
        print("No ESC * sequences found")
        return

    print(f"Found {len(sequences)} ESC * sequence(s):\n")

    for idx, seq in enumerate(sequences):
        print(f"Sequence {idx}:")
        print(f"  Offset: 0x{seq['offset']:04X}")
        print(f"  Mode: {seq['mode']}")
        print(f"  Width: {seq['width']} columns")
        print(f"  Bytes/col: {seq['bytes_per_col']}")
        print(f"  Data size: {len(seq['data'])} bytes")
        print()

    # Visualize first few columns of first sequence
    if sequences:
        seq = sequences[0]
        print(f"\n{'='*60}")
        print("Visualizing first 3 columns of first sequence")
        print(f"{'='*60}\n")

        bytes_per_col = seq['bytes_per_col']

        for col in range(min(3, seq['width'])):
            offset = col * bytes_per_col
            col_bytes = seq['data'][offset : offset + bytes_per_col]

            print(f"Column {col}:")
            print("\n  Strategy 1: LSB (bit 0) = top pixel")
            visualize_column(col_bytes, 'lsb_top')

            print("\n  Strategy 2: MSB (bit 7) = top pixel")
            visualize_column(col_bytes, 'msb_top')
            print()

    # If multiple sequences, show how stripes would be combined
    if len(sequences) > 1:
        # Check if they're sequential stripes
        first = sequences[0]
        all_same = all(s['width'] == first['width'] and
                       s['mode'] == first['mode']
                       for s in sequences)

        if all_same:
            print(f"\n{'='*60}")
            print(f"All {len(sequences)} sequences have same width/mode")
            print("Likely sequential stripes of a tall image")
            print(f"{'='*60}\n")

            print("Combined image dimensions:")
            total_height = len(sequences) * (first['bytes_per_col'] * 8)
            print(f"  Width: {first['width']} columns")
            print(f"  Height: {total_height} pixels ({len(sequences)} stripes × {first['bytes_per_col']*8} pixels)")
            print(f"  Total bytes per column: {len(sequences) * first['bytes_per_col']}")
            print()

            # Show how column 0 would be combined
            print("Column 0 combined (Strategy A: Vertical concatenation):")
            for stripe_idx, seq in enumerate(sequences):
                col_bytes = seq['data'][0:first['bytes_per_col']]
                print(f"\n  Stripe {stripe_idx} contribution:")
                print(f"    Bytes: {' '.join(f'{b:02X}' for b in col_bytes)}")
                for i, b in enumerate(col_bytes):
                    bits_lsb = visualize_byte(b)
                    print(f"    B{i} (0x{b:02X}): {' '.join(bits_lsb)}  [LSB=top]")

            # Show alternative: byte-level interleaving
            print("\n  Alternative (Strategy B: Byte-level interleaving):")
            for byte_idx in range(first['bytes_per_col']):
                print(f"\n    Byte position {byte_idx}:")
                for stripe_idx, seq in enumerate(sequences):
                    b = seq['data'][byte_idx]
                    bits = visualize_byte(b)
                    print(f"      Stripe {stripe_idx}: 0x{b:02X} = {' '.join(bits)}")


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 diagnose_bytes.py <file.bin>")
        print("\nThis script analyzes ESC * bit image data and visualizes")
        print("the byte patterns to help debug decoding issues.")
        print("\nLegend:")
        print("  █ = Black pixel (bit set to 1)")
        print("  ░ = White pixel (bit set to 0)")
        sys.exit(1)

    analyze_stripe_file(sys.argv[1])
