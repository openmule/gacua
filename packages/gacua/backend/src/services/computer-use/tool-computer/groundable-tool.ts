/**
 * @license
 * Copyright 2025 MuleRun
 * SPDX-License-Identifier: Apache-2.0
 */

import type { FunctionDeclaration, Part } from '@google/genai';
import { SchemaValidator } from '@gacua/gemini-cli-core';
import {
  type Box,
  type Image,
  toScreenCoords as toScreenCoordinate,
} from '../screen.js';

export interface GroundedToolCall {
  getDescription(
    saveImage: (imageBuffer: Buffer, nameSuffix: string) => Promise<string>,
  ): Promise<({ text: string } | { imageFileName: string })[]>;
  value(): { name: string; args: Record<string, unknown> };
}

export interface GroundableTool<TArgs = unknown> {
  readonly functionDeclaration: FunctionDeclaration;
  validate(args: TArgs): string | null;
  ground(
    args: TArgs,
    screenshot: Image,
    croppedScreenshotParts: { imagePart: Part }[],
    detectElement: (
      imagePart: Part,
      elementDescription: string,
    ) => Promise<Box>,
  ): Promise<GroundedToolCall | string>;
}

export abstract class BaseGroundableTool<TArgs = unknown>
  implements GroundableTool<TArgs>
{
  abstract readonly functionDeclaration: FunctionDeclaration;
  abstract ground(
    args: TArgs,
    screenshot: Image,
    croppedScreenshotParts: { imagePart: Part }[],
    detectElement: (
      imagePart: Part,
      elementDescription: string,
    ) => Promise<Box>,
  ): Promise<GroundedToolCall | string>;

  validate(args: unknown): string | null {
    return SchemaValidator.validate(this.functionDeclaration.parameters, args);
  }

  protected validateImageElementPair(args: unknown): string | null {
    const result = SchemaValidator.validate(
      this.functionDeclaration.parameters,
      args,
    );
    if (result) {
      return result;
    }
    if (typeof args !== 'object' || args === null) {
      return 'Arguments must be an object';
    }
    const typedArgs = args as {
      image_id?: unknown;
      element_description?: unknown;
    };
    if (
      typedArgs.image_id === undefined &&
      typedArgs.element_description !== undefined
    ) {
      return 'When element_description is provided, image_id must be provided';
    }
    if (
      typedArgs.image_id !== undefined &&
      typedArgs.element_description === undefined
    ) {
      return 'When image_id is provided, element_description must be provided';
    }
    return null;
  }

  protected async detectAndTransform(
    imageId: number,
    croppedScreenshotParts: { imagePart: Part }[],
    detectElement: (imagePart: Part) => Promise<Box>,
  ) {
    if (imageId >= croppedScreenshotParts.length) {
      return `Image ID exceeds the number of cropped screenshots: ${imageId} >= ${croppedScreenshotParts.length}`;
    }
    let box: Box;
    try {
      box = await detectElement(croppedScreenshotParts[imageId].imagePart);
    } catch (e) {
      return `Failed to detect element: ${e}`;
    }
    const screenCoords = toScreenCoordinate({
      index: imageId,
      boxOrCoordinate: box,
    });
    return {
      indexAndBox: { index: imageId, box },
      screenCoordinate: screenCoords,
    };
  }
}
