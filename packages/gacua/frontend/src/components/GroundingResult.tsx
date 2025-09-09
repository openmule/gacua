/**
 * @license
 * Copyright 2025 MuleRun
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ExpandableItem } from './ExpandableItem.js';

interface GroundingResultProps {
  text: string;
}

export const GroundingResult: React.FC<GroundingResultProps> = ({ text }) => {
  try {
    const result = JSON.parse(text);
    const { box_2d, label } = result;

    if (!box_2d || !label) {
      throw new Error('Invalid grounding result');
    }

    const expandedContent = (
      <div>
        <span className="text-slate-800">box_2d: </span>
        <span>[{box_2d.join(', ')}]</span>
      </div>
    );

    return (
      <ExpandableItem
        label="Grounded"
        content={label}
        expandedContent={expandedContent}
      />
    );
  } catch (_e) {
    // Fall back to plain text if JSON parsing fails
  }

  return (
    <div className="whitespace-pre-wrap break-words text-sm leading-tight">
      {text}
    </div>
  );
};
