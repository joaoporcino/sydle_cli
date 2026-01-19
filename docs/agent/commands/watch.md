# Command: sydle monitorar (Alias: watch)

**Usage**: `sydle watch [package]`

## Features
- **File Watching**: Monitors `**/scripts/script_*.js` and `**/fields.js`.
- **Auto-Sync**: Debounced sync on file save.
- **Fields Sync**: Automatically syncs `fields.js` changes to Sydle.
- **Scaffolding**: Detects new folders at depth 3 (Package/Class/Method) and creates required structure.
- **Deletion**: Detects folder deletion and syncs removal (with confirmation).
- **Protection**: Protects system methods (`_*`).

## AI Behavior Guidelines
- To create a method: just create the folder and let the watcher scaffold it.
- To delete a method: delete the folder (watcher will prompt for confirmation).
