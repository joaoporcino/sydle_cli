const fs = require('fs');
const path = require('path');

function generateAiDocs(rootPath) {
    const docsDir = path.join(rootPath, 'docs', 'agent');
    const commandsDir = path.join(docsDir, 'commands');

    if (!fs.existsSync(commandsDir)) {
        fs.mkdirSync(commandsDir, { recursive: true });
    }

    // 1. Overview
    fs.writeFileSync(path.join(docsDir, 'overview.md'), `# Sydle CLI - AI Agent Overview

This CLI allows you to manage Sydle system entities (Classes, Methods) directly from the file system.

## Key Concepts
- **Root Folder**: \`sydle-env\` (e.g., \`sydle-dev\`). Use \`process.cwd()\` or find this folder to locate source code.
- **Structure**: \`Package/Class/Method\`.
- **Authentication**: Handled automatically via \`authFlow.js\`. If a command fails with 401, suggest \`sydle login\`.

## Core Commands for Agents
- \`sydle monitorar <package>\`: (Alias: \`watch\`) Monitors changes. The most powerful command. 
- \`sydle sincronizar <package>\`: (Alias: \`sync\`) Manual synchronization.
- \`sydle criarMetodo\`: Scaffolds a new method (interactive or with args).
- \`sydle excluirMetodo\`: Deletes a method folder and removes it from Sydle.
- \`sydle obterClasse <id>\`: (Alias: \`getClass\`) Fetches a class definition.
`);

    // 2. Workflows
    fs.writeFileSync(path.join(docsDir, 'workflows.md'), `# Common Workflows

## Creating a New Method
**Option A: Using CLI (Recommended for Agents)**
1. Run \`sydle criarMetodo <package> <class> <method>\`
   - Example: \`sydle criarMetodo recursosHumanos Aprendiz calcularFerias\`
2. The CLI scaffolds all files.
3. If \`watch\` is running, it will automatically sync the new "empty" method structure.

**Option B: Manual Folder Creation (via Watch)**
1. Ensure \`sydle watch\` is running for the package.
2. Create a new directory inside the Class folder (e.g., \`sydle-dev/HumanResources/Employee/newMethod\`).
3. The CLI detects the folder and SCAFFOLDS:
   - \`method.json\` (with defaults: GRAAL, PUBLIC)
   - \`scripts/script_0.js\`
   - \`scripts/jsconfig.json\` (for IntelliSense)
4. Wait for the CLI to log "Scaffolding complete".
5. Edit \`script_0.js\`. Saving it triggers a sync to Sydle.

## Deleting a Method
**Option A: Using CLI (Recommended for Agents)**
1. Run \`sydle excluirMetodo <package> <class> <method>\`.
2. The CLI detects the local folder, deletes it, and prompts to remove from Sydle.
   - If User/Agent confirms: Deleted from Sydle.
   - If User/Agent declines: Folder is restored (Rollback).

**Option B: Manual Deletion (via Watch)**
1. Ensure \`sydle watch\` is running.
2. Delete the method folder locally.
3. The CLI prompts for confirmation (Y/n).
   - If \`Y\`: Method is removed from Sydle.
   - If \`n\`: Folder is restored (Rollback).
   - **System Methods**: Folders starting with \`_\` (e.g., \`_getMetadata\`) are AUTO-RESTORED. You cannot delete them via CLI.

## Editing Code
1. Modify \`script_N.js\`.
2. Save the file.
3. Watch command detects change -> Updates \`method.json\` scripts list -> Patches Sydle entity.
`);

    // 3. Commands: Monitorar (Watch)
    fs.writeFileSync(path.join(commandsDir, 'watch.md'), `# Command: sydle monitorar (Alias: watch)

**Usage**: \`sydle monitorar [package]\`

## Features
- **File Watching**: Monitors \`**/scripts/script_*.js\`.
- **Auto-Sync**: Debounced sync on file save. Updates the entire method definition.
- **Scaffolding**: Detects new folders at depth 3 (Package/Class/Method) and creates required structure.
- **Deletion**: Detects folder deletion and syncs removal (with confirmation).
- **Protection**: Ignored non-script files to prevent loops. Protects system methods (\`_*\`).

## AI Behavior Guidelines
- If the user asks to "create a method", advise them to just create the folder and let the watcher handle the config.
- If the user asks to "delete a method", advise them to delete the folder (and handle the CLI prompt if strictly interactive, or warn about the prompt).
`);

    // 4. Commands: Sincronizar (Sync)
    fs.writeFileSync(path.join(commandsDir, 'sync.md'), `# Command: sydle sincronizar (Alias: sync)

**Usage**: \`sydle sincronizar [package] [class] [method]\`

## Features
- Manual synchronization.
- Iterates through local files and pushes to Sydle.
- **Legacy behavior**: Unlike \`watch\`, this might not auto-create methods if \`method.json\` is missing (though shared core logic handles creation now).
`);

    // 5. Commands: Create/Delete
    fs.writeFileSync(path.join(commandsDir, 'create-delete.md'), `# Commands: Creation & Deletion

## sydle criarMetodo
**Alias**: \`createMethod\`
**Usage**: \`sydle criarMetodo [package] [class] [method]\`
- Scaffolds the method structure (**method.json**, **scripts/**, **jsconfig.json**, types).
- Use this instead of creating files manually to ensure correct config.
- If arguments are omitted, launches an interactive prompt.

## sydle excluirMetodo
**Alias**: \`deleteMethod\`
**Usage**: \`sydle excluirMetodo [package] [class] [method]\`
- Deletes the local folder AND handles Sydle deletion.
- **Safety**: Includes confirmation prompt and auto-rollback if deletion is declined.
- **Protection**: Cannot delete system methods (\`_*\`) - triggers auto-rollback.
`);

    console.log(`✨ Generated AI Docs at ${docsDir}`);
}

module.exports = { generateAiDocs };
