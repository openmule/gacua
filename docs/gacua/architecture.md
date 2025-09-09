# GACUA Architecture

GACUA is a multi-package project designed to enable a Gemini-based AI agent to interact with and control a computer's graphical user interface. It combines a web-based frontend, a backend server, a computer control module, and shared libraries to provide a comprehensive framework for GUI automation tasks.

## Packages

The GACUA functionality is split across several packages within the `@gacua` scope.

### `@gacua/backend`

This is the core backend service that orchestrates the entire system. It is an Express.js application responsible for:

- **Authentication**: Manages authentication with Google's Gemini API, supporting various methods like `Login with Google`, `Cloud Shell`, and API keys (`src/auth/gemini.ts`).
- **Session Management**: Handles the lifecycle of user sessions, including creation, persistence, and retrieval of chat history. Sessions are stored on the file system in `.gemini/gacua_sessions` (`src/repository/session.ts`, `src/services/session/manager.ts`).
- **Agent Logic**: Contains the primary agent loop that takes user input, interacts with the Gemini model, and orchestrates tool calls (`src/services/computer-use/agent.ts`).
- **WebSockets**: Uses a WebSocket server to facilitate real-time, bidirectional communication with the frontend for streaming responses and status updates (`src/ws/index.ts`).
- **HTTP API**: Provides a RESTful API for session management and serving images (`src/server.ts`).
- **Logging**: Implements structured logging using `pino` for diagnostics and monitoring (`src/logger.ts`).

### `@gacua/frontend`

A React-based single-page application that serves as the user interface for interacting with the GACUA agent.

- **Framework**: Built with React, Vite, and TypeScript.
- **Styling**: Uses Tailwind CSS for styling.
- **Communication**: Connects to the backend via WebSockets for real-time chat and receives an access token via URL query parameters for authentication.
- **Components**: Features components for displaying chat messages, managing sessions, handling user input, and reviewing tool calls (`src/components/*`).
- **State Management**: Manages application state using React hooks (`useState`, `useEffect`, `useCallback`).

### `@gacua/mcp-computer`

A standalone server that implements the Model Context Protocol (MCP) to expose computer control capabilities as a tool. It uses the `@nut-tree-fork/nut-js` library to programmatically control the mouse and keyboard.

- **Actions**: Provides actions like `click`, `type`, `drag_and_drop`, `scroll`, `key`, `wait`, and `screenshot` (`src/actions.ts`).
- **Preflight Checks**: On macOS, it performs checks for necessary permissions (Screen Recording, Accessibility) and dependencies (Xcode Command Line Tools) before starting (`src/preflight-check.ts`).
- **MCP Server**: Exposes the computer actions as an MCP tool named `.computer` that the backend agent can call (`src/server.ts`).

### `@gacua/shared`

A small, crucial package containing shared TypeScript types and interfaces used across the `frontend` and `backend`. This ensures type safety and consistency in the data exchanged between the two packages.

- **Types**: Defines core data structures like `SessionMetadata`, `PersistentMessage`, `ClientRequest`, and `ServerEvent` (`src/types.ts`).

## Architecture

GACUA's architecture is designed for modularity and real-time interaction.

1.  **Frontend ↔ Backend**: The user interacts with the React **Frontend**. All communication with the **Backend** happens over a WebSocket connection, which is used for sending user prompts, tool review decisions, and receiving real-time streams of the agent's thoughts, actions, and messages. A simple REST API is also used for initial session data loading.
2.  **Backend → MCP Computer**: When the agent in the **Backend** decides to perform a computer action, it makes a tool call to the **MCP Computer** server. This communication follows the Model Context Protocol over HTTP.
3.  **Backend → Gemini API**: The backend's agent communicates with the Gemini API to get model responses, plan next steps, and ground its actions based on visual input.

## Key Concepts

### Agent and Screen Grounding

The core of GACUA is the `runAgent` function (`@gacua/backend/src/services/computer-use/agent.ts`). The agent operates in a loop:

1.  **Take Screenshot**: The agent captures the current screen using the `.computer` tool.
2.  **Crop and Process**: The screenshot is processed and cropped into multiple overlapping squares to create a set of images that the model can analyze (`screen.ts`). This allows the model to focus on specific parts of the screen.
3.  **Plan**: The agent, along with the chat history and the latest screenshots, is passed to the Gemini model, which then plans the next action by calling one of the available computer tools.
4.  **Grounding**: For tools that require interaction with a UI element (e.g., `computer_click`), the agent performs a "grounding" step. It uses a vision-capable model (`gemini-2.5-pro`) to find the bounding box of the described element within one of the cropped screenshots.
5.  **Execution & Review**: The grounded tool call is then presented to the user for review. If approved (or if auto-approved), the backend executes the action by calling the MCP Computer server.
6.  **Repeat**: The process repeats, creating a feedback loop where the agent observes the screen, acts, and observes the result.

### Tool Definitions

The agent's capabilities are defined by a set of "groundable tools" (`@gacua/backend/src/services/computer-use/tool-computer/`). These are high-level abstractions like `computer_click` or `computer_type`. The `ground` method on each tool is responsible for taking the high-level arguments (e.g., "click on the 'File' menu") and translating them into concrete coordinates for the low-level `.computer` tool by using the visual grounding process.
