/**
 * @license
 * Copyright 2025 MuleRun
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import Dropdown from './Dropdown.js';

interface InputProps {
  input: string;
  model: string;
  loading: boolean;
  onInputChange: (value: string) => void;
  onModelChange: (model: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

const Input: React.FC<InputProps> = ({
  input,
  model,
  loading,
  onInputChange,
  onModelChange,
  onSubmit,
}) => {
  const [scrollbarWidth, setScrollbarWidth] = React.useState(0);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    const getScrollbarWidth = () => {
      const outer = document.createElement('div');
      outer.style.visibility = 'hidden';
      outer.style.overflow = 'scroll';
      document.body.appendChild(outer);

      const inner = document.createElement('div');
      outer.appendChild(inner);

      const width = outer.offsetWidth - inner.offsetWidth;
      outer.parentNode?.removeChild(outer);
      return width;
    };

    setScrollbarWidth(getScrollbarWidth());
  }, []);

  React.useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);
  return (
    <div
      className="absolute left-0 max-w-4xl mx-auto px-4"
      style={{
        right: `${scrollbarWidth}px`,
        bottom: `max(1rem, env(safe-area-inset-bottom, 1rem))`,
      }}
    >
      <div className="flex flex-col w-full p-2 bg-white/50 border border-gray-200 rounded-2xl shadow-lg transition-all focus-within:bg-white focus-within:ring-2 focus-within:ring-slate-200 focus-within:border-slate-400">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder=""
          className="w-full min-h-[40px] max-h-32 px-2 pt-2 text-base text-gray-800 bg-transparent resize-none outline-none placeholder:text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
          rows={1}
          disabled={loading}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
              e.preventDefault();
              onSubmit(e);
            }
          }}
        />

        <div className="flex items-center justify-end gap-2 pt-1">
          <Dropdown
            value={model}
            onChange={onModelChange}
            options={[
              { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
              { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
            ]}
            disabled={loading}
          />
          <button
            type="submit"
            onClick={onSubmit}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-500 text-white hover:bg-slate-600 focus:ring-2 focus:ring-slate-200 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            disabled={loading || !input.trim()}
          >
            {loading ? (
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8h8a8 8 0 01-16 0z"
                />
              </svg>
            ) : (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(Input);
