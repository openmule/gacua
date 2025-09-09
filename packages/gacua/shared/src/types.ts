/**
 * @license
 * Copyright 2025 MuleRun
 * SPDX-License-Identifier: Apache-2.0
 */

// Session Types

export type SessionStatus = 'running' | 'pending' | 'stagnant' | 'error';

export interface SessionMetadata {
  id: string;
  name?: string;
  model: string;
  status: SessionStatus;
  statusMessage?: string;
  acceptedTools?: string[];
}

// Message Types

type Role = 'user' | 'model' | 'tool' | 'workflow' | 'grounding_model';

export interface FunctionCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface PersistentImage {
  src: string;
  alt?: string;
  format?: 'png';
}

export interface ToolReviewRequest {
  reviewId: string;
  functionCall: FunctionCall;
  originalFunctionCall: FunctionCall;
}

export interface FunctionResponse {
  id: string;
  name: string;
  response:
    | {
        output: string;
      }
    | {
        error: string;
      };
}

export type PersistentMessageContentBlock =
  | {
      thought: string;
    }
  | {
      text: string;
    }
  | {
      functionCall: FunctionCall;
    }
  | {
      image: PersistentImage;
    }
  | {
      functionResponse: FunctionResponse;
    };

export type ToolReviewChoice = 'accept_session' | 'accept_once' | 'reject_once';

export interface ToolReviewResponse {
  reviewId: string;
  choice: ToolReviewChoice;
}

export interface PersistentMessage {
  id: string;
  role: Role;
  content: PersistentMessageContentBlock[];
  toolReview?: ToolReviewRequest | ToolReviewResponse;
  /**
   * Controls message visibility:
   * - true: Shown to user only, not sent to model.
   * - false: Sent to model only, not shown to user.
   * - undefined: Shown to user and sent to model.
   */
  forDisplay?: boolean;
  timestamp: Date;
}

export interface StreamMessage {
  role: 'model' | 'grounding_model';
  thought?: string;
  text?: string;
}

export interface DisplayMessage {
  id?: string;
  role: Role;
  content: PersistentMessageContentBlock[];
  toolReview?: {
    reviewId: string;
    choice?: ToolReviewChoice;
  };
  timestamp?: Date;
  volatile?: boolean;
}

// Request and Response types

export interface CreateSessionRequest {
  name?: string;
  model: string;
}

export interface CreateSessionResponse {
  id: string;
  message: string;
}

// Application Communication Events

export interface Event<T = unknown> {
  type: string;
  payload: T;
  sessionId?: string;
}

// --- Client to Server Events ---

export interface UserInputRequest
  extends Event<{
    input: string;
    model: string;
  }> {
  type: 'user_input';
  sessionId: string;
}

export interface ToolReviewResponseRequest extends Event<ToolReviewResponse> {
  type: 'tool_review';
  sessionId: string;
}

export type ClientRequest = UserInputRequest | ToolReviewResponseRequest;

// --- Server to Client Events ---

export interface PersistentMessageEvent
  extends Event<Omit<PersistentMessage, 'timestamp'> & { timestamp: string }> {
  type: 'persistent_message';
  sessionId: string;
}

export interface StreamMessageEvent extends Event<StreamMessage> {
  type: 'stream_message';
  sessionId: string;
}

export interface SessionStatusEvent
  extends Event<{
    status: SessionStatus;
    message?: string;
  }> {
  type: 'session_status';
  sessionId: string;
}

export type ServerEvent =
  | PersistentMessageEvent
  | StreamMessageEvent
  | SessionStatusEvent;
