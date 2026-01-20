# AI Agent Context - Sydle CLI

Detailed context for AI agents working with the Sydle CLI.

---

## AI BEST PRACTICES (IMPORTANT!)

### Recommended Workflow for Creating Classes

**DO NOT** try to create classes with complex field specifications in one step.

**INSTEAD, follow this 2-step approach:**

1. **Step 1: Let CLI scaffold the structure**
   ```bash
   sydle createClass <package> "<Class Name>" --no-fields
   ```
   - Creates complete folder structure
   - Generates class.json, fields.js, and method folders
   - Class is created with _revision: "0" (local draft)

2. **Step 2: Edit fields.js directly**
   - Open sydle-dev/<package>/<ClassName>/fields.js
   - Add fields using the sy builder API
   - Much easier than CLI prompts

3. **Step 3: Publish to Sydle**
   ```bash
   sydle sync <package>.<className>
   ```

### Why This Approach Works Better
- CLI scaffolds ALL required files correctly
- You get proper TypeScript definitions
- fields.js is simple JavaScript - easy to edit
- Avoids complex interactive prompts

---

## Directory Structure
```
sydle-dev/                        # Root (dev/hom/prod)
  package/                        # Package
    MyClass/                      # Class
      class.json                  # Class metadata
      fields.js                   # Field definitions (EDIT THIS!)
      myMethod/                   # Method
        method.json               # Method metadata
        scripts/script_1.js       # Method code
```

## class.json Key Fields
```javascript
{
  "_id": "696d4f52...",           // Unique ID in Sydle
  "_revision": "0",               // "0" = unpublished, ">0" = published
  "identifier": "myClass",        // Identifier (camelCase)
  "name": "My Class"              // Display name
}
```

## Defining Fields (fields.js)
```javascript
const { sy } = require('../../../typings/sydleZod');
module.exports = {
  name: sy.section('Data').name('Name').type('STRING').required().searchable(),
  age: sy.section('Data').name('Age').type('INTEGER'),
  dept: sy.section('Org').name('Dept').type('REFERENCE').refClass('pkg.Dept')
};
```

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
```javascript
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
```

## Script Variables
```javascript
_object   // Current object instance
_parent   // Parent object (if nested)
_input    // Input parameters (if method has input/ folder)
_output   // Output object (if method has output/ folder)
_metadata // Metadata object (only in _getMetadata scripts)
```

## Understanding Script Variables (IMPORTANT FOR AI!)

Before editing any script, you MUST understand the structure of these objects.

### Finding _object Structure
The `_object` variable contains the current class instance.

| File | Location | Content |
|------|----------|---------|
| `class.d.ts` | `<Class>/class.d.ts` | TypeScript interface (`IClassName`) |
| `class.json` | `<Class>/class.json` | `fields[]` array with all field definitions |
| `fields.js` | `<Class>/fields.js` | Fields in sy builder format |

**Example**: To edit a script for `Estagiario` class:
```
1. Check: sydle-dev/recursosHumanos/Estagiario/class.d.ts
2. Look for: interface IEstagiario { ... }
3. Use fields like: _object.nome, _object.matricula
```

### Finding _input Structure
The `_input` variable exists **only if the method has an `input/` subfolder**.

| File | Location | Content |
|------|----------|---------|
| `input.d.ts` | `<Method>/input/input.d.ts` | TypeScript interface |
| `inputParameters.json` | `<Method>/input/inputParameters.json` | Full input definition |

**Check if exists**: Look for `<Method>/input/` folder before using `_input`.

### Finding _output Structure
The `_output` variable exists **only if the method has an `output/` subfolder**.

| File | Location | Content |
|------|----------|---------|
| `output.d.ts` | `<Method>/output/output.d.ts` | TypeScript interface |
| `outputParameters.json` | `<Method>/output/outputParameters.json` | Full output definition |

**Check if exists**: Look for `<Method>/output/` folder before using `_output`.

### AI Checklist Before Editing Scripts
1. ✅ Check `class.d.ts` to understand `_object` fields
2. ✅ Check if `input/` folder exists → if yes, check `input.d.ts`
3. ✅ Check if `output/` folder exists → if yes, check `output.d.ts`
4. ✅ Never invent field names - always verify they exist

## _getMetadata Scripts (CRITICAL!)

Scripts in `_getMetadata/scripts/` control field visibility and behavior dynamically.

> **⚠️ IMPORTANT: NEVER replace the field object, only modify its properties!**

### ✅ CORRECT Pattern
```javascript
if (_object) {
    _metadata.fields.documento.hidden = !_object.ativo;
    _metadata.fields.campo.required = true;
    _metadata.fields.campo.readOnly = true;
}
```

### ❌ WRONG Pattern (DO NOT DO THIS!)
```javascript
// WRONG: This replaces the ENTIRE field object, losing all other properties!
_metadata.fields.documento = { hidden: true };
```

### Available _metadata.fields Properties
| Property | Type | Description |
|----------|------|-------------|
| `hidden` | boolean | Hide/show field |
| `required` | boolean | Make field required |
| `readOnly` | boolean | Make field read-only |
| `name` | string | Change field label |
| `valueOptions` | array | Set dropdown options |

### Example: Conditional Field Visibility
```javascript
if (_object) {
    // Hide 'documento' when 'ativo' is false
    _metadata.fields.documento.hidden = !_object.ativo;
    
    // Show field only when another field has value
    if (_object.tipo === 'especial') {
        _metadata.fields.campoEspecial.hidden = false;
        _metadata.fields.campoEspecial.required = true;
    }
}
```

## Common Errors
| Error | Solution |
|-------|----------|
| 401 Unauthorized | sydle login |
| _revision: "0" | sydle sync to publish |
| No scripts folder | OK for system methods |

## Managing Data (Instances)
You can manage class instances (records) locally in the `sydle-dev-data/` folder.

### Directory Structure
```
sydle-dev-data/                   # Data Root (Separate from sydle-dev)
  Package/
    Class/
      InstanceName/
        instance.json             # Metadata & simple fields
        script.js                 # Extracted script content
        template.html             # Extracted HTML content
```

### Data Commands
```bash
sydle data search <pkg>.<class>                 # List instances
sydle data get <pkg>.<class> <id>               # Download to sydle-dev-data
sydle data update <pkg>.<class> <folderName>    # Upload changes
```

## Essential Commands
```bash
sydle createClass <pkg> "<Name>" --no-fields  # Create class (scaffold)
sydle sync <pkg>.<class>                      # Publish to Sydle
sydle watch <pkg>                             # Auto-sync
sydle createMethod <pkg> <cls> <met>          # Create method
sydle data get <pkg>.<class> <id>             # Edit data instance locally
```
