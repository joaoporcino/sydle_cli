const { Command } = require('commander');
const { glob } = require('glob');
const fs = require('fs');
const path = require('path');
const { get, patch } = require('../api/main');
const { ensureAuth } = require('../utils/authFlow');
const config = require('../utils/config');
const { createLogger } = require('../utils/logger');

const syncCommand = new Command('sincronizar')
    .alias('sync')
    .description('Sync script files to Sydle')
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
            if (syncPath) {
                const parts = syncPath.split('.');
                if (parts.length === 3) {
                    // Specific method: package.class.method
                    const [pkg, cls, method] = parts;
                    pattern = `${pkg.split('.').join('/')}/${cls}/${method}/method.json`;
                } else if (parts.length === 2) {
                    // Specific class: package.class
                    const [pkg, cls] = parts;
                    pattern = `${pkg.split('.').join('/')}/${cls}/*/method.json`;
                } else if (parts.length === 1) {
                    // Specific package
                    pattern = `${parts[0].split('.').join('/')}/**/method.json`;
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

            // Sync each method
            for (const methodFile of methodFiles) {
                const result = await syncMethod(path.join(rootPath, methodFile), classId, rootPath, logger);
                if (result.success) {
                    successCount++;
                } else {
                    failCount++;
                }
            }

            // Summary
            const summaryLines = [
                `✓ Successfully synced: ${successCount} method(s)`
            ];
            if (failCount > 0) {
                summaryLines.push(`✗ Failed: ${failCount} method(s)`);
            }
            logger.summary(summaryLines);

        } catch (error) {
            logger.error('❌ Sync command failed: ' + error.message);
            if (options.verbose) {
                logger.debug(error.stack);
            }
        }
    });

const { syncMethodCore } = require('../core/syncLogic');

async function syncMethod(methodJsonPath, classId, rootPath, logger) {
    return await syncMethodCore(methodJsonPath, classId, rootPath, logger);
}

module.exports = syncCommand;
