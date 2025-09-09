/**
 * @license
 * Copyright 2025 MuleRun
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';

export const Thought: React.FC<{ thought: string }> = ({ thought }) => {
  const [isCollapsed, setIsCollapsed] = useState(true);

  const toggle = () => setIsCollapsed(!isCollapsed);

  const processedThought = useMemo(() => thought.trimEnd(), [thought]);

  const lastTitle = useMemo(() => {
    const titles = processedThought.match(/\*\*(.*?)\*\*/g);
    if (titles && titles.length > 0) {
      // Get the last title and remove the asterisks
      return titles[titles.length - 1].replace(/\*\*/g, '');
    }
    // Default title if no specific title is found
    return 'Thought Process';
  }, [processedThought]);

  return (
    <div className="thought py-1 inline-block">
      <div
        className="flex cursor-pointer select-none items-center"
        onClick={toggle}
      >
        <span className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          {isCollapsed ? `Thought: ${lastTitle}` : 'Hide Thought'}
        </span>
      </div>
      {!isCollapsed && (
        <div className="mt-2 pl-6 text-sm text-gray-400">
          <div className="italic m-0 whitespace-pre-wrap break-words leading-tight">
            {processedThought.split(/(\*\*.*?\*\*)/g).map((part, index) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return (
                  <span key={index} className="font-bold">
                    {part.slice(2, -2)}
                  </span>
                );
              }
              return part;
            })}
          </div>
        </div>
      )}
    </div>
  );
};
