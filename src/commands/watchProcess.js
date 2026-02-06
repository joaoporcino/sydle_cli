const { Command } = require('commander');
const chokidar = require('chokidar');
const { glob } = require('glob');
const fs = require('fs');
const path = require('path');
const { ensureAuth } = require('../utils/authFlow');
const { createLogger } = require('../utils/logger');
const { scaffoldMethod } = require('../utils/scaffoldMethod');
const { scaffoldProcessRole } = require('../utils/scaffoldProcessRole');
const { handleProcessMethodDeletion } = require('../utils/deleteProcessMethod');
const { syncProcessMethodCore, syncProcessFieldsCore } = require('../core/syncLogicProcess');
const { syncFieldsProcessCore } = require('../core/syncFieldsProcess');
const { syncProcessRolesCore } = require('../core/syncProcessRoles');
const { syncDiagramTaskCore, syncDiagramTaskScriptCore } = require('../core/syncLogicDiagram');

// Helper to load existing classes for type resolution
// Copied/Adapted from processProcesses.js logic
function loadExistingClasses(env, logger) {
    const classIdToIdentifier = new Map();
    const sydleDevPath = path.join(process.cwd(), `sydle-${env}`);

    if (fs.existsSync(sydleDevPath)) {
        logger.info('Phase 0: Loading existing classes for type resolution...');

        const loadClassesRecursively = (dir) => {
            const items = fs.readdirSync(dir);
            for (const item of items) {
                const itemPath = path.join(dir, item);
                const stat = fs.statSync(itemPath);

                if (stat.isDirectory()) {
                    const classJsonPath = path.join(itemPath, 'class.json');
                    if (fs.existsSync(classJsonPath)) {
                        try {
                            const classData = JSON.parse(fs.readFileSync(classJsonPath, 'utf8'));
                            if (classData._id && classData.identifier) {
                                classIdToIdentifier.set(classData._id, classData.identifier);
                            }
                        } catch (error) {
                            // Silently skip malformed files
                        }
                    }
                    loadClassesRecursively(itemPath);
                }
            }
        };

        loadClassesRecursively(sydleDevPath);
        logger.debug(`Loaded ${classIdToIdentifier.size} existing classes for type resolution.`);
    }
    return classIdToIdentifier;
}

