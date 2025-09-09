<div align="center">
<img width="1730" height="521" alt="logo-11" src="https://github.com/user-attachments/assets/5550063b-7ff8-4c1f-b511-83f48ac862fe" />
</div>

<div align="center">
  <a href="https://discord.gg/KK3zXcMkhg">
    <img src="https://img.shields.io/discord/1375677271825846432?color=5865F2&logo=discord&logoColor=white&label=Discord&labelColor=5865F2" alt="Discord">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-Apache%202.0-green.svg" alt="License">
  </a>
</div>

<br>

<p align="center">
  <a href="https://blog.mulerun.com/p/gacua-a-free-and-open-source-computer-use-agent-for-developers/">Blog</a> •
  <a href="#showcases">Showcases</a> •
  <a href="#why-gacua">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#development">Development</a> •
  <a href="#roadmap">Roadmap</a>
</p>

## Stay Ahead

**Star GACUA** on GitHub to be instantly notified of updates. Your support means everything to us! ❤️

<div align="center">
<img width="250" height="175" alt="star" src="https://github.com/user-attachments/assets/b3f60290-b977-4445-a45f-9e620dfa2640" />
</div>

## Showcases

**GACUA** (**G**emini CLI **a**s **C**omputer **U**se **A**gent) is the world's **first** out-of-the-box computer use agent powered by [Gemini CLI](https://github.com/google-gemini/gemini-cli).

<div align="center">
  <table>
    <tr>
      <td align="center" width="50%">
        <video src="https://github.com/user-attachments/assets/a7453eb9-a9a0-438b-b3d2-35dc871d6191" width="400" controls></video>
      </td>
      <td align="center" width="50%">
        <video src="https://github.com/user-attachments/assets/44b9b90e-5f1c-4d80-97f6-3f44ee377170" width="400" controls></video>
      </td>
    </tr>
    <tr>
      <td align="center" width="50%">
        <video src="https://github.com/user-attachments/assets/d6d614e4-2e66-4b5c-8c2b-43f9dec1f362" width="400" controls></video>
      </td>
      <td align="center" width="50%">
        <video src="https://github.com/user-attachments/assets/f60ab6c8-2d4f-4af7-9cdb-e7acfd65cd51" width="400" controls></video>
      </td>
    </tr>
  </table>
</div>

## Why GACUA?

