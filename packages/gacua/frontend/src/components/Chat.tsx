/**
 * @license
 * Copyright 2025 MuleRun
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import Input from './Input.js';
import Messages from './Messages.js';

import type { DisplayMessage, ToolReviewResponse } from '@gacua/shared';

interface ChatProps {
  messages: DisplayMessage[] | null;
  currentSessionId: string | null;
  input: string;
  model: string;
  loading: boolean;
  accessToken: string | null;
  onInputChange: (value: string) => void;
  onModelChange: (model: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onToolReviewResponse: (toolReviewResponse: ToolReviewResponse) => void;
}

const Chat: React.FC<ChatProps> = ({
  messages,
  currentSessionId,
  input,
  model,
  loading,
  accessToken,
  onInputChange,
  onModelChange,
  onSubmit,
  onToolReviewResponse,
}) => {
  return (
    <div className="flex-1 relative">
      <Messages
        messages={messages}
        currentSessionId={currentSessionId}
        generating={loading}
        accessToken={accessToken}
        onToolReviewResponse={onToolReviewResponse}
      />
      <Input
        input={input}
        model={model}
        loading={loading}
        onInputChange={onInputChange}
        onModelChange={onModelChange}
        onSubmit={onSubmit}
      />
    </div>
  );
};

export default React.memo(Chat);
