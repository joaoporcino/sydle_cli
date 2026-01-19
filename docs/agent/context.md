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
_object   // Current object
_parent   // Parent object
_input    // Input parameters
```

## Common Errors
| Error | Solution |
|-------|----------|
| 401 Unauthorized | sydle login |
| _revision: "0" | sydle sync to publish |
| No scripts folder | OK for system methods |

## Essential Commands
```bash
sydle createClass <pkg> "<Name>" --no-fields  # Create class (scaffold)
sydle sync <pkg>.<class>                      # Publish to Sydle
sydle watch <pkg>                             # Auto-sync
sydle createMethod <pkg> <cls> <met>          # Create method
```
