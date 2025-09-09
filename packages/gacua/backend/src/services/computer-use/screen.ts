/**
 * @license
 * Copyright 2025 MuleRun
 * SPDX-License-Identifier: Apache-2.0
 */

import sharp, { type Sharp } from 'sharp';
import type { Part, PartListUnion } from '@google/genai';

type Resolution = {
  width: number;
  height: number;
};

export type Coordinate = {
  x: number;
  y: number;
};

export type Box = {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
};

export type IndexAndBox = {
  index: number;
  box: Box;
};

export type Image = {
  buffer: Buffer;
  resolution: Resolution;
  mimeType: string;
};

class Screen {
  cropDirection!: 'vertical' | 'horizontal';
  cropSquareSideLength!: number;
  squareStartingPoints!: Coordinate[];

  constructor(readonly resolution: Resolution) {
    this.setCropConfiguration();
  }

  private setCropConfiguration(): void {
    this.cropDirection =
      this.resolution.width > this.resolution.height
        ? 'vertical'
        : 'horizontal';

    this.cropSquareSideLength = Math.min(
      this.resolution.width,
      this.resolution.height,
    );

    this.squareStartingPoints = [{ x: 0, y: 0 }];

    const cropStep = Math.round(this.cropSquareSideLength * 0.5);

    if (this.cropDirection === 'vertical') {
      let x = cropStep;
      while (x + this.cropSquareSideLength < this.resolution.width) {
        this.squareStartingPoints.push({ x, y: 0 });
        x += cropStep;
      }
      const finalX = this.resolution.width - this.cropSquareSideLength;
      if (
        finalX >
        this.squareStartingPoints[this.squareStartingPoints.length - 1].x
      ) {
        this.squareStartingPoints.push({ x: finalX, y: 0 });
      }
    } else {
      // horizontal
      let y = cropStep;
      while (y + this.cropSquareSideLength < this.resolution.height) {
        this.squareStartingPoints.push({ x: 0, y });
        y += cropStep;
      }
      const finalY = this.resolution.height - this.cropSquareSideLength;
      if (
        finalY >
        this.squareStartingPoints[this.squareStartingPoints.length - 1].y
      ) {
        this.squareStartingPoints.push({ x: 0, y: finalY });
      }
    }
  }

  public async crop(image: Image): Promise<Image[]> {
    this.checkImageResolution(image);

    const croppedImages: Sharp[] = [];
    for (const startPoint of this.squareStartingPoints) {
      const cropBox = {
        left: startPoint.x,
        top: startPoint.y,
        width: this.cropSquareSideLength,
        height: this.cropSquareSideLength,
      };
      const croppedImage = sharp(image.buffer)
        .extract(cropBox)
        .resize(768, 768, { fit: 'fill' });
      croppedImages.push(croppedImage);
    }
    return await Promise.all(
      croppedImages.map(async (croppedImage) => ({
        buffer: await croppedImage.toBuffer(),
        resolution: { width: 768, height: 768 },
        mimeType: 'image/png',
      })),
    );
  }

  public toScreenCoordinate({
    index,
    boxOrCoordinate,
  }: {
    index: number;
    boxOrCoordinate: Box | Coordinate;
  }): Coordinate {
    const center =
      'ymin' in boxOrCoordinate
        ? Screen.getBoxCenter(boxOrCoordinate)
        : boxOrCoordinate;

    const unnormalizedX = Math.round(
      (center.x / 1000) * this.cropSquareSideLength,
    );
    const unnormalizedY = Math.round(
      (center.y / 1000) * this.cropSquareSideLength,
    );

    const startPoint = this.squareStartingPoints[index];
    return {
      x: startPoint.x + unnormalizedX,
      y: startPoint.y + unnormalizedY,
    };
  }

  private toScreenRectangle({ index, box }: IndexAndBox) {
    const { ymin, xmin, ymax, xmax } = box;
    const { x: left, y: top } = this.toScreenCoordinate({
      index,
      boxOrCoordinate: { x: xmin, y: ymin },
    });
    const { x: right, y: bottom } = this.toScreenCoordinate({
      index,
      boxOrCoordinate: { x: xmax, y: ymax },
    });

    const rectWidth = right - left;
    const rectHeight = bottom - top;

    return { left, top, rectWidth, rectHeight };
  }

  public async highlightBox(
    image: Image,
    indexAndBox: IndexAndBox,
    color: string = 'gray',
    width: number = 1,
  ): Promise<Image> {
    this.checkImageResolution(image);

    const { left, top, rectWidth, rectHeight } =
      this.toScreenRectangle(indexAndBox);

    const svgMask = `
      <svg width="${image.resolution.width}" height="${image.resolution.height}">
        <defs>
          <mask id="vignetteMask">
            <rect x="0" y="0" width="${image.resolution.width}" height="${image.resolution.height}" fill="white" />
            <rect x="${left}" y="${top}" width="${rectWidth}" height="${rectHeight}" fill="black" />
          </mask>
        </defs>
        <rect x="0" y="0" width="${image.resolution.width}" height="${image.resolution.height}" fill="black" mask="url(#vignetteMask)" opacity="0.5" />
        <rect x="${left}" y="${top}" width="${rectWidth}" height="${rectHeight}" stroke="${color}" stroke-width="${width}" fill="none" />
      </svg>`;

    return {
      ...image,
      buffer: await sharp(image.buffer)
        .composite([{ input: Buffer.from(svgMask), top: 0, left: 0 }])
        .toBuffer(),
    };
  }

