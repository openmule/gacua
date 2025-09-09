# GACUA Troubleshooting

### Agent Captures Black Screenshots When Run via SSH on Windows

**Symptom:**

When the agent is started from an SSH session, its server process may run correctly, but it will fail to interact with the desktop. Screenshot captures will result in a black image, and mouse/keyboard simulation will have no effect.

**Cause:**

This is expected behavior due to a Windows security feature called **Session 0 Isolation**. The SSH environment is completely separate from the logged-in user's graphical desktop session. Your agent is running correctly, but it is "seeing" the empty, non-graphical session it was launched in.

**Solution:**

To function correctly, the agent must be launched within the active user's interactive desktop session. The recommended tool to accomplish this from a command line is [**PsExec**](https://learn.microsoft.com/en-us/sysinternals/downloads/psexec) from the official Microsoft Sysinternals suite.

Using PsExec, you can start the agent's process from your SSH session but direct it to run in the proper user session, giving it access to the visible desktop for screenshots and input simulation.
