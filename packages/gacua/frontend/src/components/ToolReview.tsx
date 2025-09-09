/**
 * @license
 * Copyright 2025 MuleRun
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import type {
  DisplayMessage,
  ToolReviewResponse,
  ToolReviewChoice,
} from '@gacua/shared';

interface ToolReviewProps {
  toolReview: NonNullable<DisplayMessage['toolReview']>;
  onToolReviewResponse: (toolReviewResponse: ToolReviewResponse) => void;
}

export const ToolReview: React.FC<ToolReviewProps> = ({
  toolReview,
  onToolReviewResponse,
}) => {
  const { choice, reviewId } = toolReview;
  const [localChoice, setLocalChoice] = useState<ToolReviewChoice | undefined>(
    choice,
  );

  useEffect(() => {
    setLocalChoice(choice);
  }, [choice]);

  const options = [
    {
      value: 'accept_once',
      label: 'Accept',
      selectedLabel: 'Accepted',
      color: 'green',
    },
    {
      value: 'accept_session',
      label: 'Accept for Session',
      selectedLabel: 'Accepted for Session',
      color: 'blue',
    },
    {
      value: 'reject_once',
      label: 'Reject',
      selectedLabel: 'Rejected',
      color: 'red',
    },
  ];

  const getButtonClasses = (
    option: (typeof options)[0],
    isSelected: boolean,
  ) => {
    const baseClasses =
      'px-2 py-1 text-sm rounded border border-gray-200 transition-colors duration-200';

    if (isSelected) {
      const colorClasses = {
        green: 'text-green-700 bg-green-50',
        blue: 'text-blue-700 bg-blue-50',
        red: 'text-red-700 bg-red-50',
      };
      return `${baseClasses} ${colorClasses[option.color as keyof typeof colorClasses]}`;
    }

    if (!localChoice) {
      const colorClasses = {
        green: 'text-green-700 bg-green-50 hover:bg-green-100',
        blue: 'text-blue-700 bg-blue-50 hover:bg-blue-100',
        red: 'text-red-700 bg-red-50 hover:bg-red-100',
      };
      return `${baseClasses} ${colorClasses[option.color as keyof typeof colorClasses]} cursor-pointer`;
    }

    return `${baseClasses} text-gray-500`;
  };

  return (
    <div className="flex items-center justify-between p-1 my-1">
      <div className="flex flex-row gap-2">
        {options.map((option) => {
          const isSelected = localChoice === option.value;
          return (
            <div
              key={option.value}
              className={getButtonClasses(option, isSelected)}
              onClick={
                !localChoice
                  ? () => {
                      const selectedChoice = option.value as ToolReviewChoice;
                      setLocalChoice(selectedChoice);
                      onToolReviewResponse({
                        reviewId,
                        choice: selectedChoice,
                      });
                    }
                  : undefined
              }
            >
              {localChoice
                ? isSelected
                  ? option.selectedLabel
                  : option.label
                : option.label}
            </div>
          );
        })}
      </div>
    </div>
  );
};
