# Sydle CLI - AI Agent Overview

This CLI allows you to manage Sydle system entities (Classes, Methods) directly from the file system.

## Key Concepts
- **Root Folder**: `sydle-env` (e.g., `sydle-dev`). Use `process.cwd()` or find this folder to locate source code.
- **Structure**: `Package/Class/Method`.
- **Authentication**: Handled automatically via `authFlow.js`. If a command fails with 401, suggest `sydle login`.

## Core Commands for Agents
- `sydle monitorar <package>`: (Alias: `watch`) Monitors changes. The most powerful command. 
- `sydle sincronizar <package>`: (Alias: `sync`) Manual synchronization.
- `sydle criarMetodo`: Scaffolds a new method (interactive or with args).
- `sydle excluirMetodo`: Deletes a method folder and removes it from Sydle.
- `sydle obterClasse <id>`: (Alias: `getClass`) Fetches a class definition.
