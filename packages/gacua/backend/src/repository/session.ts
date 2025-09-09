/**
 * @license
 * Copyright 2025 MuleRun
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync, mkdirSync } from 'fs';
import type { PersistentMessage, SessionMetadata } from '@gacua/shared';
import { logger } from '../logger.js';

const repositoryLogger = logger.child({ module: 'repository' });

export class SessionRepository {
  private readonly baseDir: string = '.gemini/gacua_sessions';

  constructor() {
    if (!existsSync(this.baseDir)) {
      mkdirSync(this.baseDir, { recursive: true });
      repositoryLogger.info(
        { baseDir: this.baseDir },
        'Created sessions directory',
      );
    } else {
      repositoryLogger.debug(
        { baseDir: this.baseDir },
        'Sessions directory exists',
      );
    }
  }

  private getMetadataFilePath(sessionId: string): string {
    return path.join(this.baseDir, sessionId, 'metadata.json');
  }

  private getMessagesFilePath(sessionId: string): string {
    return path.join(this.baseDir, sessionId, 'messages.jsonl');
  }

  private getImagesFilePath(sessionId: string, fileName: string): string {
    return path.join(this.baseDir, sessionId, 'images', fileName);
  }

  async createSession(metadata: SessionMetadata): Promise<void> {
    const imagesDir = path.join(this.baseDir, metadata.id, 'images');
    await fs.mkdir(imagesDir, { recursive: true });
    const metadataPath = this.getMetadataFilePath(metadata.id);
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
    repositoryLogger.info(
      { sessionId: metadata.id, sessionName: metadata.name },
      'Session created in repository',
    );
  }

  async updateSession(
    sessionId: string,
    updates: Omit<Partial<SessionMetadata>, 'id'>,
  ): Promise<void> {
    const metadataPath = this.getMetadataFilePath(sessionId);
    const existingMetadata = await this.getSession(sessionId);
    const updatedMetadata: SessionMetadata = {
      ...existingMetadata,
      ...updates,
      id: existingMetadata.id,
    };
    await fs.writeFile(
      metadataPath,
      JSON.stringify(updatedMetadata, null, 2),
      'utf8',
    );
    repositoryLogger.debug({ sessionId, updates }, 'Session metadata updated');
  }

  async getSession(sessionId: string): Promise<SessionMetadata> {
    try {
      const metadataPath = this.getMetadataFilePath(sessionId);
      const content = await fs.readFile(metadataPath, 'utf8');
      const metadata = JSON.parse(content) as SessionMetadata;
      repositoryLogger.debug({ sessionId }, 'Session metadata retrieved');
      return metadata;
    } catch (error) {
      repositoryLogger.warn(
        { sessionId, err: error },
        'Failed to retrieve session metadata',
      );
      throw error;
    }
  }

  async getAllSessions(): Promise<SessionMetadata[]> {
    try {
      const sessionDirs = await fs.readdir(this.baseDir);
      const sessions: SessionMetadata[] = [];
      let skippedCount = 0;

      for (const sessionId of sessionDirs) {
        // Skip system files like .DS_Store
        if (sessionId.startsWith('.')) {
          continue;
        }

        try {
          const metadata = await this.getSession(sessionId);
          sessions.push(metadata);
        } catch (error) {
          skippedCount++;
          repositoryLogger.debug(
            { sessionId, err: error },
            'Skipping session with invalid metadata',
          );
          continue;
        }
      }

      repositoryLogger.info(
        {
          totalSessions: sessions.length,
          skippedSessions: skippedCount,
        },
        'Retrieved all sessions',
      );

      return sessions;
    } catch (error) {
      repositoryLogger.error({ err: error }, 'Failed to retrieve sessions');
      throw error;
    }
  }

  async appendMessages(
    sessionId: string,
    messages: PersistentMessage[],
  ): Promise<void> {
    try {
      const filePath = this.getMessagesFilePath(sessionId);
      const messageLines = messages.map(
        (message) => JSON.stringify(message) + '\n',
      );
      await fs.appendFile(filePath, messageLines.join(''), 'utf8');
      repositoryLogger.debug(
        { sessionId, messageCount: messages.length },
        'Messages appended to session',
      );
    } catch (error) {
      repositoryLogger.error(
        { sessionId, messageCount: messages.length, err: error },
        'Failed to append messages',
      );
      throw error;
    }
  }

  async getMessages(
    sessionId: string,
    includeHidden?: boolean,
  ): Promise<PersistentMessage[]> {
    try {
      const filePath = this.getMessagesFilePath(sessionId);
      const content = await fs.readFile(filePath, 'utf8');
      const messages: PersistentMessage[] = content
        .split('\n')
        .filter((line) => line.trim() !== '')
        .map((line) => JSON.parse(line) as PersistentMessage);

      const filteredMessages = includeHidden
        ? messages
        : messages.filter((message) => message.forDisplay !== false);

      repositoryLogger.debug(
        {
          sessionId,
          totalMessages: messages.length,
          displayedMessages: filteredMessages.length,
          includeHidden,
        },
        'Messages retrieved from session',
      );

      return filteredMessages;
    } catch (error) {
      repositoryLogger.error(
        { sessionId, includeHidden, err: error },
        'Failed to retrieve messages',
      );
      throw error;
    }
  }

  async saveImage(
    imageBuffer: Buffer,
    sessionId: string,
    fileName: string,
  ): Promise<void> {
    try {
      const filePath = this.getImagesFilePath(sessionId, fileName);
      await fs.writeFile(filePath, imageBuffer);
      repositoryLogger.debug(
        { sessionId, fileName, imageSize: imageBuffer.length },
        'Image saved to session',
      );
    } catch (error) {
      repositoryLogger.error(
        { sessionId, fileName, err: error },
        'Failed to save image',
      );
      throw error;
    }
  }

  async getImage(sessionId: string, fileName: string): Promise<Buffer> {
    try {
      const filePath = this.getImagesFilePath(sessionId, fileName);
      const imageBuffer = await fs.readFile(filePath);
      repositoryLogger.debug(
        { sessionId, fileName, imageSize: imageBuffer.length },
        'Image retrieved from session',
      );
      return imageBuffer;
    } catch (error) {
      repositoryLogger.warn(
        { sessionId, fileName, err: error },
        'Failed to retrieve image',
      );
      throw error;
    }
  }
}
