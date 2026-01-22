const { Command } = require('commander');
const { glob } = require('glob');
const fs = require('fs');
const path = require('path');
const { ensureAuth } = require('../utils/authFlow');
const config = require('../utils/config');
const { createLogger } = require('../utils/logger');
const { syncMethodCore, ensureClassExists } = require('../core/syncLogic');
const { syncFieldsCore } = require('../core/syncFields');

const syncCommand = new Command('sincronizarClasse')
    .alias('syncClass')
    .description('Sync script files to Sydle (Classes only)')
    .argument('[path]', 'Optional path: package.class.method, package.class, or package')
    .option('-v, --verbose', 'Show verbose logging')
    .action(async (syncPath, options) => {
        const logger = createLogger(options.verbose);

        try {
            if (!(await ensureAuth())) {
                return;
            }

            // Ensure the main token matches the current env URL if available in envTokens
            const currentUrl = process.env.SYDLE_API_URL;
            if (currentUrl) {
                const envTokens = config.get('envTokens') || {};
                const specificToken = envTokens[currentUrl];
                const currentToken = config.get('token');

                if (specificToken && specificToken !== currentToken) {
                    config.set('token', specificToken);
                    logger.info(`🔑 Switched to stored authentication token for ${currentUrl}`);
                }
            }

            const classId = '000000000000000000000000';
            let url = process.env.SYDLE_API_URL;
            let env = 'prod';
            if (url.includes('dev')) env = 'dev';
            else if (url.includes('hom')) env = 'hom';

            const rootFolder = `sydle-${env}`;
            const rootPath = path.join(process.cwd(), rootFolder);

            if (!fs.existsSync(rootPath)) {
                logger.error(`❌ Directory not found: ${rootPath}`);
                logger.info(`   Run 'sydle init' or 'sydle obterPacote' first.`);
                return;
            }

            logger.info('🔍 Scanning for methods to sync...\n');

            // Build glob pattern based on path
            let pattern = '**/method.json';
            let classPattern = '**/class.json';
            let fieldsPattern = '**/fields.js';
            if (syncPath) {
                const parts = syncPath.split('.');
                if (parts.length === 3) {
                    // Specific method: package.class.method
                    const [pkg, cls, method] = parts;
                    pattern = `${pkg.split('.').join('/')}/${cls}/${method}/method.json`;
                    classPattern = `${pkg.split('.').join('/')}/${cls}/class.json`;
                    fieldsPattern = `${pkg.split('.').join('/')}/${cls}/fields.js`;
                } else if (parts.length === 2) {
                    // Specific class: package.class
                    const [pkg, cls] = parts;
                    pattern = `${pkg.split('.').join('/')}/${cls}/*/method.json`;
                    classPattern = `${pkg.split('.').join('/')}/${cls}/class.json`;
                    fieldsPattern = `${pkg.split('.').join('/')}/${cls}/fields.js`;
                } else if (parts.length === 1) {
                    // Specific package
                    pattern = `${parts[0].split('.').join('/')}/**/method.json`;
                    classPattern = `${parts[0].split('.').join('/')}/**/class.json`;
                    fieldsPattern = `${parts[0].split('.').join('/')}/**/fields.js`;
                }
            }

            // Sync Classes first
            const classFiles = await glob(classPattern, {
                cwd: rootPath,
                absolute: false,
                nodir: true
            });

            let classesCreated = 0;
            for (const classFile of classFiles) {
                const classJsonPath = path.join(rootPath, classFile);
                const result = await ensureClassExists(classJsonPath, logger);
                if (result.created) {
                    classesCreated++;
                }
            }

            if (classesCreated > 0) {
                logger.info(`\n📦 Created ${classesCreated} class(es) in Sydle\n`);
            }

            // Sync fields.js files
            const fieldsFiles = await glob(fieldsPattern, {
                cwd: rootPath,
                absolute: false,
                nodir: true
            });

            let fieldsSynced = 0;
            let fieldsSkipped = 0;
            for (const fieldsFile of fieldsFiles) {
                const fieldsJsPath = path.join(rootPath, fieldsFile);
                const result = await syncFieldsCore(fieldsJsPath, classId, rootPath, logger);
                if (result.success) {
                    fieldsSynced++;
                } else if (result.message === 'No fields defined') {
                    fieldsSkipped++;
                }
            }

            // Find all method.json files
            const methodFiles = await glob(pattern, {
                cwd: rootPath,
                absolute: false,
                nodir: true
            });

            if (methodFiles.length === 0) {
                logger.error(`❌ No methods found matching: ${syncPath || 'all'}`);
                return;
            }

            logger.info(`📦 Found ${methodFiles.length} method(s) to sync\n`);

            let successCount = 0;
            let failCount = 0;
            let skippedCount = 0;

            // Sync each method
            for (const methodFile of methodFiles) {
                const result = await syncMethodCore(path.join(rootPath, methodFile), classId, rootPath, logger);
                if (result.success) {
                    if (result.skipped) {
                        skippedCount++;
                    } else {
                        successCount++;
                    }
                } else {
                    failCount++;
                }
            }

            // Summary
            const summaryLines = [];
            if (classesCreated > 0) {
                summaryLines.push(`✓ Created classes: ${classesCreated}`);
            }
            if (fieldsSynced > 0) {
                summaryLines.push(`✓ Synced fields: ${fieldsSynced}`);
            }
            if (successCount > 0) {
                summaryLines.push(`✓ Synced methods: ${successCount}`);
            }
            if (skippedCount > 0) {
                summaryLines.push(`⏭ Skipped (no scripts): ${skippedCount}`);
            }
            if (failCount > 0) {
                summaryLines.push(`✗ Failed: ${failCount}`);
            }
            if (summaryLines.length === 0) {
                summaryLines.push('No changes made');
            }
            logger.summary(summaryLines);

        } catch (error) {
            logger.error('❌ Sync command failed: ' + error.message);
            if (options.verbose) {
                logger.debug(error.stack);
            }
        }
    });

module.exports = syncCommand;

