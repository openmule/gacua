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
import { type Box, type Image, highlightConnectedBoxes } from '../screen.js';

export interface ComputerDragAndDropArgs {
  starting_image_id: number;
  starting_description: string;
  ending_image_id: number;
  ending_description: string;
  hold_keys?: string[];
}

export class ComputerDragAndDrop extends BaseGroundableTool<ComputerDragAndDropArgs> {
  readonly functionDeclaration = {
    name: 'computer_drag_and_drop',
    parametersJsonSchema: {
      properties: {
        starting_image_id: {
          description:
            'The index of the image in the cropped screenshots that contains the element to start the drag action.',
          type: 'number',
          minimum: 0,
        },
        starting_description: {
          description:
            'A precise and unambiguous description of the target UI element to drag from. Include its text or icon, and if multiple similar elements exist, add positional details.',
          type: 'string',
        },
        ending_image_id: {
          description:
            'The index of the image in the cropped screenshots that contains the element to end the drag action.',
          type: 'number',
          minimum: 0,
        },
        ending_description: {
          description:
            'A precise and unambiguous description of the target UI element to drag to. Include its text or icon, and if multiple similar elements exist, add positional details.',
          type: 'string',
        },
        hold_keys: {
          description: 'List of keys to hold while dragging',
          type: 'array',
          items: {
            type: 'string',
          },
          default: [],
        },
      },
      required: [
        'starting_image_id',
        'starting_description',
        'ending_image_id',
        'ending_description',
      ],
      type: 'object',
    },
  };

  async ground(
    args: ComputerDragAndDropArgs,
    screenshot: Image,
    croppedScreenshotParts: { imagePart: Part }[],
    detectElement: (
      imagePart: Part,
      elementDescription: string,
    ) => Promise<Box>,
  ): Promise<GroundedToolCall | string> {
    const startingResult = await this.detectAndTransform(
      args.starting_image_id,
      croppedScreenshotParts,
      async (imagePart) =>
        detectElement(imagePart, 'Drag from: ' + args.starting_description),
    );
    if (typeof startingResult === 'string') {
      return startingResult;
    }
    const {
      indexAndBox: startingIndexAndBox,
      screenCoordinate: startingScreenCoordinate,
    } = startingResult;

    const endingResult = await this.detectAndTransform(
      args.ending_image_id,
      croppedScreenshotParts,
      async (imagePart) =>
        detectElement(imagePart, 'Drag to: ' + args.ending_description),
    );
    if (typeof endingResult === 'string') {
      return endingResult;
    }
    const {
      indexAndBox: endingIndexAndBox,
      screenCoordinate: endingScreenCoordinate,
    } = endingResult;

    async function getDescription(
      saveImage: (imageBuffer: Buffer, nameSuffix: string) => Promise<string>,
    ): Promise<({ text: string } | { imageFileName: string })[]> {
      let description = 'Drag and drop from here to there';
      if (args.hold_keys && args.hold_keys.length > 0) {
        description += ` while holding ${args.hold_keys.join(' + ')}`;
      }
      description += ':';

      const annotatedImage = await highlightConnectedBoxes(
        screenshot,
        startingIndexAndBox,
        endingIndexAndBox,
      );
      const annotatedImageFileName = await saveImage(
        annotatedImage.buffer,
        'screenshot_annotated',
      );

      return [{ text: description }, { imageFileName: annotatedImageFileName }];
    }

    function value() {
      return {
        name: '.computer',
        args: {
          action: 'drag_and_drop',
          coordinate: [startingScreenCoordinate.x, startingScreenCoordinate.y],
          target_coordinate: [
            endingScreenCoordinate.x,
            endingScreenCoordinate.y,
          ],
          hold_keys: args.hold_keys,
        },
      };
    }

    return { getDescription, value };
  }
}
