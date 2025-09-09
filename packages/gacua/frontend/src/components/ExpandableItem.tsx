/**
 * @license
 * Copyright 2025 MuleRun
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, type ReactNode } from 'react';

interface ExpandableItemProps {
  label: string;
  content: string | ReactNode;
  labelColor?: string;
  expandedContent?: ReactNode;
  initialExpanded?: boolean;
}

export const ExpandableItem: React.FC<ExpandableItemProps> = ({
  label,
  content,
  labelColor = 'text-gray-500',
  expandedContent,
  initialExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);

  const toggle = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className={`py-1 w-fit text-sm`}>
      <div
        className={`flex items-center transition-colors cursor-pointer hover:bg-slate-100`}
        onClick={toggle}
      >
        <div className="flex items-baseline gap-1">
          <span className={labelColor}>{label}:</span>
          <span className="text-gray-800">{content}</span>
        </div>
      </div>

      {isExpanded && expandedContent && (
        <div className="font-mono text-sm text-slate-700 overflow-x-auto bg-slate-50 p-2 rounded-md">
          {expandedContent}
        </div>
      )}
    </div>
  );
};
