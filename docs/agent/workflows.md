# Common Workflows

## Creating a New Method
**Option A: Using CLI (Recommended for Agents)**
1. Run `sydle criarMetodo <package> <class> <method>`
   - Example: `sydle criarMetodo recursosHumanos Aprendiz calcularFerias`
2. The CLI scaffolds all files.
3. If `watch` is running, it will automatically sync the new "empty" method structure.

**Option B: Manual Folder Creation (via Watch)**
1. Ensure `sydle watch` is running for the package.
2. Create a new directory inside the Class folder (e.g., `sydle-dev/HumanResources/Employee/newMethod`).
3. The CLI detects the folder and SCAFFOLDS:
   - `method.json` (with defaults: GRAAL, PUBLIC)
   - `scripts/script_0.js`
   - `scripts/jsconfig.json` (for IntelliSense)
4. Wait for the CLI to log "Scaffolding complete".
5. Edit `script_0.js`. Saving it triggers a sync to Sydle.

## Deleting a Method
**Option A: Using CLI (Recommended for Agents)**
1. Run `sydle excluirMetodo <package> <class> <method>`.
2. The CLI detects the local folder, deletes it, and prompts to remove from Sydle.
   - If User/Agent confirms: Deleted from Sydle.
   - If User/Agent declines: Folder is restored (Rollback).

**Option B: Manual Deletion (via Watch)**
1. Ensure `sydle watch` is running.
2. Delete the method folder locally.
3. The CLI prompts for confirmation (Y/n).
   - If `Y`: Method is removed from Sydle.
   - If `n`: Folder is restored (Rollback).
   - **System Methods**: Folders starting with `_` (e.g., `_getMetadata`) are AUTO-RESTORED. You cannot delete them via CLI.

## Editing Code
1. Modify `script_N.js`.
2. Save the file.
3. Watch command detects change -> Updates `method.json` scripts list -> Patches Sydle entity.
