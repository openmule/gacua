/**
 * @license
 * Copyright 2025 MuleRun
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  SessionMetadata,
  CreateSessionRequest,
  CreateSessionResponse,
  PersistentMessage,
} from '@gacua/shared';
import { sessionRepository } from '../../repository/index.js';
import { logger } from '../../logger.js';

const sessionManagerLogger = logger.child({ module: 'session-manager' });

export class SessionManager {
  async createSession(
    requestBody: CreateSessionRequest,
  ): Promise<CreateSessionResponse> {
    const id = new Date().toISOString().replace(/[:.]/g, '-');
    sessionManagerLogger.info(
      {
        sessionId: id,
        sessionName: requestBody.name,
        model: requestBody.model,
      },
      'Creating new session',
    );

    await sessionRepository.createSession({
      id,
      name: requestBody.name,
      model: requestBody.model,
      status: 'stagnant',
    });

    await sessionRepository.appendMessages(id, []);

    const response: CreateSessionResponse = {
      id,
      message: 'Session created successfully',
    };

    sessionManagerLogger.info(
      { sessionId: id },
      'Session created successfully',
    );
    return response;
  }

  async getSession(sessionId: string): Promise<SessionMetadata> {
    sessionManagerLogger.debug({ sessionId }, 'Retrieving session metadata');
    const session = await sessionRepository.getSession(sessionId);
    return session;
  }

  async getAllSessions(): Promise<SessionMetadata[]> {
    sessionManagerLogger.debug('Retrieving all sessions');
    const sessions = await sessionRepository.getAllSessions();
    sessionManagerLogger.debug(
      { sessionCount: sessions.length },
      'Retrieved all sessions',
    );
    return sessions;
  }

  async getMessages(
    sessionId: string,
    includeHidden?: boolean,
  ): Promise<PersistentMessage[]> {
    sessionManagerLogger.debug(
      { sessionId, includeHidden },
      'Retrieving session messages',
    );
    const messages = await sessionRepository.getMessages(
      sessionId,
      includeHidden,
    );
    sessionManagerLogger.debug(
      { sessionId, messageCount: messages.length },
      'Retrieved session messages',
    );
    return messages;
  }
}
