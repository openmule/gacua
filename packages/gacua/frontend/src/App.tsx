/**
 * @license
 * Copyright 2025 MuleRun
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  SessionMetadata,
  CreateSessionRequest,
  CreateSessionResponse,
  DisplayMessage,
  ServerEvent,
  UserInputRequest,
  ToolReviewResponse,
  ToolReviewResponseRequest,
  PersistentMessage,
} from '@gacua/shared';

import Sessions from './components/Sessions.js';
import Chat from './components/Chat.js';
import Toast from './components/Toast.js';

function App() {
  const [sessions, setSessions] = useState<SessionMetadata[] | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    () => sessionStorage.getItem('selectedSessionId'),
  );

  const [messages, setMessages] = useState<DisplayMessage[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [input, setInput] = useState('');
  const [model, setModel] = useState('gemini-2.5-pro');

  const accessToken = new URLSearchParams(window.location.search).get('token');

  const wsRef = useRef<WebSocket | null>(null);
  const showToastRef = useRef<
    | ((
        message: string,
        type?: 'error' | 'success' | 'info' | 'warning',
      ) => void)
    | null
  >(null);
  const streamingMessageRef = useRef<{ thought: string; text: string }>({
    thought: '',
    text: '',
  });

  const loadSessionsMetadata = useCallback(async () => {
    try {
      const url = accessToken
        ? `/api/sessions?token=${accessToken}`
        : '/api/sessions';
      const response = await fetch(url);
      if (response.ok) {
        const sessionsData: SessionMetadata[] = await response.json();
        setSessions(sessionsData);
      } else {
        console.error(
          'Failed to load sessions metadata - HTTP response not ok:',
          response.status,
          response.statusText,
        );
        setSessions([]);
      }
    } catch (error) {
      console.error(
        'Network or parsing error while loading sessions metadata:',
        error,
      );
      setSessions([]);
    }
  }, [accessToken]);

  const deserializeMessage = (
    message: Omit<PersistentMessage, 'timestamp'> & { timestamp: string },
  ) => {
    return {
      ...message,
      timestamp: new Date(message.timestamp),
    };
  };

  const switchSession = useCallback(
    async (sessionId: string | null) => {
      if (sessionId === null) {
        setSelectedSessionId(null);
        setMessages([]);
        return;
      }

      if (!sessions) return;

      const session = sessions.find((s) => s.id === sessionId);
      if (!session) {
        console.error(
          `Session with ID ${sessionId} not found in available sessions`,
        );
        return;
      }

      setSelectedSessionId(sessionId);
      setModel(session.model);
      setMessages(null);

      try {
        const url = accessToken
          ? `/api/sessions/${sessionId}/messages?token=${accessToken}`
          : `/api/sessions/${sessionId}/messages`;
        const response = await fetch(url);
        if (response.ok) {
          const messagesData = await response.json();
          const transformedMessages = messagesData.map(deserializeMessage);
          setMessages(transformedMessages);
        } else {
          console.error(
            `Failed to load messages for session ${sessionId} - HTTP response not ok:`,
            response.status,
            response.statusText,
          );
          setMessages(null);
        }
      } catch (error) {
        console.error(
          `Network or parsing error while loading messages for session ${sessionId}:`,
          error,
        );
        setMessages(null);
      }
    },
    [accessToken, sessions],
  );

  const handleInputChange = useCallback((value: string) => {
    setInput(value);
  }, []);

  const handleModelChange = useCallback((newModel: string) => {
    setModel(newModel);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim()) return;
      if (!wsRef.current) {
        console.error(
          'Cannot submit message - WebSocket connection is not available. Connection state:',
          wsRef.current,
        );
        return;
      }
      if (selectedSessionId !== null && messages === null) {
        console.error(
          `Cannot submit message - Messages not loaded for session ${selectedSessionId}.`,
        );
        return;
      }

      const inputValue = input;
      let sessionId = selectedSessionId;
      if (sessionId === null) {
        try {
          const requestBody: CreateSessionRequest = {
            name: inputValue,
            model,
          };
          const url = accessToken
            ? `/api/sessions?token=${accessToken}`
            : '/api/sessions';
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          });

          if (response.ok) {
            await loadSessionsMetadata();
            const result: CreateSessionResponse = await response.json();
            sessionId = result.id;
            setSelectedSessionId(sessionId);
          } else {
            console.error(
              'Failed to create new session - HTTP response not ok:',
              response.status,
              response.statusText,
            );
            return;
          }
        } catch (error) {
          console.error(
            'Network or parsing error while creating new session:',
            error,
          );
          return;
        }
      }

      const userMessage: DisplayMessage = {
        role: 'user',
        content: [{ text: inputValue }],
        volatile: true,
      };
      setMessages((prev) => (prev ? [...prev, userMessage] : [userMessage]));
      setInput('');
      setGenerating(true);
      streamingMessageRef.current = {
        thought: '',
        text: '',
      };

      const userInputEvent: UserInputRequest = {
        type: 'user_input',
        sessionId,
        payload: {
          input: inputValue,
          model,
        },
      };
      wsRef.current.send(JSON.stringify(userInputEvent));
    },
    [
      accessToken,
      input,
      model,
      selectedSessionId,
      messages,
      loadSessionsMetadata,
    ],
  );

  const handleToolReviewResponse = useCallback(
    async (toolReviewResponse: ToolReviewResponse) => {
      if (!wsRef.current) {
        console.error(
          'Cannot send tool review response - WebSocket connection is not available. Connection state:',
          wsRef.current,
        );
        return;
      }
      if (selectedSessionId === null) {
        console.error(
          'Cannot send tool review response - No active session selected. Current session ID:',
          selectedSessionId,
        );
        return;
      }

      const toolReviewEvent: ToolReviewResponseRequest = {
        type: 'tool_review',
        sessionId: selectedSessionId,
        payload: toolReviewResponse,
      };
      wsRef.current.send(JSON.stringify(toolReviewEvent));
    },
    [selectedSessionId],
  );

  const handleEvent = useCallback(async (serverEvent: ServerEvent) => {
    switch (serverEvent.type) {
      case 'persistent_message': {
        setMessages((prev) => {
          if (!prev) return [deserializeMessage(serverEvent.payload)];
          const lastMessage = prev[prev.length - 1];
          const persistentMessage: PersistentMessage = deserializeMessage(
            serverEvent.payload,
          );
          const messagesToKeep =
            lastMessage && lastMessage.volatile ? prev.slice(0, -1) : prev;
          return [...messagesToKeep, persistentMessage];
        });
        streamingMessageRef.current = {
          thought: '',
          text: '',
        };
        break;
      }
      case 'stream_message': {
        const streamPiece = serverEvent.payload;
        streamingMessageRef.current.thought += streamPiece.thought ?? '';
        streamingMessageRef.current.text += streamPiece.text ?? '';
        setMessages((prev) => {
          if (!prev) return [];
          const lastMessage = prev[prev.length - 1];
          const StreamingMessage: DisplayMessage = {
            role: streamPiece.role,
            content: [
              { thought: streamingMessageRef.current.thought },
              { text: streamingMessageRef.current.text },
            ].filter((block) => block.text || block.thought),
            volatile: true,
          };
          if (lastMessage && lastMessage.volatile) {
            if (lastMessage.role !== streamPiece.role) {
              throw new Error(
                `Last volatile message has different role with the new stream piece: ${lastMessage.role} !== ${streamPiece.role}`,
              );
            }
            lastMessage.content = StreamingMessage.content;
          } else {
            return [...prev, StreamingMessage];
          }
          return prev;
        });
        break;
      }
      case 'session_status': {
        const sessionStatus = serverEvent.payload;
        if (sessionStatus.status === 'running') {
          setGenerating(true);
        } else {
          setGenerating(false);
        }

        if (sessionStatus.status === 'error') {
          console.error(
            `Session ${serverEvent.sessionId} encountered an error:`,
            sessionStatus.message,
          );
        }

        setSessions((prev) => {
          if (!prev) return prev;
          return prev.map((session) =>
            session.id === serverEvent.sessionId
              ? {
                  ...session,
                  status: sessionStatus.status,
                  statusMessage: sessionStatus.message,
                }
              : session,
          );
        });
        break;
      }
      default: {
        console.error('Received unknown server event:', serverEvent);
        break;
      }
    }
  }, []);

  useEffect(() => {
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      const message = args
        .map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg)))
        .join(' ');
      if (showToastRef.current) {
        showToastRef.current(message, 'error');
      }
      originalError(...args);
    };

    return () => {
      console.error = originalError;
    };
  }, []);

  const connectWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const hostname = window.location.hostname;
    const port = window.location.port;
    const wsUrl = accessToken
      ? `ws://${hostname}:${port}/ws?token=${accessToken}`
      : `ws://${hostname}:${port}/ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connection established successfully');
    };

    ws.onmessage = (event) => {
      try {
        const serverEvent: ServerEvent = JSON.parse(event.data);
        handleEvent(serverEvent);
      } catch (error) {
        console.error(
          'Failed to parse WebSocket message as JSON:',
          error,
          'Raw message:',
          event.data,
        );
      }
    };

    ws.onclose = (event) => {
      setGenerating(false);
      console.log(
        'WebSocket connection closed.',
        'Code:',
        event.code,
        'Reason:',
        event.reason,
        'Was clean:',
        event.wasClean,
      );
    };

    ws.onerror = (error) => {
      console.error(
        'WebSocket connection error occurred.',
        'Error event:',
        error,
        'Connection state:',
        ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][ws.readyState] ?? 'UNKNOWN',
      );
      setGenerating(false);
    };
  }, [accessToken, handleEvent]);

  useEffect(() => {
    loadSessionsMetadata();
    connectWebSocket();

    return () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, [accessToken, loadSessionsMetadata, connectWebSocket]);

  useEffect(() => {
    if (selectedSessionId) {
      sessionStorage.setItem('selectedSessionId', selectedSessionId);
    } else {
      sessionStorage.removeItem('selectedSessionId');
    }
  }, [selectedSessionId]);

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    if (selectedSessionId) {
      switchSession(selectedSessionId);
    }
  }, [selectedSessionId, switchSession]);

  const startNewChat = () => {
    setSelectedSessionId(null);
    setIsMenuOpen(false);
  };

  return (
    <div className="h-[100svh] flex flex-col md:flex-row">
      <Toast
        onToast={(callback) => {
          showToastRef.current = callback;
        }}
      />
      <div className="md:hidden p-4 bg-gray-800 text-white flex justify-between items-center">
        <button onClick={() => setIsMenuOpen(!isMenuOpen)}>Sessions</button>
        <h1 className="text-xl font-bold">GACUA</h1>
        <button onClick={startNewChat}>New Chat</button>
      </div>
      <div
        className={`fixed top-0 left-0 h-full bg-gray-900 z-20 transform ${
          isMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } transition-transform md:relative md:translate-x-0 md:block`}
      >
        <Sessions
          sessions={sessions}
          currentSessionId={selectedSessionId}
          onSwitchSession={(id) => {
            setSelectedSessionId(id);
            setIsMenuOpen(false);
          }}
          onClose={() => setIsMenuOpen(false)}
        />
      </div>
      <div
        className={`fixed top-0 left-0 w-full h-full bg-black opacity-50 z-10 ${
          isMenuOpen ? 'block' : 'hidden'
        } md:hidden`}
        onClick={() => setIsMenuOpen(false)}
      ></div>
      <Chat
        messages={messages}
        currentSessionId={selectedSessionId}
        input={input}
        model={model}
        loading={generating}
        accessToken={accessToken}
        onInputChange={handleInputChange}
        onModelChange={handleModelChange}
        onSubmit={handleSubmit}
        onToolReviewResponse={handleToolReviewResponse}
      />
    </div>
  );
}

export default App;
