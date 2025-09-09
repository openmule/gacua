/**
 * @license
 * Copyright 2025 MuleRun
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { FunctionResponse as FunctionResponseType } from '@gacua/shared';
import { ExpandableItem } from './ExpandableItem.js';

interface FunctionResponseProps {
  functionResponse: FunctionResponseType;
}

export const FunctionResponse: React.FC<FunctionResponseProps> = ({
  functionResponse,
}) => {
  const response = functionResponse.response;
  const isError = 'error' in response;
  const responseText = isError ? response.error : response.output;

  return (
    <ExpandableItem
      label={isError ? 'Error' : 'Output'}
      labelColor={isError ? 'text-red-500' : 'text-gray-500'}
      content={responseText}
      expandedContent={
        <div>
          <div className="pt-1 px-2 text-s text-slate-800">
            <div>ID: {functionResponse.id}</div>
            <div>Name: {functionResponse.name}</div>
          </div>
        </div>
      }
    />
  );
};
