/**
 * Index of all demo examples
 */

import * as basicFormatting from './01-basic-formatting';
import * as receipt from './02-receipt';
import * as textSizes from './03-text-sizes';
import * as combinedFormatting from './04-combined-formatting';

export interface DemoExample {
  title: string;
  description: string;
  pythonCode: string;
  escPosBytes: Uint8Array;
}

export const examples: DemoExample[] = [
  {
    title: basicFormatting.title,
    description: basicFormatting.description,
    pythonCode: basicFormatting.pythonCode,
    escPosBytes: basicFormatting.escPosBytes,
  },
  {
    title: receipt.title,
    description: receipt.description,
    pythonCode: receipt.pythonCode,
    escPosBytes: receipt.escPosBytes,
  },
  {
    title: textSizes.title,
    description: textSizes.description,
    pythonCode: textSizes.pythonCode,
    escPosBytes: textSizes.escPosBytes,
  },
  {
    title: combinedFormatting.title,
    description: combinedFormatting.description,
    pythonCode: combinedFormatting.pythonCode,
    escPosBytes: combinedFormatting.escPosBytes,
  },
];
