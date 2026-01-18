# Commands: Creation & Deletion

## sydle criarMetodo
**Alias**: `createMethod`
**Usage**: `sydle criarMetodo [package] [class] [method]`
- Scaffolds the method structure (**method.json**, **scripts/**, **jsconfig.json**, types).
- Use this instead of creating files manually to ensure correct config.
- If arguments are omitted, launches an interactive prompt.

## sydle excluirMetodo
**Alias**: `deleteMethod`
**Usage**: `sydle excluirMetodo [package] [class] [method]`
- Deletes the local folder AND handles Sydle deletion.
- **Safety**: Includes confirmation prompt and auto-rollback if deletion is declined.
- **Protection**: Cannot delete system methods (`_*`) - triggers auto-rollback.
