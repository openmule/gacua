/**
 * @license
 * Copyright 2025 MuleRun
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  keyboard,
  mouse,
  screen,
  Point,
  Button,
  Key,
} from '@nut-tree-fork/nut-js';
import captureScreen from 'screenshot-desktop';
import { computerToolArgs } from './types';
import sharp from 'sharp';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function stringToNutKey(key: string): Key {
  const keyMap: { [key: string]: Key } = {
    // Modifiers
    ctrl: Key.LeftControl,
    control: Key.LeftControl,
    alt: Key.LeftAlt,
    shift: Key.LeftShift,
    cmd: Key.LeftCmd,
    command: Key.LeftCmd,
    win: Key.LeftWin,
    super: Key.LeftSuper,
    // Whitespace & Navigation
    enter: Key.Enter,
    tab: Key.Tab,
    space: Key.Space,
    backspace: Key.Backspace,
    escape: Key.Escape,
    up: Key.Up,
    up_arrow: Key.Up,
    down: Key.Down,
    down_arrow: Key.Down,
    left: Key.Left,
    left_arrow: Key.Left,
    right: Key.Right,
    right_arrow: Key.Right,
    pagedown: Key.PageDown,
    page_down: Key.PageDown,
    pg_down: Key.PageDown,
    pageup: Key.PageUp,
    page_up: Key.PageUp,
    pg_up: Key.PageUp,
    // Function keys
    f1: Key.F1,
    f2: Key.F2,
    f3: Key.F3,
    f4: Key.F4,
    f5: Key.F5,
    f6: Key.F6,
    f7: Key.F7,
    f8: Key.F8,
    f9: Key.F9,
    f10: Key.F10,
    f11: Key.F11,
    f12: Key.F12,
    '.': Key.Period,
    delete: Key.Delete,
    del: Key.Delete,
  };

  const lowerKey = key.toLowerCase();
  if (lowerKey in keyMap) {
    return keyMap[lowerKey];
  }

  // For single alphabetical characters
  if (/^[a-z]$/.test(lowerKey)) {
    const upperKey = lowerKey.toUpperCase();
    if (upperKey in Key) {
      return Key[upperKey as keyof typeof Key];
    }
  }

  throw new Error(
    `Key mapping not found for: "${key}". Please extend the 'stringToNutKey' mapping.`,
  );
}

export async function executeComputerAction(
  args: computerToolArgs,
): Promise<string | Buffer> {
  const {
    action,
    wait_duration = 1,
    // click
    coordinate = undefined,
    button_type = 'left',
    num_clicks = 1,
    hold_keys = [],
    // type
    text = undefined,
    overwrite = false,
    enter = false,
    // drag_and_drop
    target_coordinate = undefined,
    // scroll
    clicks = 0,
    shift = false,
    // key
    keys = [],
    hold_duration = 0,
    // wait
    time = 0,
  } = args;

  let result: string | Buffer = '';

  // Map string key names to nut.js Key enums
  const nutHoldKeys = hold_keys.map(stringToNutKey);

  switch (action) {
    case 'click': {
      let x: number, y: number;
      if (coordinate) {
        [x, y] = coordinate;
      } else {
        const pos = await mouse.getPosition();
        x = pos.x;
        y = pos.y;
      }

      const nutButtonType =
        button_type === 'right'
          ? Button.RIGHT
          : button_type === 'middle'
            ? Button.MIDDLE
            : Button.LEFT;

      if (coordinate) {
        await mouse.setPosition(new Point(x, y));
      }

      if (nutHoldKeys.length > 0) await keyboard.pressKey(...nutHoldKeys);

      // nut.js supports doubleClick, for others we loop
      if (nutButtonType === Button.LEFT && num_clicks === 2) {
        await mouse.doubleClick(nutButtonType);
      } else {
        for (let i = 0; i < num_clicks; i++) {
          await mouse.click(nutButtonType);
        }
      }

      if (nutHoldKeys.length > 0) await keyboard.releaseKey(...nutHoldKeys);

      result = `Performed ${num_clicks}x ${button_type || 'left'} click at (${x}, ${y})`;
      break;
    }

    case 'type': {
      if (coordinate) {
        const [x, y] = coordinate;
        await mouse.setPosition(new Point(x, y));
        await mouse.click(Button.LEFT);
      }

      if (overwrite) {
        await keyboard.pressKey(Key.LeftControl, Key.A);
        await keyboard.releaseKey(Key.LeftControl, Key.A);
        await keyboard.pressKey(Key.Backspace);
        await keyboard.releaseKey(Key.Backspace);
      }

      if (text) {
        await keyboard.type(text);
      }

      if (enter) {
        await keyboard.pressKey(Key.Enter);
        await keyboard.releaseKey(Key.Enter);
      }

      result = `Typed text: ${text}`;
      break;
    }

    case 'drag_and_drop': {
      if (!target_coordinate) {
        throw new Error('targetCoordinate is required for drag_and_drop');
      }
      const [targetX, targetY] = target_coordinate;

      let startX: number, startY: number;
      if (coordinate) {
        [startX, startY] = coordinate;
        await mouse.setPosition(new Point(startX, startY));
      } else {
        const pos = await mouse.getPosition();
        startX = pos.x;
        startY = pos.y;
      }

      if (nutHoldKeys.length > 0) await keyboard.pressKey(...nutHoldKeys);

      await mouse.pressButton(Button.LEFT);
      await mouse.setPosition(new Point(targetX, targetY));
      await mouse.releaseButton(Button.LEFT);

      if (nutHoldKeys.length > 0) await keyboard.releaseKey(...nutHoldKeys);

      result = `Performed drag and drop from (${startX}, ${startY}) to (${targetX}, ${targetY})`;
      break;
    }

    case 'scroll': {
      if (!clicks) {
        throw new Error('clicks are required for scroll action');
      }

      if (coordinate) {
        const [x, y] = coordinate;
        await mouse.setPosition(new Point(x, y));
      }
      await sleep(500);

      if (shift) {
        // Horizontal scroll
        if (clicks > 0) {
          await mouse.scrollRight(-clicks);
        } else {
          await mouse.scrollLeft(clicks);
        }
      } else {
        // Vertical scroll
        if (clicks > 0) {
          await mouse.scrollDown(-clicks);
        } else {
          await mouse.scrollUp(clicks);
        }
      }

      result = `Performed scroll by ${clicks} clicks`;
      break;
    }

    case 'key': {
      if (!keys || keys.length === 0) {
        throw new Error('keys are required for key action');
      }

      const nutKeys = keys.map(stringToNutKey);
      const uniqueKeys = [...new Set(nutKeys)];

      await keyboard.pressKey(...uniqueKeys);

      if (hold_duration && hold_duration > 0) {
        await sleep(hold_duration * 1000);
      }

      await keyboard.releaseKey(...uniqueKeys);

      result =
        `Pressed keys: ${keys.join(', ')}` +
        (hold_duration ? ` for ${hold_duration} seconds` : '');
      break;
    }

    case 'wait': {
      await sleep(time * 1000);
      result = `Waited for ${time} seconds`;
      break;
    }

    case 'screenshot': {
      const screenshotResult = await captureScreen({ format: 'png' });
      const scaledBuffer = await sharp(screenshotResult.buffer)
        .resize(await screen.width(), await screen.height())
        .toBuffer();
      result = scaledBuffer;
      break;
    }

    default: {
      const _exhaustiveCheck: never = action;
      throw new Error(`Not a valid action: ${_exhaustiveCheck}`);
    }
  }

  if (wait_duration > 0 && action !== 'screenshot') {
    await sleep(wait_duration * 1000);
  }

  return result;
}
