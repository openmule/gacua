/**
 * @license
 * Copyright 2025 MuleRun
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type GroundedToolCall,
  BaseGroundableTool,
} from './groundable-tool.js';

export interface ComputerKeyArgs {
  keys: string[];
  hold_duration?: number;
}

export class ComputerKey extends BaseGroundableTool<ComputerKeyArgs> {
  readonly functionDeclaration = {
    name: 'computer_key',
    parametersJsonSchema: {
      properties: {
        keys: {
          description: 'List of keys to press or hold.',
          type: 'array',
          items: {
            description: 'Key name does not contain spaces.',
            type: 'string',
          },
        },
        hold_duration: {
          description:
            'The duration to hold the keys in seconds. Optional if only pressing keys.',
          type: 'number',
          minimum: 0,
        },
      },
      required: ['keys'],
      type: 'object',
    },
  };

  async ground(
    args: ComputerKeyArgs,
    _screenshot: unknown,
    _croppedScreenshotParts: unknown,
    _detectElement: unknown,
  ): Promise<GroundedToolCall> {
    async function getDescription(
      _saveImage: (imageBuffer: Buffer, nameSuffix: string) => Promise<string>,
    ): Promise<({ text: string } | { imageFileName: string })[]> {
      let description = '';

      if (args.hold_duration && args.hold_duration > 0) {
        description = `Hold ${args.keys.join(' + ')} for ${args.hold_duration} seconds`;
      } else {
        description = `Press ${args.keys.join(' + ')}`;
      }

      return [{ text: description }];
    }

    function value() {
      return {
        name: '.computer',
        args: {
          action: 'key',
          keys: args.keys,
          hold_duration: args.hold_duration,
        },
      };
    }

    return { getDescription, value };
  }
}
