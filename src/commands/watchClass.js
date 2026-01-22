const { Command } = require('commander');
const chokidar = require('chokidar');
const { glob } = require('glob');
const fs = require('fs');
const path = require('path');
const { get, update } = require('../api/main');
const { ensureAuth } = require('../utils/authFlow');
const { createLogger } = require('../utils/logger');
const { scaffoldMethod } = require('../utils/scaffoldMethod');
const { handleMethodDeletion } = require('../utils/deleteMethod');
const { syncFieldsCore } = require('../core/syncFields');

const watchCommand = new Command('monitorarClasse')
    .alias('watchClass')
    .description('Watch for changes in script files and sync to Sydle (Classes only)')
    .argument('[package]', 'Optional package to watch (e.g., recursosHumanos)')
    .option('-v, --verbose', 'Show verbose logging')
    .action(async (packageFilter, options) => {
        const logger = createLogger(options.verbose);

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
                logger.error(`❌ Directory not found: ${rootPath}`);
                logger.info(`   Run 'sydle init' or 'sydle obterPacote' first to generate the folder structure.`);
                return;
            }

            // Build glob patterns
            let scriptGlobPattern = '**/scripts/script_*.js';
            let fieldsGlobPattern = '**/fields.js';

            if (packageFilter) {
                const packagePath = packageFilter.split('.').join('/');
                scriptGlobPattern = `${packagePath}/**/scripts/script_*.js`;
                fieldsGlobPattern = `${packagePath}/**/fields.js`;
            }

            logger.info('🔍 Starting file watcher...');
            logger.log(`📂 Base directory: ${rootPath}`);
            logger.info(`🔎 Searching for files...`);

            // Use glob to find all matching files first
            const scriptFiles = await glob(scriptGlobPattern, {
                cwd: rootPath,
                absolute: false,
                nodir: true
            });

            const fieldsFiles = await glob(fieldsGlobPattern, {
                cwd: rootPath,
                absolute: false,
                nodir: true
            });

            if (scriptFiles.length === 0 && fieldsFiles.length === 0) {
                logger.error(`❌ No script or fields files found`);
                logger.log(`   Directory: ${rootPath}`);
                return;
            }

            logger.success(`✓ Found ${scriptFiles.length} script files, ${fieldsFiles.length} fields.js files`);
            if (options.verbose) {
                scriptFiles.slice(0, 3).forEach(f => logger.log(`  📜 ${f}`));
                fieldsFiles.slice(0, 3).forEach(f => logger.log(`  📋 ${f}`));
                const total = scriptFiles.length + fieldsFiles.length;
                if (total > 6) logger.log(`  ... and ${total - 6} more`);
            }

            // Debounce timers
            const debounceTimers = new Map();
            const fieldsDebounceTimers = new Map();

            // Watch the glob patterns to support new files AND directories
            const watcher = chokidar.watch([
                scriptGlobPattern,
                fieldsGlobPattern,
                rootPath
            ], {
                cwd: rootPath,
                persistent: true,
                ignoreInitial: true,
                ignored: [
                    '**/node_modules/**',
                    '**/.git/**',
                    '**/dist/**',
                    '**/artifacts/**',
                    /(^|[\/\\])\../ // ignore dotfiles
                ],
                awaitWriteFinish: {
                    stabilityThreshold: 300,
                    pollInterval: 100
                }
            });

            watcher.on('ready', () => {
                const totalFiles = scriptFiles.length + fieldsFiles.length;
                logger.success(`\n💾 Watching ${totalFiles} files. Save any to sync automatically.\n`);
            });

            const handleFileChange = async (relativePath) => {
                // Construct absolute path (chokidar returns relative when using cwd)
                const filePath = path.join(rootPath, relativePath);

                // STRICT FILTER: Only process script_*.js files
                // This prevents the watcher from trying to sync method.json, class.json, or other files
                // which was causing errors like "No scripts folder found"
                if (!filePath.endsWith('.js') || !filePath.includes(path.sep + 'scripts' + path.sep + 'script_')) {
                    return;
                }

                // Debounce multiple rapid saves
                if (debounceTimers.has(filePath)) {
                    clearTimeout(debounceTimers.get(filePath));
                }

                const timer = setTimeout(async () => {
                    debounceTimers.delete(filePath);
                    await syncScript(filePath, classId, rootPath, logger);
                }, 500);

                debounceTimers.set(filePath, timer);
            };

            watcher.on('change', handleFileChange);
            watcher.on('add', handleFileChange);

            // Handler for fields.js changes
            const handleFieldsChange = async (relativePath) => {
                const filePath = path.join(rootPath, relativePath);

                // Only process files named exactly 'fields.js'
                if (!filePath.endsWith('fields.js')) {
                    return;
                }

                // Debounce multiple rapid saves
                if (fieldsDebounceTimers.has(filePath)) {
                    clearTimeout(fieldsDebounceTimers.get(filePath));
                }

                const timer = setTimeout(async () => {
                    fieldsDebounceTimers.delete(filePath);
                    await syncFieldsCore(filePath, classId, rootPath, logger);
                }, 500);

                fieldsDebounceTimers.set(filePath, timer);
            };

            watcher.on('change', handleFieldsChange);
            watcher.on('add', handleFieldsChange);

            // Handle directory creation for scaffolding
            watcher.on('addDir', async (dirPath) => {
                const absolutePath = path.join(rootPath, dirPath);
                const relativePath = path.relative(rootPath, absolutePath);
                const parts = relativePath.split(path.sep);

                // Check depth: root/package/class/method -> depth 3 (0-indexed based on parts)
                // sydle-dev (root) -> resourcesHumanos (0) -> ClassName (1) -> Method (2)
                if (parts.length === 3) {
                    const methodFolder = absolutePath;
                    const methodName = parts[2];

                    scaffoldMethod(methodFolder, rootPath, methodName, logger);
                }
            });

            // Handle directory deletion
            watcher.on('unlinkDir', async (dirPath) => {
                const absolutePath = path.join(rootPath, dirPath);
                // We pass the absolute path of the deleted folder to the handler
                await handleMethodDeletion(absolutePath, rootPath, logger);
            });

            watcher.on('error', error => {
                logger.error('❌ Watcher error: ' + (error instanceof Error ? error.message : String(error)));
            });

            // Keep process alive
            process.on('SIGINT', () => {
                logger.info('\n👋 Stopping file watcher...');
                watcher.close();
                process.exit(0);
            });

        } catch (error) {
            logger.error('❌ Watch command failed: ' + (error instanceof Error ? error.message : String(error)));
            logger.debug(error instanceof Error ? error.stack : undefined);
        }
    });

const { syncMethodCore } = require('../core/syncLogic');

async function syncScript(filePath, classId, rootPath, logger) {
    try {
        // Parse current file to find associated method.json
        // filePath is usually .../scripts/script_N.js
        // We need method.json which is in ../method.json relative to scripts folder
        const methodFolder = path.dirname(path.dirname(filePath));
        const methodJsonPath = path.join(methodFolder, 'method.json');

        if (!fs.existsSync(methodJsonPath)) {
            logger.warn(`⚠ method.json not found, creating default for: ${path.basename(methodFolder)}`);
            const defaultMethodData = {
                identifier: path.basename(methodFolder),
                name: path.basename(methodFolder),
                accessLevel: 'PUBLIC',
                engine: 'GRAAL',
                inputParameters: [],
                outputParameters: [],
                scripts: []
            };
            fs.writeFileSync(methodJsonPath, JSON.stringify(defaultMethodData, null, 4));
        }

        // Delegate to core logic
        await syncMethodCore(methodJsonPath, classId, rootPath, logger);

    } catch (error) {
        logger.error(`❌ Failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

module.exports = watchCommand;