const watchProcessCommand = new Command('monitorarProcesso')
    .alias('watchProcess')
    .description('Watch for changes in process files (scripts and fields) and sync to Sydle')
    .option('-v, --verbose', 'Show verbose logging')
    .action(async (options) => {
        const logger = createLogger(options.verbose);

        try {
            if (!(await ensureAuth())) {
                return;
            }

            let url = process.env.SYDLE_API_URL;
            let env = 'prod';
            if (url.includes('dev')) env = 'dev';
            else if (url.includes('hom')) env = 'hom';

            const rootFolder = `sydle-process-${env}`;
            const rootPath = path.join(process.cwd(), rootFolder);

            if (!fs.existsSync(rootPath)) {
                logger.error(`❌ Directory not found: ${rootPath}`);
                logger.info(`   Run 'sydle listProcesses' first to generate the folder structure.`);
                return;
            }

            // Ensure global types exist for IntelliSense
            const sourceSydleDts = path.join(__dirname, '../../typings/sydle.d.ts');
            const destSydleDts = path.join(rootPath, 'sydle.d.ts');
            if (fs.existsSync(sourceSydleDts) && !fs.existsSync(destSydleDts)) {
                fs.copyFileSync(sourceSydleDts, destSydleDts);
                logger.success('Testing environment: Copied sydle.d.ts');
            }

            const globalsDtsPath = path.join(rootPath, 'globals.d.ts');
            if (!fs.existsSync(globalsDtsPath)) {
                fs.writeFileSync(globalsDtsPath, '/// <reference path="./sydle.d.ts" />\n');
                logger.success('Testing environment: Created globals.d.ts');
            }

            const jsConfigPath = path.join(rootPath, 'jsconfig.json');
            if (!fs.existsSync(jsConfigPath)) {
                const jsConfig = {
                    compilerOptions: {
                        target: "ES6",
                        module: "commonjs",
                        checkJs: true
                    },
                    include: ["**/*"]
                };
                fs.writeFileSync(jsConfigPath, JSON.stringify(jsConfig, null, 2));
                logger.success('Testing environment: Created jsconfig.json');
            }

            // Phase 0: Load existing classes for type resolution (needed for d.ts generation)
            const classIdToIdentifier = loadExistingClasses(env, logger);

            // Build glob patterns
            const scriptGlobPattern = '**/pin/**/scripts/script_*.js';
            const versionJsonGlobPattern = '**/version.json';
            const fieldsJsGlobPattern = '**/pin/**/fields.js';
            const roleJsonGlobPattern = '**/pin/**/processRoles/**/role.json';
            const aclScriptGlobPattern = '**/pin/**/processRoles/**/aclScript.js';
            const diagramTaskGlobPattern = '**/diagram/tasks/**/task.json';
            const diagramTaskScriptGlobPattern = '**/diagram/tasks/**/scripts/script_*.js';

            logger.info('🔍 Starting process file watcher...');
            logger.log(`📂 Base directory: ${rootPath}`);
            logger.info(`🔎 Searching for files...`);

            // Use glob to find all matching files first
            const scriptFiles = await glob(scriptGlobPattern, { cwd: rootPath, nodir: true });
            const versionFiles = await glob(versionJsonGlobPattern, { cwd: rootPath, nodir: true });
            const fieldsFiles = await glob(fieldsJsGlobPattern, { cwd: rootPath, nodir: true });
            const roleFiles = await glob(roleJsonGlobPattern, { cwd: rootPath, nodir: true });
            const diagramTaskFiles = await glob(diagramTaskGlobPattern, { cwd: rootPath, nodir: true });
            const diagramTaskScriptFiles = await glob(diagramTaskScriptGlobPattern, { cwd: rootPath, nodir: true });

            const totalFound = scriptFiles.length + versionFiles.length + fieldsFiles.length + roleFiles.length + diagramTaskFiles.length + diagramTaskScriptFiles.length;

            if (totalFound === 0) {
                logger.warn(`⚠ No relevant files found. Proceeding with watch anyway...`);
            } else {
                logger.success(`✓ Found ${scriptFiles.length} scripts, ${versionFiles.length} versions, ${fieldsFiles.length} fields, ${roleFiles.length} roles, ${diagramTaskFiles.length} tasks`);
                if (options.verbose) {
                    scriptFiles.slice(0, 3).forEach(f => logger.log(`  📜 ${f}`));
                    fieldsFiles.slice(0, 3).forEach(f => logger.log(`  📋 ${f}`));
                    diagramTaskFiles.slice(0, 3).forEach(f => logger.log(`  🔧 ${f}`));
                }
            }

            // Debounce timers
            const debounceTimers = new Map();
            const fieldsDebounceTimers = new Map();
            const rolesDebounceTimers = new Map();
            const diagramDebounceTimers = new Map();

            // Watch the root path recursively (filters handle the rest)
            const watcher = chokidar.watch(rootPath, {
                cwd: rootPath,
                persistent: true,
                ignoreInitial: true,
                ignored: [
                    '**/node_modules/**',
                    '**/.git/**',
                    '**/dist/**',
                    '**/events/**',
                    '**/gateways/**',
                    /(^|[\/\\])\../ // ignore dotfiles
                ],
                awaitWriteFinish: {
                    stabilityThreshold: 300,
                    pollInterval: 100
                }
            });

            watcher.on('ready', () => {
                logger.success(`\n💾 Watching ${totalFound} files in: ${rootPath}\n   Save any to sync automatically.\n`);
            });

            const handleFileChange = async (relativePath) => {
                // Construct absolute path
                const filePath = path.join(rootPath, relativePath);

                // 1. Scripts (Process PIN)
                if (filePath.endsWith('.js') && filePath.includes(path.sep + 'pin' + path.sep) && filePath.includes(path.sep + 'scripts' + path.sep + 'script_')) {
                    if (debounceTimers.has(filePath)) clearTimeout(debounceTimers.get(filePath));
                    const timer = setTimeout(async () => {
                        debounceTimers.delete(filePath);
                        try {
                            const methodFolder = path.dirname(path.dirname(filePath));
                            const methodJsonPath = path.join(methodFolder, 'method.json');
                            if (!fs.existsSync(methodJsonPath)) {
                                const defaultMethodData = { identifier: path.basename(methodFolder), name: path.basename(methodFolder), accessLevel: 'PUBLIC', engine: 'GRAAL', inputParameters: [], outputParameters: [], scripts: [] };
                                fs.writeFileSync(methodJsonPath, JSON.stringify(defaultMethodData, null, 4));
                            }
                            await syncProcessMethodCore(methodJsonPath, rootPath, logger);
                        } catch (err) { logger.error(`❌ ${err.message}`); }
                    }, 500);
                    debounceTimers.set(filePath, timer);
                    return;
                }

                // 2. fields.js
                if (filePath.endsWith('fields.js')) {
                    if (fieldsDebounceTimers.has(filePath)) clearTimeout(fieldsDebounceTimers.get(filePath));
                    const timer = setTimeout(async () => {
                        fieldsDebounceTimers.delete(filePath);

                        // Check if it is a TASK fields.js (inside diagram/tasks)
                        if (filePath.includes(path.sep + 'diagram' + path.sep + 'tasks')) {
                            const { syncTaskFieldsCore } = require('../core/syncTaskFields');
                            await syncTaskFieldsCore(filePath, rootPath, logger);
                        } else {
                            // Process Version fields.js
                            await syncFieldsProcessCore(filePath, rootPath, logger, classIdToIdentifier);
                        }
                    }, 500);
                    fieldsDebounceTimers.set(filePath, timer);
                    return;
                }

                // 3. Roles
                if (filePath.endsWith('role.json') || filePath.endsWith('aclScript.js')) {
                    if (filePath.includes('processRoles')) {
                        const roleFolder = path.dirname(filePath);
                        const roleJsonPath = path.join(roleFolder, 'role.json');
                        if (!fs.existsSync(roleJsonPath)) return;
                        if (rolesDebounceTimers.has(roleJsonPath)) clearTimeout(rolesDebounceTimers.get(roleJsonPath));
                        const timer = setTimeout(async () => {
                            rolesDebounceTimers.delete(roleJsonPath);
                            await syncProcessRolesCore(roleJsonPath, rootPath, logger);
                        }, 500);
                        rolesDebounceTimers.set(roleJsonPath, timer);
                        return;
                    }
                }

                // 4. Diagram Tasks (metadata)
                if (filePath.endsWith('task.json') && filePath.includes('diagram') && filePath.includes('tasks')) {
                    if (diagramDebounceTimers.has(filePath)) clearTimeout(diagramDebounceTimers.get(filePath));
                    const timer = setTimeout(async () => {
                        diagramDebounceTimers.delete(filePath);
                        await syncDiagramTaskCore(filePath, rootPath, logger);
                    }, 500);
                    diagramDebounceTimers.set(filePath, timer);
                    return;
                }

                // 5. Diagram Task Scripts (NEW)
                if (filePath.endsWith('.js') && filePath.includes('diagram') && filePath.includes('tasks') && filePath.includes('script_')) {
                    if (diagramDebounceTimers.has(filePath)) clearTimeout(diagramDebounceTimers.get(filePath));
                    const timer = setTimeout(async () => {
                        diagramDebounceTimers.delete(filePath);
                        await syncDiagramTaskScriptCore(filePath, rootPath, logger);
                    }, 500);
                    diagramDebounceTimers.set(filePath, timer);
                    return;
                }

                // 6. version.json
                if (filePath.endsWith('version.json')) {
                    const versionFolder = path.dirname(filePath);
                    const possibleFieldsJs = [
                        path.join(versionFolder, 'pin', 'fields.js'),
                        path.join(versionFolder, 'pin', 'fields', 'fields.js')
                    ];
                    if (possibleFieldsJs.some(p => fs.existsSync(p))) return;

                    if (fieldsDebounceTimers.has(filePath)) clearTimeout(fieldsDebounceTimers.get(filePath));
                    const timer = setTimeout(async () => {
                        fieldsDebounceTimers.delete(filePath);
                        await syncFieldsProcessCore(filePath, rootPath, logger, classIdToIdentifier);
                    }, 500);
                    fieldsDebounceTimers.set(filePath, timer);
                }
            };

            watcher.on('change', handleFileChange);
            watcher.on('add', handleFileChange);

            // Handle directory creation for scaffolding
            watcher.on('addDir', async (dirPath) => {
                const absolutePath = path.join(rootPath, dirPath);
                const relativePath = path.relative(rootPath, absolutePath);
                const parts = relativePath.split(path.sep);

                if (parts.length === 6 && parts[3] === 'pin' && parts[4] === 'methods') {
                    const methodFolder = absolutePath;
                    const methodName = parts[5];
                    scaffoldMethod(methodFolder, rootPath, methodName, logger);
                    return;
                }

                if (parts.length === 6 && parts[3] === 'pin' && parts[4] === 'processRoles') {
                    const roleFolder = absolutePath;
                    const roleName = parts[5];
                    scaffoldProcessRole(roleFolder, rootPath, roleName, logger);
                    return;
                }
            });

            watcher.on('unlinkDir', async (dirPath) => {
                const absolutePath = path.join(rootPath, dirPath);
                await handleProcessMethodDeletion(absolutePath, rootPath, logger);
            });

            watcher.on('error', error => {
                logger.error('❌ Watcher error: ' + (error instanceof Error ? error.message : String(error)));
            });

            process.on('SIGINT', () => {
                logger.info('\n👋 Stopping file watcher...');
                watcher.close();
                process.exit(0);
            });

        } catch (error) {
            logger.error('❌ Watch process command failed: ' + (error instanceof Error ? error.message : String(error)));
        }
    });

module.exports = watchProcessCommand;
