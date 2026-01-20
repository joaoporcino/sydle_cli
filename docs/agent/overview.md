# Sydle CLI - AI Agent Overview

This CLI allows you to manage Sydle system entities (Classes, Methods, Fields) directly from the file system.

## Key Concepts
- **Root Folder**: `sydle-env` (e.g., `sydle-dev`). Use `process.cwd()` or find this folder to locate source code.
- **Structure**: `Package/Class/Method`.
- **Authentication**: Handled automatically via `authFlow.js`. If a command fails with 401, suggest `sydle login`.

## Core Commands for Agents
- [x] **sydle obterPacote**: (Alias: `getPackage`) Fetches all classes from a package.
- [x] **sydle criarClasse**: (Alias: `createClass`) Creates a new class **locally**. Use `sync` to publish to Sydle.
- [x] **sydle sincronizar <path>**: (Alias: `sync`) Syncs classes, fields, and methods to Sydle. **Creates new classes automatically**.
- [x] **sydle monitorar <package>**: (Alias: `watch`) Monitors changes and syncs automatically.
- [x] **sydle criarMetodo**: (Alias: `createMethod`) Scaffolds a new method.
- [x] **sydle excluirMetodo**: (Alias: `deleteMethod`) Deletes a method folder and removes it from Sydle.
- [x] **sydle obterClasse <id>**: (Alias: `getClass`) Fetches a class definition.
- [x] **sydle listarInstancia**: (Alias: `listInstance`) Search/list class instances.
- [x] **sydle obterInstancia**: (Alias: `getInstance`) Downloads an instance for local editing.
- [x] **sydle atualizarInstancia**: (Alias: `updateInstance`) Uploads local instance changes to Sydle.

## Class Creation Workflow
1. `sydle createClass <package> <name>` - Creates class locally with `_revision: "0"`
2. `sydle sync <package>.<class>` - Publishes class to Sydle, updates local `_id`
