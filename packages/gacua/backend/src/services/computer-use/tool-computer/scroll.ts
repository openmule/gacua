/**
 * @license
 * Copyright 2025 MuleRun
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Part } from '@google/genai';
import {
  type GroundedToolCall,
  BaseGroundableTool,
} from './groundable-tool.js';
import type { Coordinate, Box, IndexAndBox, Image } from '../screen.js';

export interface ComputerScrollArgs {
  image_id?: number;
  element_description?: string;
  clicks: number;
  shift?: boolean;
}

export class ComputerScroll extends BaseGroundableTool<ComputerScrollArgs> {
  readonly functionDeclaration = {
    name: 'computer_scroll',
    parametersJsonSchema: {
      properties: {
        image_id: {
          description:
            'The index of the image in the cropped screenshots that contains the element to scroll in.',
          type: 'number',
          minimum: 0,
        },
        element_description: {
          description:
            'A precise and unambiguous description of the target UI element to scroll in. Include its text or icon, and if multiple similar elements exist, add positional details.',
          type: 'string',
        },
        clicks: {
          description:
            'The number of clicks to scroll can be positive (up) or negative (down).',
          type: 'number',
        },
        shift: {
          description: 'Whether to use shift+scroll for horizontal scrolling',
          type: 'boolean',
          default: false,
        },
      },
      required: ['clicks'],
      type: 'object',
    },
  };

  override validate(args: ComputerScrollArgs): string | null {
    return this.validateImageElementPair(args);
  }

  async ground(
    args: ComputerScrollArgs,
    screenshot: Image,
    croppedScreenshotParts: { imagePart: Part }[],
    detectElement: (
      imagePart: Part,
      elementDescription: string,
    ) => Promise<Box>,
  ): Promise<GroundedToolCall | string> {
    let indexAndBox: IndexAndBox | undefined;
    let screenCoordinate: Coordinate | undefined;

    if (args.image_id !== undefined && args.element_description !== undefined) {
      const result = await this.detectAndTransform(
        args.image_id,
        croppedScreenshotParts,
        async (imagePart) =>
          detectElement(
            imagePart,
            'Hover on here to scroll: ' + args.element_description,
          ),
      );
      if (typeof result === 'string') {
        return result;
      }
      indexAndBox = result.indexAndBox;
      screenCoordinate = result.screenCoordinate;
    }

    async function getDescription(
      saveImage: (imageBuffer: Buffer, nameSuffix: string) => Promise<string>,
    ): Promise<({ text: string } | { imageFileName: string })[]> {
      const clicks = args.clicks;
      const amount = Math.abs(clicks);

      let description = '';
      if (args.shift) {
        const direction = clicks > 0 ? 'left' : 'right';
        description = `Scroll ${direction}`;
      } else {
        const direction = clicks > 0 ? 'up' : 'down';
        description = `Scroll ${direction}`;
      }

      if (amount !== 1) {
        description += ` ${amount} clicks`;
      }

      if (indexAndBox && screenCoordinate) {
        description += ' in here:';
        const { highlightBox } = await import('../screen.js');
        const annotatedImage = await highlightBox(screenshot, indexAndBox);
        const annotatedImageFileName = await saveImage(
          annotatedImage.buffer,
          'screenshot_annotated',
        );
        return [
          { text: description },
          { imageFileName: annotatedImageFileName },
        ];
      } else {
        description += ' in the currently active area';
        return [{ text: description }];
      }
    }

    function value() {
      return {
        name: '.computer',
        args: {
          action: 'scroll',
          coordinate: screenCoordinate
            ? [screenCoordinate.x, screenCoordinate.y]
            : undefined,
          clicks: args.clicks,
          shift: args.shift,
        },
      };
    }

    return { getDescription, value };
  }
}
