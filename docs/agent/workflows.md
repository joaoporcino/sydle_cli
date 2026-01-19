# Common Workflows

## Creating a New Class (Local + Publish)
1. Run `sydle createClass <package> <name>`
   - Interactive prompts for type, fields
   - Creates local files with `_revision: "0"`
2. Run `sydle sync <package>.<class>` to publish to Sydle
   - Creates class in Sydle
   - Syncs fields from `fields.js`
   - Updates local `class.json` with new `_id`

## Creating a New Method
**Option A: Using CLI (Recommended)**
1. Run `sydle createMethod <package> <class> <method>`
2. The CLI scaffolds all files.
3. If `watch` is running, it will automatically sync.

**Option B: Manual Folder Creation (via Watch)**
1. Ensure `sydle watch` is running for the package.
2. Create a new directory inside the Class folder.
3. The CLI scaffolds: `method.json`, `scripts/script_0.js`, `jsconfig.json`
4. Edit `script_0.js`. Saving triggers sync to Sydle.

## Deleting a Method
1. Run `sydle deleteMethod <package> <class> <method>`.
2. Confirm deletion to remove from Sydle.
   - **System Methods** (`_*`) cannot be deleted.

## Editing Code
1. Modify `script_N.js`.
2. Save the file.
3. Watch detects change -> Updates `method.json` -> Patches Sydle.

## Editing Fields
1. Edit `fields.js` in the class folder.
2. Run `sydle sync <package>.<class>` or save while `watch` is running.
3. Fields are merged and synced to Sydle.
