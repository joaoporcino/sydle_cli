# Commands: Creation & Deletion

## sydle createClass
**Usage**: `sydle createClass [package] [name]`
- Creates class **locally** with template from Sydle API.
- Sets `_revision: "0"` to mark as unpublished.
- Use `sydle sync` to publish to Sydle.

## sydle createMethod
**Usage**: `sydle createMethod [package] [class] [method]`
- Scaffolds the method structure (**method.json**, **scripts/**, **jsconfig.json**).
- If arguments are omitted, launches an interactive prompt.

## sydle deleteMethod
**Usage**: `sydle deleteMethod [package] [class] [method]`
- Deletes the local folder AND handles Sydle deletion.
- **Safety**: Includes confirmation prompt and auto-rollback if declined.
- **Protection**: Cannot delete system methods (`_*`).
