/**
 * @license
 * Copyright 2025 MuleRun
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type GroundedToolCall,
  BaseGroundableTool,
} from './groundable-tool.js';

export interface ComputerWaitArgs {
  time: number;
}

export class ComputerWait extends BaseGroundableTool<ComputerWaitArgs> {
  readonly functionDeclaration = {
    name: 'computer_wait',
    parametersJsonSchema: {
      properties: {
        time: {
          description: 'The amount of time to wait in seconds',
          type: 'number',
        },
      },
      required: ['time'],
      type: 'object',
    },
  };

  async ground(
    args: ComputerWaitArgs,
    _screenshot: unknown,
    _croppedScreenshotParts: unknown,
    _detectElement: unknown,
  ): Promise<GroundedToolCall> {
    async function getDescription(
      _saveImage: (imageBuffer: Buffer, nameSuffix: string) => Promise<string>,
    ): Promise<({ text: string } | { imageFileName: string })[]> {
      return [{ text: `Wait ${args.time} seconds` }];
    }

    function value() {
      return {
        name: '.computer',
        args: {
          action: 'wait',
          time: args.time,
        },
      };
    }

    return { getDescription, value };
  }
}
