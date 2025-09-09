/**
 * @license
 * Copyright 2025 MuleRun
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import Lightbox from 'yet-another-react-lightbox';
import Counter from 'yet-another-react-lightbox/plugins/counter';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import 'yet-another-react-lightbox/styles.css';
import 'yet-another-react-lightbox/plugins/counter.css';
import ReactMarkdown from 'react-markdown';
import type { DisplayMessage, ToolReviewResponse } from '@gacua/shared';
import { Thought } from './Thought.js';
import { FunctionCall } from './FunctionCall.js';
import { FunctionResponse } from './FunctionResponse.js';
import { GroundingResult } from './GroundingResult.js';
import { ToolReview } from './ToolReview.js';

interface MessagesProps {
  messages: DisplayMessage[] | null;
  currentSessionId: string | null;
  generating: boolean;
  accessToken: string | null;
  onToolReviewResponse: (toolReview: ToolReviewResponse) => void;
}

const WelcomeMessage = ({
  title,
  message,
}: {
  title: string;
  message: string;
}) => (
  <div className="flex flex-col items-center justify-center text-center">
    <h2 className="mb-2 text-2xl font-semibold text-gray-700">{title}</h2>
    <p className="text-base text-gray-500 opacity-80 px-2">{message}</p>
  </div>
);

const MessageTitle = ({ message }: { message: DisplayMessage }) => {
  function toDisplayName(name: string) {
    switch (name) {
      case 'grounding_model':
        return 'Grounding Model';
      default:
        return name.charAt(0).toUpperCase() + name.slice(1);
    }
  }

  return (
    <div className="py-1 text-xs text-gray-500">
      {toDisplayName(message.role)}{' '}
      {message.timestamp && `at ${message.timestamp.toLocaleTimeString()}`}
    </div>
  );
};

const MessageContent = ({
  leftAlignment,
  message,
  onImageClick,
  onToolReviewResponse,
  accessToken,
}: {
  leftAlignment: boolean;
  message: DisplayMessage;
  onImageClick: (imageSrc: string) => void;
  onToolReviewResponse: (toolReviewResponse: ToolReviewResponse) => void;
  accessToken: string | null;
}) => (
  <div
    className={`px-3 relative ${
      message.role === 'user'
        ? 'max-w-full rounded-2xl rounded-br-sm bg-slate-500 text-white'
        : `w-full border-solid text-black border-gray-300 ${leftAlignment ? 'border-l-2' : 'border-r-2'}`
    }`}
  >
    {message.content.map((block, index) => (
      <div
        key={index}
        className={`content-block flex ${leftAlignment ? 'justify-start' : 'justify-end'}`}
      >
        {'thought' in block && <Thought thought={block.thought} />}
        {'text' in block && (
          <div className="text py-1 min-w-0 max-w-full overflow-hidden break-words">
            {message.role === 'grounding_model' ? (
              <GroundingResult text={block.text} />
            ) : (
              <ReactMarkdown
                components={{
                  p: ({ children }) => (
                    <div className="mb-2 last:mb-0 break-words">{children}</div>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc pl-8 break-words">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal pl-8 break-words">
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => (
                    <li className="mb-2 break-words">{children}</li>
                  ),
                  code: ({ children }) => (
                    <code className="px-1 py-0.5 rounded text-sm text-black bg-gray-100 break-all">
                      {children}
                    </code>
                  ),
                }}
              >
                {block.text}
              </ReactMarkdown>
            )}
          </div>
        )}
        {'functionCall' in block && (
          <FunctionCall functionCall={block.functionCall} />
        )}
        {'functionResponse' in block && (
          <FunctionResponse functionResponse={block.functionResponse} />
        )}
        {'image' in block && (
          <div
            className={`image flex py-2 ${leftAlignment ? 'justify-start' : 'justify-end'}`}
          >
            <img
              src={
                accessToken
                  ? `${block.image.src.replace(/^internal:\/\//, '/images/')}?token=${accessToken}`
                  : block.image.src.replace(/^internal:\/\//, '/images/')
              }
              alt={block.image.alt ?? block.image.src.split('/').pop() ?? ''}
              className="h-auto lg:w-[70%] cursor-pointer border border-gray-200"
              onClick={() => onImageClick(block.image!.src)}
            />
          </div>
        )}
      </div>
    ))}
    {message.toolReview && (
      <ToolReview
        toolReview={message.toolReview}
        onToolReviewResponse={onToolReviewResponse}
      />
    )}
  </div>
);

const Messages: React.FC<MessagesProps> = ({
  messages,
  currentSessionId,
  generating,
  accessToken,
  onToolReviewResponse,
}) => {
  console.log('messages', messages);

  const processedMessages: DisplayMessage[] | null = React.useMemo(() => {
    if (!messages) return null;
    const reviewChoiceMap = new Map<string, ToolReviewResponse['choice']>();

    messages.forEach((message) => {
      if (message.toolReview && 'choice' in message.toolReview) {
        reviewChoiceMap.set(
          message.toolReview.reviewId,
          message.toolReview.choice!,
        );
      }
    });

    return messages
      .map((message) => {
        if (message.toolReview && !('choice' in message.toolReview)) {
          const choice = reviewChoiceMap.get(message.toolReview.reviewId);
          if (choice) {
            return {
              ...message,
              toolReview: { reviewId: message.toolReview.reviewId, choice },
            };
          }
        }
        return message;
      })
      .filter((message) => message.content.length > 0); // ToolReviewResponse has no content
  }, [messages]);

  const [lightboxOpen, setLightboxOpen] = React.useState(false);
  const [lightboxIndex, setLightboxIndex] = React.useState(0);

  const imageSlides = React.useMemo(() => {
    if (!processedMessages) return [];
    return processedMessages
      .flatMap((m) => m.content)
      .filter((c) => 'image' in c)
      .map((c) => ({
        src: accessToken
          ? `${c.image!.src.replace(/^internal:\/\//, '/images/')}?token=${accessToken}`
          : c.image!.src.replace(/^internal:\/\//, '/images/'),
        alt: c.image!.alt ?? c.image!.src.split('/').pop() ?? '',
      }));
  }, [processedMessages, accessToken]);

  const handleImageClick = (imageSrc: string) => {
    const processedSrc = accessToken
      ? `${imageSrc.replace(/^internal:\/\//, '/images/')}?token=${accessToken}`
      : imageSrc.replace(/^internal:\/\//, '/images/');
    const imageIndex = imageSlides.findIndex(
      (slide) => slide.src === processedSrc,
    );
    if (imageIndex !== -1) {
      setLightboxIndex(imageIndex);
      setLightboxOpen(true);
    }
  };

  if (
    !currentSessionId ||
    processedMessages === null ||
    processedMessages.length === 0
  ) {
    return (
      <div className="absolute inset-0 flex items-center justify-center mb-32">
        {!currentSessionId ? (
          <WelcomeMessage
            title="Welcome to GACUA"
            message="Create a new session or select an existing one to start chatting."
          />
        ) : processedMessages === null ? (
          <WelcomeMessage
            title="Loading..."
            message="Loading your messages..."
          />
        ) : (
          // processedMessages.length === 0
          <WelcomeMessage
            title="New Session"
            message="Start a conversation by typing a message below."
          />
        )}
      </div>
    );
  }

  return (
    <>
      <div className="absolute inset-0 overflow-y-auto">
        <div className="mx-auto max-w-4xl p-4 pb-64">
          {processedMessages.map((message) => {
            const leftAlignment =
              ['model', 'grounding_model'].includes(message.role) ||
              (message.role === 'workflow' && message.toolReview !== undefined);
            return (
              <div
                key={message.id ?? null}
                className={`mb-4 flex flex-col ${leftAlignment ? 'items-start' : 'items-end'}`}
              >
                <MessageTitle message={message} />
                <MessageContent
                  leftAlignment={leftAlignment}
                  message={message}
                  onImageClick={handleImageClick}
                  onToolReviewResponse={onToolReviewResponse}
                  accessToken={accessToken}
                />
              </div>
            );
          })}
          {generating && (
            <div className="mb-6 flex flex-col items-start">
              <div className="rounded-2xl bg-gray-100 p-4">
                <div className="flex items-center gap-1">
                  <span className="delay-0 h-2 w-2 animate-pulse rounded-full bg-gray-400"></span>
                  <span className="delay-75 h-2 w-2 animate-pulse rounded-full bg-gray-400"></span>
                  <span className="delay-150 h-2 w-2 animate-pulse rounded-full bg-gray-400"></span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        slides={imageSlides}
        index={lightboxIndex}
        plugins={[Counter, Zoom]}
      />
    </>
  );
};

export default React.memo(Messages);
