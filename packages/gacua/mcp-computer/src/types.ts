/**
 * @license
 * Copyright 2025 MuleRun
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from 'zod';

export const computerToolInputSchema = z.object({
  action: z.enum([
    'click',
    'type',
    'drag_and_drop',
    'scroll',
    'key',
    'wait',
    'screenshot',
  ]),
  wait_duration: z.number().min(0).default(2).optional(),
  coordinate: z.array(z.number().int()).min(2).max(2).optional(),
  button_type: z.enum(['left', 'right', 'middle']).default('left').optional(),
  num_clicks: z.number().int().min(1).default(1).optional(),
  hold_keys: z.array(z.string()).default([]).optional(),
  text: z.string().optional(),
  overwrite: z.boolean().default(false).optional(),
  enter: z.boolean().default(false).optional(),
  target_coordinate: z.array(z.number().int()).min(2).max(2).optional(),
  clicks: z.number().int().default(1).optional(),
  shift: z.boolean().default(false).optional(),
  keys: z.array(z.string()).default([]).optional(),
  hold_duration: z.number().min(0).default(0).optional(),
  time: z.number().min(0).default(0).optional(),
});

export interface computerToolArgs {
  action:
    | 'click'
    | 'type'
    | 'drag_and_drop'
    | 'scroll'
    | 'key'
    | 'wait'
    | 'screenshot';
  wait_duration?: number;
  // click params
  coordinate?: [number, number];
  button_type?: 'left' | 'right' | 'middle';
  num_clicks?: 1 | 2 | 3;
  hold_keys?: string[];
  // type params
  text?: string;
  overwrite?: boolean;
  enter?: boolean;
  // drag_and_drop params
  target_coordinate?: [number, number];
  // scroll params
  clicks?: number;
  shift?: boolean;
  // key params
  keys?: string[];
  hold_duration?: number;
  // wait params
  time?: number;
}
