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
import {
  type Coordinate,
  type Box,
  type IndexAndBox,
  type Image,
  highlightBox,
} from '../screen.js';

export interface ComputerTypeArgs {
  text: string;
  image_id?: number;
  element_description?: string;
  overwrite?: boolean;
  enter?: boolean;
}

export class ComputerType extends BaseGroundableTool<ComputerTypeArgs> {
  readonly functionDeclaration = {
    name: 'computer_type',
    parametersJsonSchema: {
      properties: {
        image_id: {
          description:
            'The index of the image in the cropped screenshots that contains the element to enter text in. This is optional if the input box is already focused.',
          type: 'number',
          minimum: 0,
        },
        element_description: {
          description:
            'A precise and unambiguous description of the target UI element to enter text in. Include its text or icon, and if multiple similar elements exist, add positional details.',
          type: 'string',
        },
        text: {
          description: 'The text to type',
          type: 'string',
        },
        overwrite: {
          description:
            'Assign it to True if the text should overwrite the existing text, otherwise assign it to False. Using this argument clears all text in an element.',
          type: 'boolean',
          default: false,
        },
        enter: {
          description:
            'Assign it to True if the enter key should be pressed after typing the text, otherwise assign it to False.',
          type: 'boolean',
          default: false,
        },
      },
      required: ['text'],
      type: 'object',
    },
  };

  override validate(args: unknown): string | null {
    return this.validateImageElementPair(args);
  }

  async ground(
    args: ComputerTypeArgs,
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
            'Click on here to type: ' + args.element_description,
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
      let description = `Type "${args.text}"`;
      if (args.overwrite) {
        description = `Clear existing text and type "${args.text}"`;
      }
      if (args.enter) {
        description += ' and press Enter';
      }

      if (indexAndBox && screenCoordinate) {
        description += ' here:';
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
        description += ' in the currently focused input field';
        return [{ text: description }];
      }
    }

    function value() {
      return {
        name: '.computer',
        args: {
          action: 'type',
          coordinate: screenCoordinate
            ? [screenCoordinate.x, screenCoordinate.y]
            : undefined,
          text: args.text,
          overwrite: args.overwrite,
          enter: args.enter,
        },
      };
    }

    return { getDescription, value };
  }
}
