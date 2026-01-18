# Command: sydle monitorar (Alias: watch)

**Usage**: `sydle monitorar [package]`

## Features
- **File Watching**: Monitors `**/scripts/script_*.js`.
- **Auto-Sync**: Debounced sync on file save. Updates the entire method definition.
- **Scaffolding**: Detects new folders at depth 3 (Package/Class/Method) and creates required structure.
- **Deletion**: Detects folder deletion and syncs removal (with confirmation).
- **Protection**: Ignored non-script files to prevent loops. Protects system methods (`_*`).

## AI Behavior Guidelines
- If the user asks to "create a method", advise them to just create the folder and let the watcher handle the config.
- If the user asks to "delete a method", advise them to delete the folder (and handle the CLI prompt if strictly interactive, or warn about the prompt).
