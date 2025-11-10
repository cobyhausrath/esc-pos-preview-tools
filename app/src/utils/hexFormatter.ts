import type { HexStats } from '@/types';

export class HexFormatter {
  static format(bytes: Uint8Array): string {
    const lines: string[] = [];

    for (let i = 0; i < bytes.length; i += 16) {
      const chunk = bytes.slice(i, i + 16);
      const offset = i.toString(16).padStart(8, '0').toUpperCase();
      const hex = Array.from(chunk)
        .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
        .join(' ')
        .padEnd(47, ' ');
      const ascii = Array.from(chunk)
        .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.'))
        .join('');

      lines.push(`${offset}  ${hex}  ${ascii}`);
    }

    return lines.join('\n');
  }

  static getStats(bytes: Uint8Array): HexStats {
    let escCommands = 0;
    let gsCommands = 0;
    const ESC = 0x1b;
    const GS = 0x1d;

    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] === ESC) escCommands++;
      if (bytes[i] === GS) gsCommands++;
    }

    return {
      totalBytes: bytes.length,
      escCommands,
      gsCommands,
    };
  }

  static formatWithStats(bytes: Uint8Array): { hex: string; stats: HexStats } {
    return {
      hex: this.format(bytes),
      stats: this.getStats(bytes),
    };
  }
}