  public async highlightConnectedBoxes(
    image: Image,
    startingIndexAndBox: IndexAndBox,
    endingIndexAndBox: IndexAndBox,
    borderColor: string = 'gray',
    borderWidth: number = 1,
    arrowColor: string = 'gray',
    arrowWidth: number = 1,
  ) {
    this.checkImageResolution(image);

    const {
      left: box1Left,
      top: box1Top,
      rectWidth: box1Width,
      rectHeight: box1Height,
    } = this.toScreenRectangle(startingIndexAndBox);
    const {
      left: box2Left,
      top: box2Top,
      rectWidth: box2Width,
      rectHeight: box2Height,
    } = this.toScreenRectangle(endingIndexAndBox);

    const arrowStartX = Math.round(box1Left + box1Width / 2);
    const arrowStartY = Math.round(box1Top + box1Height / 2);
    const arrowEndX = Math.round(box2Left + box2Width / 2);
    const arrowEndY = Math.round(box2Top + box2Height / 2);

    const svgMask = `
  <svg width="${image.resolution.width}" height="${image.resolution.height}">
    <defs>
      <mask id="vignetteMask">
        <rect x="0" y="0" width="${image.resolution.width}" height="${image.resolution.height}" fill="white" />
        <rect x="${box1Left}" y="${box1Top}" width="${box1Width}" height="${box1Height}" fill="black" />
        <rect x="${box2Left}" y="${box2Top}" width="${box2Width}" height="${box2Height}" fill="black" />
      </mask>
      <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="${arrowColor}" />
      </marker>
    </defs>
    <rect x="0" y="0" width="${image.resolution.width}" height="${image.resolution.height}" fill="black" mask="url(#vignetteMask)" opacity="0.5" />
    <rect x="${box1Left}" y="${box1Top}" width="${box1Width}" height="${box1Height}" stroke="${borderColor}" stroke-width="${borderWidth}" fill="none" />
    <rect x="${box2Left}" y="${box2Top}" width="${box2Width}" height="${box2Height}" stroke="${borderColor}" stroke-width="${borderWidth}" fill="none" />
    <line x1="${arrowStartX}" y1="${arrowStartY}" x2="${arrowEndX}" y2="${arrowEndY}" stroke="${arrowColor}" stroke-width="${arrowWidth}" marker-end="url(#arrowhead)" />
  </svg>`;

    return {
      ...image,
      buffer: await sharp(image.buffer)
        .composite([{ input: Buffer.from(svgMask), top: 0, left: 0 }])
        .toBuffer(),
    };
  }

  private checkImageResolution(image: Image) {
    if (image.resolution !== this.resolution) {
      throw Error(
        `Image resolution does not match screen resolution: ${image.resolution} != ${this.resolution}`,
      );
    }
  }

  private static getBoxCenter(box: Box): Coordinate {
    const { ymin, xmin, ymax, xmax } = box;
    const centerX = Math.floor((xmin + xmax) / 2);
    const centerY = Math.floor((ymin + ymax) / 2);
    return { x: centerX, y: centerY };
  }
}

let screen: Screen; // This refreshes every time a screenshot is taken.

export async function takeScreenshot(
  screenshotToolResult: PartListUnion,
): Promise<Image> {
  if (!screenshotToolResult || !Array.isArray(screenshotToolResult)) {
    throw new Error('Invalid screenshot response format');
  }
  const inlineDataPart = screenshotToolResult.at(-1);
  if (typeof inlineDataPart !== 'object' || !('inlineData' in inlineDataPart)) {
    throw new Error('Invalid screenshot response format');
  }
  const inlineData = inlineDataPart.inlineData;
  if (
    !inlineData ||
    typeof inlineData.mimeType !== 'string' ||
    typeof inlineData.data !== 'string'
  ) {
    throw new Error('Invalid screenshot response format');
  }
  if (inlineData.mimeType !== 'image/png') {
    throw new Error(
      `Invalid screenshot response format: expected image/png, got ${inlineData.mimeType}`,
    );
  }
  const imageBuffer = Buffer.from(inlineData.data, 'base64');

  const imageSharp = sharp(imageBuffer);
  const metadata = await imageSharp.metadata();
  const { width, height } = metadata;
  if (!width || !height) {
    throw new Error(`Invalid screenshot: width: ${width}, height: ${height}`);
  }
  const resolution = { width, height };
  screen = new Screen(resolution);

  return {
    buffer: imageBuffer,
    resolution,
    mimeType: inlineData.mimeType,
  };
}

export async function cropScreenshot(
  screenshot: Image,
): Promise<{ image: Image; description: string; nameSuffix: string }[]> {
  return (await screen.crop(screenshot)).map((croppedImage, index) => ({
    image: croppedImage,
    description: `${screen.cropDirection}ly cropped screenshot ${index}`,
    nameSuffix: `screenshot_${screen.cropDirection.slice(0, 1)}c${index}`,
  }));
}

export function imageToPart(image: Image): Part {
  return {
    inlineData: {
      data: image.buffer.toString('base64'),
      mimeType: image.mimeType,
    },
  };
}

export function toScreenCoords(args: {
  index: number;
  boxOrCoordinate: Box | Coordinate;
}): Coordinate {
  return screen.toScreenCoordinate(args);
}

export async function highlightBox(
  image: Image,
  indexAndBox: IndexAndBox,
  color: string = 'gray',
  width: number = 1,
): Promise<Image> {
  return screen.highlightBox(image, indexAndBox, color, width);
}

export async function highlightConnectedBoxes(
  image: Image,
  startingIndexAndBox: IndexAndBox,
  endingIndexAndBox: IndexAndBox,
  borderColor: string = 'gray',
  borderWidth: number = 1,
  arrowColor: string = 'gray',
  arrowWidth: number = 1,
) {
  return screen.highlightConnectedBoxes(
    image,
    startingIndexAndBox,
    endingIndexAndBox,
    borderColor,
    borderWidth,
    arrowColor,
    arrowWidth,
  );
}
