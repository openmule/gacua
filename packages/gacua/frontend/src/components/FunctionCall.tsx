/**
 * @license
 * Copyright 2025 MuleRun
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { FunctionCall as FunctionCallType } from '@gacua/shared';
import { ExpandableItem } from './ExpandableItem.js';

interface FunctionCallProps {
  functionCall: FunctionCallType;
  leftAlignment?: boolean;
}

const ArgsDisplay: React.FC<{ functionCall: FunctionCallType }> = ({
  functionCall,
}) => {
  return (
    <div className="space-y-2">
      {functionCall.id && (
        <div className="pt-1 px-2 text-s text-slate-800">
          ID: {functionCall.id}
        </div>
      )}
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-slate-300">
            <th className="text-left py-1 px-2 font-semibold text-slate-800">
              Parameter
            </th>
            <th className="text-left py-1 px-2 font-semibold text-slate-800">
              Value
            </th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(functionCall.args)
            .sort()
            .map(([key, value]) => (
              <tr
                key={key}
                className="border-b border-slate-200 last:border-b-0"
              >
                <td className="py-1 px-2 text-slate-800 align-top">{key}</td>
                <td className="py-1 px-2 whitespace-pre-wrap break-all">
                  {typeof value === 'string'
                    ? value
                    : JSON.stringify(value, null)}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
};

export const FunctionCall: React.FC<FunctionCallProps> = ({ functionCall }) => {
  return (
    <ExpandableItem
      label="Tool Call"
      content={<span className="font-mono">{functionCall.name}</span>}
      expandedContent={<ArgsDisplay functionCall={functionCall} />}
    />
  );
};
