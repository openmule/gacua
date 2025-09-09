/**
 * @license
 * Copyright 2025 MuleRun
 * SPDX-License-Identifier: Apache-2.0
 */

import type { FunctionDeclaration } from '@google/genai';
import type { GroundableTool } from './groundable-tool.js';
import { ComputerClick } from './click.js';
import { ComputerDragAndDrop } from './drag-and-drop.js';
import { ComputerKey } from './key.js';
import { ComputerType } from './type.js';
import { ComputerWait } from './wait.js';

const computerTools = Object.fromEntries(
  [
    new ComputerClick(),
    new ComputerType(),
    new ComputerDragAndDrop(),
    new ComputerKey(),
    new ComputerWait(),
  ].map((tool) => [tool.functionDeclaration.name!, tool]),
);

export function getValidComputerTool(
  name: string,
  args: unknown,
): GroundableTool | string {
  if (!(name in computerTools)) {
    return `Tool does not exist: ${name}`;
  }
  const tool = computerTools[name];
  const validationResult = tool.validate(args);
  if (validationResult) {
    return validationResult;
  }
  return tool;
}

export function getComputerFunctionDeclarations(): FunctionDeclaration[] {
  return Object.values(computerTools).map((tool) => tool.functionDeclaration);
}
