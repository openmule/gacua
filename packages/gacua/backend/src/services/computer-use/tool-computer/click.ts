/**
 * @license
 * Copyright 2025 MuleRun
 * SPDX-License-Identifier: Apache-2.0
 */

import type { FunctionDeclaration, Part } from '@google/genai';
import {
  type GroundedToolCall,
  BaseGroundableTool,
} from './groundable-tool.js';
import { type Box, type Image, highlightBox } from '../screen.js';
import { logger } from '../../../logger.js';

const clickToolLogger = logger.child({ module: 'computer-click-tool' });

interface ComputerClickArgs {
  image_id: number;
  element_description: string;
  num_clicks?: number;
  button_type?: 'left' | 'middle' | 'right';
  hold_keys?: string[];
}

export class ComputerClick extends BaseGroundableTool<ComputerClickArgs> {
  readonly functionDeclaration: FunctionDeclaration = {
    name: 'computer_click',
    parametersJsonSchema: {
      properties: {
        image_id: {
          description:
            'The index of the image in the cropped screenshots that contains the element to click on.',
          type: 'number',
          minimum: 0,
        },
        element_description: {
          description:
            'A precise and unambiguous description of the target UI element to click on. Include its text or icon, and if multiple similar elements exist, add positional details.',
          type: 'string',
        },
        num_clicks: {
          description:
            'Number of times to click the element. Use 2 for double-click to open files or applications in many contexts.',
          type: 'number',
          default: 1,
        },
        button_type: {
          description:
            'Which mouse button to press can be "left", "middle", or "right"',
          type: 'string',
          enum: ['left', 'middle', 'right'],
          default: 'left',
        },
        hold_keys: {
          description: 'List of keys to hold while clicking',
          type: 'array',
          items: {
            type: 'string',
          },
          default: [],
        },
      },
      required: ['image_id', 'element_description'],
      type: 'object',
    },
  };

  async ground(
    args: ComputerClickArgs,
    screenshot: Image,
    croppedScreenshotParts: { imagePart: Part }[],
    detectElement: (
      imagePart: Part,
      elementDescription: string,
    ) => Promise<Box>,
  ): Promise<GroundedToolCall | string> {
    clickToolLogger.debug(
      {
        imageId: args.image_id,
        elementDescription: args.element_description,
        numClicks: args.num_clicks,
        buttonType: args.button_type,
        holdKeys: args.hold_keys,
      },
      'Grounding click action',
    );

    const result = await this.detectAndTransform(
      args.image_id,
      croppedScreenshotParts,
      async (imagePart) =>
        detectElement(imagePart, 'Click on: ' + args.element_description),
    );
    if (typeof result === 'string') {
      clickToolLogger.warn({ error: result }, 'Failed to ground click action');
      return result;
    }
    const { indexAndBox, screenCoordinate: screenCoords } = result;

    clickToolLogger.debug(
      {
        screenCoords,
        boundingBox: indexAndBox,
      },
      'Click action grounded successfully',
    );

    async function getDescription(
      saveImage: (imageBuffer: Buffer, nameSuffix: string) => Promise<string>,
    ): Promise<({ text: string } | { imageFileName: string })[]> {
      let action = '';
      const buttonType = args.button_type || 'left';
      const numClicks = args.num_clicks || 1;
      if (numClicks === 2 && buttonType === 'left') {
        action = 'Double click';
      } else if (numClicks === 2) {
        action = `Double ${buttonType} click`;
      } else if (numClicks > 1) {
        action = `${buttonType === 'left' ? 'Click' : `${buttonType} click`} ${numClicks} times`;
      } else {
        action = buttonType === 'left' ? 'Click' : `${buttonType} click`;
      }

      let description = `${action} on here`;
      if (args.hold_keys && args.hold_keys.length > 0) {
        description += ` while holding ${args.hold_keys.join(' + ')}`;
      }
      description += ':';

      const annotatedImage = await highlightBox(screenshot, indexAndBox);
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
          action: 'click',
          coordinate: [screenCoords.x, screenCoords.y],
          num_clicks: args.num_clicks,
          button_type: args.button_type,
          hold_keys: args.hold_keys,
        },
      };
    }

    return { getDescription, value };
  }
}
