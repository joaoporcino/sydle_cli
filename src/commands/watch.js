const { Command } = require('commander');
const chokidar = require('chokidar');
const { glob } = require('glob');
const fs = require('fs');
const path = require('path');
const { get, update } = require('../api/main');
const { ensureAuth } = require('../utils/authFlow');
const { createLogger } = require('../utils/logger');

const watchCommand = new Command('watch')
    .description('Watch for script changes and auto-sync to Sydle')
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

            // Build glob pattern to find script files
            let globPattern = '**/scripts/script_*.js';

            if (packageFilter) {
                const packagePath = packageFilter.split('.').join('/');
                globPattern = `${packagePath}/**/scripts/script_*.js`;
            }

            logger.info('🔍 Starting file watcher...');
            logger.log(`📂 Base directory: ${rootPath}`);
            logger.info(`🔎 Searching for files...`);

            // Use glob to find all matching files first
            const files = await glob(globPattern, {
                cwd: rootPath,
                absolute: false,
                nodir: true
            });

            if (files.length === 0) {
                logger.error(`❌ No script files found matching pattern: ${globPattern}`);
                logger.log(`   Directory: ${rootPath}`);
                return;
            }

            logger.success(`✓ Found ${files.length} script files`);
            if (options.verbose) {
                files.slice(0, 5).forEach(f => logger.log(`  - ${f}`));
                if (files.length > 5) logger.log(`  ... and ${files.length - 5} more`);
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
                logger.success(`\n💾 Watching ${files.length} files. Save any to sync automatically.\n`);
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
                    await syncScript(filePath, classId, rootPath, logger);
                }, 500);

                debounceTimers.set(filePath, timer);
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

async function syncScript(filePath, classId, rootPath, logger) {

    try {
        // Parse file path to extract metadata
        const relativePath = path.relative(rootPath, filePath);
        const parts = relativePath.split(path.sep);

        // Expected: package/parts.../className/methodName/scripts/script_N.js
        if (parts.length < 4 || parts[parts.length - 2] !== 'scripts') {
            logger.warn(`⚠ Skipped (invalid path): ${relativePath}`);
            return;
        }

        const scriptFileName = parts[parts.length - 1];
        const methodName = parts[parts.length - 3];
        const className = parts[parts.length - 4];

        // Validate script filename
        if (!scriptFileName.match(/^script_\d+\.js$/)) {
            logger.warn(`⚠ Skipped (invalid filename): ${relativePath}`);
            return;
        }

        logger.progress(`🔄 Syncing: ${className}/${methodName}/${scriptFileName}`);

        // Get method folder and method.json path
        const methodFolder = path.dirname(path.dirname(filePath));
        const methodJsonPath = path.join(methodFolder, 'method.json');
        const scriptsFolder = path.join(methodFolder, 'scripts');

        if (!fs.existsSync(methodJsonPath)) {
            logger.error(`❌ Failed: method.json not found for ${className}/${methodName}`);
            return;
        }

        // Read method.json
        const methodData = JSON.parse(fs.readFileSync(methodJsonPath, 'utf-8'));

        // Read all script files from the scripts folder
        const scriptFiles = fs.readdirSync(scriptsFolder)
            .filter(file => file.match(/^script_\d+\.js$/))
            .sort((a, b) => {
                const numA = parseInt(a.match(/script_(\d+)\.js/)[1], 10);
                const numB = parseInt(b.match(/script_(\d+)\.js/)[1], 10);
                return numA - numB;
            });

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
            logger.error(`❌ class.json not found: ${className}`);
            return;
        }

        const classData = JSON.parse(fs.readFileSync(classJsonPath, 'utf-8'));
        const classRecordId = classData._id;

        // Get current class to find method index
        const currentClass = await get(classId, classRecordId);
        if (!currentClass || !currentClass.methods) {
            logger.error(`❌ Failed: Class data not found`);
            return;
        }

        const methodIndex = currentClass.methods.findIndex(m => m.identifier === methodName);
        if (methodIndex === -1) {
            logger.error(`❌ Failed: Method '${methodName}' not found in class '${className}'`);
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

        logger.success(`✓ Synced: ${className}/${methodName} (${scripts.length} script(s))`);

    } catch (error) {
        logger.error(`❌ Failed: ${error instanceof Error ? error.message : String(error)}`);
        logger.debug(error instanceof Error ? error.stack : undefined);
    }
}

module.exports = watchCommand;
