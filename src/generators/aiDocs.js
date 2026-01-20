const fs = require('fs');
const path = require('path');
const { logger } = require('../utils/logger');

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
- [x] **sydle obterPacote**: (Alias: \`getPackage\`) Fetches all classes from a package.
- [x] **sydle criarClasse**: (Alias: \`createClass\`) Creates a new class **locally**. Use \`sync\` to publish to Sydle.
- [x] **sydle sincronizar <path>**: (Alias: \`sync\`) Syncs classes, fields, and methods to Sydle. **Creates new classes automatically**.
- [x] **sydle monitorar <package>**: (Alias: \`watch\`) Monitors changes and syncs automatically.
- [x] **sydle criarMetodo**: (Alias: \`createMethod\`) Scaffolds a new method.
- [x] **sydle excluirMetodo**: (Alias: \`deleteMethod\`) Deletes a method folder and removes it from Sydle.
- [x] **sydle obterClasse <id>**: (Alias: \`getClass\`) Fetches a class definition.
- [x] **sydle listarInstancia**: (Alias: \`listInstance\`) Search/list class instances.
- [x] **sydle obterInstancia**: (Alias: \`getInstance\`) Downloads an instance for local editing.
- [x] **sydle atualizarInstancia**: (Alias: \`updateInstance\`) Uploads local instance changes to Sydle.
- [x] **sydle listarProcessos**: (Alias: \`listProcesses\`, \`lp\`) Downloads all processes and all their versions from a group.

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

## sydle obterPacote (Alias: getPackage)
**Usage**: \`sydle getPackage [identifier]\`
- Downloads all classes from a Sydle package to the local environment.
- If no identifier is provided, launches an interactive selection.
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

sydle-process-dev/               # Process Root
  GroupName/                     # Process Group
    group.json                   # Group metadata
    ProcessName/                 # Process
      process.json               # Process metadata
      VersionLabel/              # Version
        version.json             # Full version metadata
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
_object   // Current object instance
_parent   // Parent object (if nested)
_input    // Input parameters (if method has input/ folder)
_output   // Output object (if method has output/ folder)
_metadata // Metadata object (only in _getMetadata scripts)
\`\`\`

## Understanding Script Variables (IMPORTANT FOR AI!)

Before editing any script, you MUST understand the structure of these objects.

### Finding _object Structure
The \`_object\` variable contains the current class instance.

| File | Location | Content |
|------|----------|---------|
| \`class.d.ts\` | \`<Class>/class.d.ts\` | TypeScript interface (\`IClassName\`) |
| \`class.json\` | \`<Class>/class.json\` | \`fields[]\` array with all field definitions |
| \`fields.js\` | \`<Class>/fields.js\` | Fields in sy builder format |

**Example**: To edit a script for \`Estagiario\` class:
\`\`\`
1. Check: sydle-dev/recursosHumanos/Estagiario/class.d.ts
2. Look for: interface IEstagiario { ... }
3. Use fields like: _object.nome, _object.matricula
\`\`\`

### Finding _input Structure
The \`_input\` variable exists **only if the method has an \`input/\` subfolder**.

| File | Location | Content |
|------|----------|---------|
| \`input.d.ts\` | \`<Method>/input/input.d.ts\` | TypeScript interface |
| \`inputParameters.json\` | \`<Method>/input/inputParameters.json\` | Full input definition |

**Check if exists**: Look for \`<Method>/input/\` folder before using \`_input\`.

### Finding _output Structure
The \`_output\` variable exists **only if the method has an \`output/\` subfolder**.

| File | Location | Content |
|------|----------|---------|
| \`output.d.ts\` | \`<Method>/output/output.d.ts\` | TypeScript interface |
| \`outputParameters.json\` | \`<Method>/output/outputParameters.json\` | Full output definition |

**Check if exists**: Look for \`<Method>/output/\` folder before using \`_output\`.

### AI Checklist Before Editing Scripts
1. ✅ Check \`class.d.ts\` to understand \`_object\` fields
2. ✅ Check if \`input/\` folder exists → if yes, check \`input.d.ts\`
3. ✅ Check if \`output/\` folder exists → if yes, check \`output.d.ts\`
4. ✅ Never invent field names - always verify they exist

## _getMetadata Scripts (CRITICAL!)

Scripts in \`_getMetadata/scripts/\` control field visibility and behavior dynamically.

> **⚠️ IMPORTANT: NEVER replace the field object, only modify its properties!**

### ✅ CORRECT Pattern
\`\`\`javascript
if (_object) {
    _metadata.fields.documento.hidden = !_object.ativo;
    _metadata.fields.campo.required = true;
    _metadata.fields.campo.readOnly = true;
}
\`\`\`

### ❌ WRONG Pattern (DO NOT DO THIS!)
\`\`\`javascript
// WRONG: This replaces the ENTIRE field object, losing all other properties!
_metadata.fields.documento = { hidden: true };
\`\`\`

### Available _metadata.fields Properties
| Property | Type | Description |
|----------|------|-------------|
| \`hidden\` | boolean | Hide/show field |
| \`required\` | boolean | Make field required |
| \`readOnly\` | boolean | Make field read-only |
| \`name\` | string | Change field label |
| \`valueOptions\` | array | Set dropdown options |

### Example: Conditional Field Visibility
\`\`\`javascript
if (_object) {
    // Hide 'documento' when 'ativo' is false
    _metadata.fields.documento.hidden = !_object.ativo;
    
    // Show field only when another field has value
    if (_object.tipo === 'especial') {
        _metadata.fields.campoEspecial.hidden = false;
        _metadata.fields.campoEspecial.required = true;
    }
}
\`\`\`

## Common Errors
| Error | Solution |
|-------|----------|
| 401 Unauthorized | sydle login |
| _revision: "0" | sydle sync to publish |
| No scripts folder | OK for system methods |

## Managing Data (Instances)
You can manage class instances (records) locally in the \`sydle-dev-data/\` folder.

### Directory Structure
\`\`\`
sydle-dev-data/                   # Data Root (Separate from sydle-dev)
  Package/
    Class/
      InstanceName/
        instance.json             # Metadata & simple fields
        script.js                 # Extracted script content
        template.html             # Extracted HTML content
\`\`\`

### Data Commands
\`\`\`bash
sydle listarInstancia <pkg>.<class>              # List instances (Alias: listInstance)
sydle obterInstancia <pkg>.<class> <id>          # Download for editing (Alias: getInstance)
sydle atualizarInstancia <pkg>.<class> <folder>  # Upload changes (Alias: updateInstance)
\`\`\`

## Essential Commands
\`\`\`bash
sydle createClass <pkg> "<Name>" --no-fields  # Create class (scaffold)
sydle sync <pkg>.<class>                      # Publish to Sydle
sydle watch <pkg>                             # Auto-sync
sydle createMethod <pkg> <cls> <met>          # Create method
sydle getPackage <pkg>                        # Download package
sydle obterInstancia <pkg>.<class> <id>       # Edit data instance locally
sydle listarProcessos <groupIdentifier>       # Download process group structure and ALL versions
\`\`\`
`;
  fs.writeFileSync(path.join(docsDir, 'context.md'), context);

  logger.debug('Generated AI Docs at ' + docsDir);
}

module.exports = { generateAiDocs };
