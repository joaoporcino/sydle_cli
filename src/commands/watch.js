const { Command } = require('commander');
const chokidar = require('chokidar');
const { glob } = require('glob');
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

            // Build glob pattern to find script files
            let globPattern = '**/scripts/script_*.js';

            if (packageFilter) {
                const packagePath = packageFilter.split('.').join('/');
                globPattern = `${packagePath}/**/scripts/script_*.js`;
            }

            console.log('🔍 Starting file watcher...');
            console.log(`📂 Base directory: ${rootPath}`);
            console.log(`🔎 Searching for files...`);

            // Use glob to find all matching files first
            const files = await glob(globPattern, {
                cwd: rootPath,
                absolute: false,
                nodir: true
            });

            if (files.length === 0) {
                console.error(`❌ No script files found matching pattern: ${globPattern}`);
                console.error(`   Directory: ${rootPath}`);
                return;
            }

            console.log(`✓ Found ${files.length} script files`);
            if (options.verbose) {
                files.slice(0, 5).forEach(f => console.log(`  - ${f}`));
                if (files.length > 5) console.log(`  ... and ${files.length - 5} more`);
            }

            // Debounce timers
            const debounceTimers = new Map();

            // Watch the found files explicitly
            const watcher = chokidar.watch(files, {
                cwd: rootPath,
                persistent: true,
                ignoreInitial: true,
                awaitWriteFinish: {
                    stabilityThreshold: 300,
                    pollInterval: 100
                }
            });

            watcher.on('ready', () => {
                console.log(`\n💾 Watching ${files.length} files. Save any to sync automatically.\n`);
            });

            watcher.on('change', async (relativePath) => {
                // Construct absolute path (chokidar returns relative when using cwd)
                const filePath = path.join(rootPath, relativePath);

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

        // Validate script filename
        if (!scriptFileName.match(/^script_\d+\.js$/)) {
            if (verbose) {
                console.log(`[${timestamp}] ⚠ Skipped (invalid filename): ${relativePath}`);
            }
            return;
        }

        if (verbose) {
            console.log(`[${timestamp}] 🔄 Syncing: ${className}/${methodName}/${scriptFileName}`);
        }

        // Get method folder and method.json path
        const methodFolder = path.dirname(path.dirname(filePath));
        const methodJsonPath = path.join(methodFolder, 'method.json');
        const scriptsFolder = path.join(methodFolder, 'scripts');

        if (!fs.existsSync(methodJsonPath)) {
            console.log(`[${timestamp}] ❌ Failed: method.json not found for ${className}/${methodName}`);
            return;
        }

        // Read method.json
        const methodData = JSON.parse(fs.readFileSync(methodJsonPath, 'utf-8'));

        // Read all script files from the scripts folder
        const scriptFiles = fs.readdirSync(scriptsFolder)
            .filter(file => file.match(/^script_\d+\.js$/))
            .sort(); // Ensure consistent order

        // Read all scripts and update method.json
        const scripts = [];
        for (const scriptFile of scriptFiles) {
            const scriptPath = path.join(scriptsFolder, scriptFile);
            const scriptContent = fs.readFileSync(scriptPath, 'utf-8');
            scripts.push(scriptContent);
        }

        methodData.scripts = scripts;

        // Write updated method.json
        fs.writeFileSync(methodJsonPath, JSON.stringify(methodData, null, 4), 'utf-8');

        // Read class.json to get class _id and method index
        const classFolder = path.dirname(methodFolder);
        const classJsonPath = path.join(classFolder, 'class.json');

        if (!fs.existsSync(classJsonPath)) {
            console.log(`[${timestamp}] ❌ class.json not found: ${className}`);
            return;
        }

        const classData = JSON.parse(fs.readFileSync(classJsonPath, 'utf-8'));
        const classRecordId = classData._id;

        // Get current class to find method index
        const currentClass = await get(classId, classRecordId);
        if (!currentClass || !currentClass.methods) {
            console.log(`[${timestamp}] ❌ Failed: Class data not found`);
            return;
        }

        const methodIndex = currentClass.methods.findIndex(m => m.identifier === methodName);
        if (methodIndex === -1) {
            console.log(`[${timestamp}] ❌ Failed: Method '${methodName}' not found in class '${className}'`);
            return;
        }

        // Patch with full method object
        const updateData = {
            _id: classRecordId,
            _operationsList: [{
                op: 'replace',
                path: `/methods/${methodIndex}`,
                value: methodData
            }]
        };

        const { patch } = require('../api/main');
        await patch(classId, updateData);

        console.log(`[${timestamp}] ✓ Synced: ${className}/${methodName} (${scripts.length} script(s))`);

    } catch (error) {
        console.log(`[${timestamp}] ❌ Failed: ${error.message}`);
        if (verbose) {
            console.error(error);
        }
    }
}

module.exports = watchCommand;
