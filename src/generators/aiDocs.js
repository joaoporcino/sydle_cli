const fs = require('fs');
const path = require('path');

function generateAiDocs(rootPath) {
  const docsDir = path.join(rootPath, 'docs', 'agent');
  const commandsDir = path.join(docsDir, 'commands');

  if (!fs.existsSync(commandsDir)) {
    fs.mkdirSync(commandsDir, { recursive: true });
  }

  // 1. Overview
  const overview = `# Sydle CLI - AI Agent Overview

This CLI allows you to manage Sydle system entities (Classes, Methods, Fields) directly from the file system.

## Key Concepts
- **Root Folder**: \`sydle-env\` (e.g., \`sydle-dev\`). Use \`process.cwd()\` or find this folder to locate source code.
- **Structure**: \`Package/Class/Method\`.
- **Authentication**: Handled automatically via \`authFlow.js\`. If a command fails with 401, suggest \`sydle login\`.

## Core Commands for Agents
- \`sydle criarClasse\`: (Alias: \`createClass\`) Creates a new class **locally**. Use \`sync\` to publish to Sydle.
- \`sydle sincronizar <path>\`: (Alias: \`sync\`) Syncs classes, fields, and methods to Sydle. **Creates new classes automatically**.
- \`sydle monitorar <package>\`: (Alias: \`watch\`) Monitors changes and syncs automatically.
- \`sydle criarMetodo\`: (Alias: \`createMethod\`) Scaffolds a new method.
- \`sydle excluirMetodo\`: (Alias: \`deleteMethod\`) Deletes a method folder and removes it from Sydle.
- \`sydle obterClasse <id>\`: (Alias: \`getClass\`) Fetches a class definition.

## Class Creation Workflow
1. \`sydle createClass <package> <name>\` - Creates class locally with \`_revision: "0"\`
2. \`sydle sync <package>.<class>\` - Publishes class to Sydle, updates local \`_id\`
`;
  fs.writeFileSync(path.join(docsDir, 'overview.md'), overview);

  // 2. Workflows
  const workflows = `# Common Workflows

## Creating a New Class (Local + Publish)
1. Run \`sydle createClass <package> <name>\`
   - Interactive prompts for type, fields
   - Creates local files with \`_revision: "0"\`
2. Run \`sydle sync <package>.<class>\` to publish to Sydle
   - Creates class in Sydle
   - Syncs fields from \`fields.js\`
   - Updates local \`class.json\` with new \`_id\`

## Creating a New Method
**Option A: Using CLI (Recommended)**
1. Run \`sydle createMethod <package> <class> <method>\`
2. The CLI scaffolds all files.
3. If \`watch\` is running, it will automatically sync.

**Option B: Manual Folder Creation (via Watch)**
1. Ensure \`sydle watch\` is running for the package.
2. Create a new directory inside the Class folder.
3. The CLI scaffolds: \`method.json\`, \`scripts/script_0.js\`, \`jsconfig.json\`
4. Edit \`script_0.js\`. Saving triggers sync to Sydle.

## Deleting a Method
1. Run \`sydle deleteMethod <package> <class> <method>\`.
2. Confirm deletion to remove from Sydle.
   - **System Methods** (\`_*\`) cannot be deleted.

## Editing Code
1. Modify \`script_N.js\`.
2. Save the file.
3. Watch detects change -> Updates \`method.json\` -> Patches Sydle.

## Editing Fields
1. Edit \`fields.js\` in the class folder.
2. Run \`sydle sync <package>.<class>\` or save while \`watch\` is running.
3. Fields are merged and synced to Sydle.
`;
  fs.writeFileSync(path.join(docsDir, 'workflows.md'), workflows);

  // 3. Commands: Watch
  const watch = `# Command: sydle monitorar (Alias: watch)

**Usage**: \`sydle watch [package]\`

## Features
- **File Watching**: Monitors \`**/scripts/script_*.js\` and \`**/fields.js\`.
- **Auto-Sync**: Debounced sync on file save.
- **Fields Sync**: Automatically syncs \`fields.js\` changes to Sydle.
- **Scaffolding**: Detects new folders at depth 3 (Package/Class/Method) and creates required structure.
- **Deletion**: Detects folder deletion and syncs removal (with confirmation).
- **Protection**: Protects system methods (\`_*\`).

## AI Behavior Guidelines
- To create a method: just create the folder and let the watcher scaffold it.
- To delete a method: delete the folder (watcher will prompt for confirmation).
`;
  fs.writeFileSync(path.join(commandsDir, 'watch.md'), watch);

  // 4. Commands: Sync
  const sync = `# Command: sydle sincronizar (Alias: sync)

**Usage**: \`sydle sync [path]\`

Where \`path\` can be:
- \`package\` - Sync all classes in package
- \`package.class\` - Sync specific class
- \`package.class.method\` - Sync specific method

## Features

### 1. Class Creation
- Detects locally-created classes with \`_revision: "0"\`
- Automatically **publishes new classes** to Sydle
- Updates local \`class.json\` with new \`_id\` and \`_revision\`

### 2. Fields Synchronization
- Reads \`fields.js\` files and syncs to Sydle
- Merges user fields with system fields
- Preserves existing field \`_id\`s

### 3. Method Synchronization
- Syncs \`script_*.js\` files to methods in Sydle
- Skips system methods (\`_*\`) without custom scripts
- Creates new methods if not existing in Sydle

## Example Output
\`\`\`
Created classes: 1
Synced fields: 1
Skipped (no scripts): 15
\`\`\`
`;
  fs.writeFileSync(path.join(commandsDir, 'sync.md'), sync);

  // 5. Commands: Create/Delete
  const createDelete = `# Commands: Creation & Deletion

## sydle createClass
**Usage**: \`sydle createClass [package] [name]\`
- Creates class **locally** with template from Sydle API.
- Sets \`_revision: "0"\` to mark as unpublished.
- Use \`sydle sync\` to publish to Sydle.

## sydle createMethod
**Usage**: \`sydle createMethod [package] [class] [method]\`
- Scaffolds the method structure (**method.json**, **scripts/**, **jsconfig.json**).
- If arguments are omitted, launches an interactive prompt.

## sydle deleteMethod
**Usage**: \`sydle deleteMethod [package] [class] [method]\`
- Deletes the local folder AND handles Sydle deletion.
- **Safety**: Includes confirmation prompt and auto-rollback if declined.
- **Protection**: Cannot delete system methods (\`_*\`).
`;
  fs.writeFileSync(path.join(commandsDir, 'create-delete.md'), createDelete);

  // 6. Context - Comprehensive AI Agent Reference
  const context = `# AI Agent Context - Sydle CLI

Detailed context for AI agents working with the Sydle CLI.

---

## AI BEST PRACTICES (IMPORTANT!)

### Recommended Workflow for Creating Classes

**DO NOT** try to create classes with complex field specifications in one step.

**INSTEAD, follow this 2-step approach:**

1. **Step 1: Let CLI scaffold the structure**
   \`\`\`bash
   sydle createClass <package> "<Class Name>" --no-fields
   \`\`\`
   - Creates complete folder structure
   - Generates class.json, fields.js, and method folders
   - Class is created with _revision: "0" (local draft)

2. **Step 2: Edit fields.js directly**
   - Open sydle-dev/<package>/<ClassName>/fields.js
   - Add fields using the sy builder API
   - Much easier than CLI prompts

3. **Step 3: Publish to Sydle**
   \`\`\`bash
   sydle sync <package>.<className>
   \`\`\`

### Why This Approach Works Better
- CLI scaffolds ALL required files correctly
- You get proper TypeScript definitions
- fields.js is simple JavaScript - easy to edit
- Avoids complex interactive prompts

---

## Directory Structure
\`\`\`
sydle-dev/                        # Root (dev/hom/prod)
  package/                        # Package
    MyClass/                      # Class
      class.json                  # Class metadata
      fields.js                   # Field definitions (EDIT THIS!)
      myMethod/                   # Method
        method.json               # Method metadata
        scripts/script_1.js       # Method code
\`\`\`

## class.json Key Fields
\`\`\`javascript
{
  "_id": "696d4f52...",           // Unique ID in Sydle
  "_revision": "0",               // "0" = unpublished, ">0" = published
  "identifier": "myClass",        // Identifier (camelCase)
  "name": "My Class"              // Display name
}
\`\`\`

## Defining Fields (fields.js)
\`\`\`javascript
const { sy } = require('../../../typings/sydleZod');
module.exports = {
  name: sy.section('Data').name('Name').type('STRING').required().searchable(),
  age: sy.section('Data').name('Age').type('INTEGER'),
  dept: sy.section('Org').name('Dept').type('REFERENCE').refClass('pkg.Dept')
};
\`\`\`

### Field Types
| Type | Description |
|------|-------------|
| STRING | Text |
| INTEGER | Integer |
| DOUBLE | Decimal |
| BOOLEAN | True/False |
| DATE | Date/time |
| REFERENCE | Reference to another class |
| FILE | File attachment |

### Builder Methods (sy)
\`\`\`javascript
sy.section('Section')     // Visual grouping (required)
  .name('Label')          // Display name (required)
  .type('STRING')         // Type (default: STRING)
  .refClass('pkg.Class')  // For REFERENCE
  .required()             // Required field
  .searchable()           // Indexed
  .readOnly()             // Not editable
  .multiple()             // Array
  .defaultValue('val')    // Default value
  .valueOptions(['A','B']) // Select options
\`\`\`

## Script Variables
\`\`\`javascript
_object   // Current object
_parent   // Parent object
_input    // Input parameters
\`\`\`

## Common Errors
| Error | Solution |
|-------|----------|
| 401 Unauthorized | sydle login |
| _revision: "0" | sydle sync to publish |
| No scripts folder | OK for system methods |

## Essential Commands
\`\`\`bash
sydle createClass <pkg> "<Name>" --no-fields  # Create class (scaffold)
sydle sync <pkg>.<class>                      # Publish to Sydle
sydle watch <pkg>                             # Auto-sync
sydle createMethod <pkg> <cls> <met>          # Create method
\`\`\`
`;
  fs.writeFileSync(path.join(docsDir, 'context.md'), context);

  console.log('Generated AI Docs at ' + docsDir);
}

module.exports = { generateAiDocs };
