# Command: sydle sincronizar (Alias: sync)

**Usage**: `sydle sync [path]`

Where `path` can be:
- `package` - Sync all classes in package
- `package.class` - Sync specific class
- `package.class.method` - Sync specific method

## Features

### 1. Class Creation
- Detects locally-created classes with `_revision: "0"`
- Automatically **publishes new classes** to Sydle
- Updates local `class.json` with new `_id` and `_revision`

### 2. Fields Synchronization
- Reads `fields.js` files and syncs to Sydle
- Merges user fields with system fields
- Preserves existing field `_id`s

### 3. Method Synchronization
- Syncs `script_*.js` files to methods in Sydle
- Skips system methods (`_*`) without custom scripts
- Creates new methods if not existing in Sydle

## Example Output
```
Created classes: 1
Synced fields: 1
Skipped (no scripts): 15
```