GACUA extends the core capabilities of [Gemini CLI](https://github.com/google-gemini/gemini-cli) to provide a robust agentic experience. It enables you to:

- 💻 **Enjoy Out-of-the-Box Computer Use**: Get started with a single command. GACUA provides a free and immediate way to experience computer use, from assisting with gameplay, installing software, and more.
- 🎯 **Execute Tasks with High Accuracy**: GACUA enhances Gemini 2.5 Pro's grounding capability through a "Image Slicing + Two-Step Grounding" method.
- 🔬 **Gain Step-by-Step Control & Observability**: Unlike black-box agents, GACUA offers a transparent, step-by-step execution flow. You can review, accept, or reject each action the agent proposes, giving you full control over the task's completion.
- 🌐 **Enable Remote Operation**: You can access your agent from a separate device. The agent runs in its own independent environment, so you no longer have to "fight" with it for mouse and keyboard control while the agent works.

For the Technical Journey Behind GACUA, see [GACUA: A Free and Open-Source Computer Use Agent for Developers](https://blog.mulerun.com/p/gacua-a-free-and-open-source-computer-use-agent-for-developers/).

## Quick Start

Get up and running with GACUA in just a few steps.

### Prerequisites

- **Node.js ≥ 20**: GACUA is built on [Node.js](https://nodejs.org/en/download/). The installer will also install npm.
- **Gemini Authentication:** GACUA needs to authenticate with the Gemini API. While [Gemini CLI](https://github.com/google-gemini/gemini-cli) is not required to run GACUA, the easiest way to set up authentication is by installing and configuring the [Gemini CLI](https://github.com/google-gemini/gemini-cli) first. GACUA will automatically reuse the configuration created by it.

### Steps

Simply run the following command to start GACUA.

```bash
npx @gacua/backend
```

This command uses `npx` to download and run the GACUA backend package without needing to install it globally. The first time you run this, it may take a few moments to download the necessary files.

To see detailed installation progress, run the following command.

```bash
npx --verbose @gacua/backend
```

Alternatively, you can install GACUA globally using npm. This will install the GACUA package on your system, allowing you to run it from any directory by simply typing `gacua`.

```bash
npm install -g @gacua/backend && gacua
```

Follow the on-screen prompts to complete the setup. Once the setup is finished, you can access the GACUA server from a web browser on your controlling device.

> \[!IMPORTANT]
>
> **Network Configuration**
>
> GACUA operates as a local web server, allowing you to control your PC from another device, like a mobile phone. For this to work, **both devices must be on the same network**.
>
> - **Connect to the same Wi-Fi:** The simplest method is to connect your computer and your controlling device (e.g., your phone) to the same Wi-Fi network.
> - **Use a mobile hotspot:** If you don't have a shared Wi-Fi network, you can use your phone's hotspot and connect your computer to it.
> - **Check your firewall:** Your computer's firewall might block incoming connections. If you can't connect, ensure that your firewall settings allow access to the port GACUA is running on. You may need to create a new inbound rule for Node.js or the specific port.

## [Advanced] Running GACUA in Decoupled Mode

GACUA includes a specialized MCP tool for computer control and operates as a web server. This architecture creates a seamless connection between the computer you want to control and the device you're using to issue commands.

By default, GACUA runs as an all-in-one application. However, for more advanced use cases, such as controlling a computer on a different network, you can run its core components separately.

This "decoupled mode" separates GACUA's **🧠 Brain** (which requires API access) from its **💪 Body** (which executes commands), allowing them to operate on different machines.

> \[!IMPORTANT]
>
> A stable network connection between the two machines is crucial for this mode to function correctly.

1. Start the MCP computer server (the **💪 Body**).

   On the **computer you want to control**, run the following command. This machine **does not** need your Gemini API keys.

   ```bash
   npx @gacua/mcp-computer --host <MCP_HOST> --port <MCP_PORT>
   ```

   This command starts the MCP server, which will listen for commands to execute on the local machine.

2. Launch the GACUA backend (**the 🧠 Brain**).

   On the **controlling device** with authenticated access to the Gemini API, run the following command:

   ```bash
   GACUA_MCP_COMPUTER_URL=http://<MCP_HOST>:<MCP_PORT>/mcp npx @gacua/backend
   ```

   `GACUA_MCP_COMPUTER_URL`: it tells the "Brain" the endpoint of the "Body" you started in the previous step.

## Development

Interested in contributing to GACUA? Here’s how you can get your development environment set up and run the project from source.

### Initial Setup

After cloning the repository, you need to install the dependencies and perform an initial build.

1.  Install all package dependencies.

    ```bash
    npm install
    ```

2.  Build all packages.

    This command compiles all the packages within the monorepo.

    ```bash
    npm run build
    ```

### Run in Development Mode

For active development, this mode provides hot-reloading for the frontend and backend.

Start development servers.

```bash
npm run dev:gacua
```

This command starts the Vite frontend server (on port `5173`) and the Express backend server (on port `3000`). Follow the link printed in your terminal, but **remember to change the backend URL's port from `3000` to `5173` in the UI**. The Vite server is configured to proxy requests to the backend.

> \[!IMPORTANT]
>
> The `dev` command only watches for changes in the `@gacua/backend` and `@gacua/frontend` packages. If you modify any other package, you will need to stop the server and run `npm run build` again.

### Run After Building (Production Simulation)

To run the application as it would be in production, where the backend serves the built frontend files.

1.  Build the project (if you have new changes).

    ```bash
    npm run build
    ```

2.  Start the application.

    ```bash
    npm run start:gacua
    ```

In this mode, the frontend artifacts are served by the backend, so you can access the entire application on port `3000`.

### Testing the Local Binary with npx

To test the `gacua` command-line interface from your local build (simulating how a user would run it), follow these steps carefully.

1.  Install dependencies.

    ```bash
    npm install
    ```

2.  Build all packages.

    ```bash
    npm run build
    ```

3.  Install again to link the binary.

    ```bash
    npm install
    ```

    This second `npm install` is crucial. After the `build` step creates the executable files, this command links the local `gacua` binary into the `node_modules/.bin` directory, making it available to `npx`.

4.  Run GACUA.

    ```bash
    npx gacua
    ```

## Learn More

- [GACUA: A Free and Open-Source Computer Use Agent for Developers](https://blog.mulerun.com/p/gacua-a-free-and-open-source-computer-use-agent-for-developers/): The technical journey behind GACUA, GACUA’s design philosophy, our thoughts on the future, and more.
- [Under the Hood: GACUA's Architecture](docs/gacua/architecture.md): A deep dive into GACUA's core decoupled components.
- [Troubleshooting](docs/gacua/troubleshooting.md): Solutions to common issues, such as the agent capturing black screenshots when run via SSH.

## Roadmap

GACUA is just getting started. Here are some of the key directions we can explore to make GACUA more powerful, flexible, and reliable.

- [ ] **Enhanced grounding**

  <details>
  <summary>Details</summary>

  To further improve grounding accuracy, we can adopt a "heavy mode". This mode calls the model twice consecutively (with varying temperatures). If the bounding box overlap exceeds 50%, then the overlap is adopted as the result. Otherwise, the process is repeated until two consecutive results exceed 50%.

  </details>

- [ ] **Pluggable agent architecture**

  <details>
  <summary>Details</summary>

  GACUA's architecture decouples the Interface from the Agent, which allows you to replace various components——including models, tools, system prompts, and workflows. Additionally, you can leverage the GACUA UI for debugging, as it shows the entire "Planning" and "Grounding" process. Moreover, you can also use GACUA for rapidly testing and benchmarking different vision models.

  </details>

- [ ] **Autonomous tool & skill acquisition**

  <details>
  <summary>Details</summary>

  Repetitive sub-tasks, like "opening a specific webpage in Chrome," are inefficient and token-intensive. You can empower GACUA to recognize and summarize these recurring operational patterns, automatically creating new, persistent tools. These self-generated tools can then be called by the agent in future runs, allowing it to learn and continuously improve its capabilities over time.

  </details>

- [ ] **CLI mode**

  <details>
  <summary>Details</summary>

  Once GACUA's capabilities are robust enough for users to trust it with full autonomy, we can introduce a CLI mode (similar to [Gemini CLI](https://github.com/google-gemini/gemini-cli)). This will also allow GACUA to function as a standardized tool that can be used by other agents.

  </details>

- [ ] **Prompt management**

  <details>
  <summary>Details</summary>

  To improve efficiency, we can optimize manage complex prompts. This will allow you to save long, frequently used prompts as configurations and reference them later with a simple @alias (a form of manual RAG), keeping your process streamlined.

  </details>

## Acknowledgement

GACUA is built on top of [Gemini CLI](https://github.com/google-gemini/gemini-cli) and inspired by [Agent-S](https://github.com/simular-ai/Agent-S) and [nut.js](https://github.com/nut-tree/nut.js). We're grateful for their contributions.

## License

GACUA is licensed under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0).
