# Command: sydle sincronizar (Alias: sync)

**Usage**: `sydle sincronizar [package] [class] [method]`

## Features
- Manual synchronization.
- Iterates through local files and pushes to Sydle.
- **Legacy behavior**: Unlike `watch`, this might not auto-create methods if `method.json` is missing (though shared core logic handles creation now).
