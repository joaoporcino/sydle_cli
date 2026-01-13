const { Command } = require('commander');
const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');
const { get, update } = require('../api/main');
const { ensureAuth } = require('../utils/authFlow');

const watchCommand = new Command('watch')
    .description('Watch for script changes and auto-sync to Sydle')
    .argument('[package]', 'Optional package to watch (e.g., recursosHumanos)')
    .option('-v, --verbose', 'Show verbose logging')
    .action(async (packageFilter, options) => {
        try {
            if (!(await ensureAuth())) {
                return;
            }

            const classId = '000000000000000000000000'; // Class metadata ID
            let url = process.env.SYDLE_API_URL;
            let env = 'prod';
            if (url.includes('dev')) env = 'dev';
            else if (url.includes('hom')) env = 'hom';

            const rootFolder = `sydle-${env}`;
            const rootPath = path.join(process.cwd(), rootFolder);

            if (!fs.existsSync(rootPath)) {
                console.error(`❌ Directory not found: ${rootPath}`);
                console.error(`   Run 'sydle init' or 'sydle obterPacote' first to generate the folder structure.`);
                return;
            }

            // Build watch pattern
            let watchPattern = path.join(rootPath, '**', 'scripts', 'script_*.js');
            if (packageFilter) {
                const packagePath = packageFilter.split('.').join(path.sep);
                watchPattern = path.join(rootPath, packagePath, '**', 'scripts', 'script_*.js');
            }

            console.log('🔍 Starting file watcher...');
            console.log(`📂 Watching: ${watchPattern}`);

            // Debounce timers
            const debounceTimers = new Map();

            // Initialize watcher
            const watcher = chokidar.watch(watchPattern, {
                persistent: true,
                ignoreInitial: true,
                awaitWriteFinish: {
                    stabilityThreshold: 300,
                    pollInterval: 100
                }
            });

            watcher.on('ready', () => {
                const files = Object.keys(watcher.getWatched()).reduce((acc, dir) => {
                    return acc + watcher.getWatched()[dir].length;
                }, 0);
                console.log(`✓ Ready! Monitoring ${files} script files.`);
                console.log('💾 Save any script to sync automatically.\n');
            });

            watcher.on('change', async (filePath) => {
                // Debounce multiple rapid saves
                if (debounceTimers.has(filePath)) {
                    clearTimeout(debounceTimers.get(filePath));
                }

                const timer = setTimeout(async () => {
                    debounceTimers.delete(filePath);
                    await syncScript(filePath, classId, rootPath, options.verbose);
                }, 500);

                debounceTimers.set(filePath, timer);
            });

            watcher.on('error', error => {
                console.error('❌ Watcher error:', error);
            });

            // Keep process alive
            process.on('SIGINT', () => {
                console.log('\n👋 Stopping file watcher...');
                watcher.close();
                process.exit(0);
            });

        } catch (error) {
            console.error('❌ Watch command failed:', error.message);
        }
    });

async function syncScript(filePath, classId, rootPath, verbose) {
    const timestamp = new Date().toLocaleTimeString('pt-BR');

    try {
        // Parse file path to extract metadata
        const relativePath = path.relative(rootPath, filePath);
        const parts = relativePath.split(path.sep);

        // Expected: package/parts.../className/methodName/scripts/script_N.js
        if (parts.length < 4 || parts[parts.length - 2] !== 'scripts') {
            if (verbose) {
                console.log(`[${timestamp}] ⚠ Skipped (invalid path): ${relativePath}`);
            }
            return;
        }

        const scriptFileName = parts[parts.length - 1];
        const methodName = parts[parts.length - 3];
        const className = parts[parts.length - 4];

        // Extract script index (script_1.js -> 0, script_2.js -> 1)
        const scriptMatch = scriptFileName.match(/script_(\d+)\.js$/);
        if (!scriptMatch) {
            if (verbose) {
                console.log(`[${timestamp}] ⚠ Skipped (invalid filename): ${relativePath}`);
            }
            return;
        }
        const scriptIndex = parseInt(scriptMatch[1]) - 1; // Convert to 0-based index

        // Read class.json to get class _id
        const classFolder = path.dirname(path.dirname(path.dirname(filePath)));
        const classJsonPath = path.join(classFolder, 'class.json');

        if (!fs.existsSync(classJsonPath)) {
            console.log(`[${timestamp}] ❌ class.json not found: ${className}/${methodName}`);
            return;
        }

        const classData = JSON.parse(fs.readFileSync(classJsonPath, 'utf-8'));
        const classRecordId = classData._id;

        if (verbose) {
            console.log(`[${timestamp}] 🔄 Syncing: ${className}/${methodName}/script_${scriptIndex + 1}.js`);
        }

        // Read script content
        const scriptContent = fs.readFileSync(filePath, 'utf-8');

        // Get current class data
        const currentClass = await get(classId, classRecordId);

        if (!currentClass || !currentClass.methods) {
            console.log(`[${timestamp}] ❌ Failed: Class data not found`);
            return;
        }

        // Find the method
        const methodIndex = currentClass.methods.findIndex(m => m.identifier === methodName);
        if (methodIndex === -1) {
            console.log(`[${timestamp}] ❌ Failed: Method '${methodName}' not found in class '${className}'`);
            return;
        }

        // Update the scripts array
        if (!currentClass.methods[methodIndex].scripts) {
            currentClass.methods[methodIndex].scripts = [];
        }

        currentClass.methods[methodIndex].scripts[scriptIndex] = scriptContent;

        // Update the class
        const updateData = {
            _id: classRecordId,
            methods: currentClass.methods
        };

        await update(classId, updateData);

        console.log(`[${timestamp}] ✓ Synced: ${className}/${methodName}/script_${scriptIndex + 1}.js`);

    } catch (error) {
        console.log(`[${timestamp}] ❌ Failed: ${error.message}`);
        if (verbose) {
            console.error(error);
        }
    }
}

module.exports = watchCommand;
