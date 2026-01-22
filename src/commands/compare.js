/**
 * @fileoverview Compare Command
 * 
 * CLI command to compare code between two environments.
 * Portuguese: sydle comparar
 * English alias: sydle compare
 * 
 * @module commands/compare
 */

const { Command } = require('commander');
const path = require('path');
const { createLogger } = require('../utils/logger');
const {
    promptCompareArgs,
    getCurrentUrl,
    resolveUrl,
    getTokenForUrl,
    ensureEnvironmentAccess,
    fetchMethodData,
    generateDiffFiles
} = require('../utils/compareFlow');

const compareCommand = new Command('comparar')
    .alias('compare')
    .description('Compare code between environments (dev/hom/prod)')
    .argument('[class]', 'Class identifier')
    .argument('[method]', 'Method identifier')
    .argument('[source]', 'Source environment (dev, hom, prod)')
    .argument('[target]', 'Target environment (dev, hom, prod)')
    .option('-v, --verbose', 'Mostrar logs detalhados')
    .action(async (classArg, methodArg, sourceArg, targetArg, options) => {
        const logger = createLogger(options.verbose);
        try {
            // 1. Interactive flow for missing arguments
            const args = await promptCompareArgs({
                classIdentifier: classArg,
                methodIdentifier: methodArg,
                sourceEnv: sourceArg,
                targetEnv: targetArg
            });

            const { classIdentifier, methodIdentifier, sourceEnv, targetEnv } = args;

            // 2. Ensure access to both environments
            await ensureEnvironmentAccess(sourceEnv, logger);
            await ensureEnvironmentAccess(targetEnv, logger);

            // 3. Resolve URLs and tokens
            const sourceUrl = resolveUrl(sourceEnv);
            const targetUrl = resolveUrl(targetEnv);

            logger.info(`Source URL (${sourceEnv}): ${sourceUrl}`);
            logger.info(`Target URL (${targetEnv}): ${targetUrl}`);

            const sourceToken = getTokenForUrl(sourceUrl);
            const targetToken = getTokenForUrl(targetUrl);

            if (!sourceToken) logger.warn(`Warning: No token found for source URL ${sourceUrl}`);
            if (!targetToken) logger.warn(`Warning: No token found for target URL ${targetUrl}`);

            // 4. Fetch method data from both environments
            const [sourceData, targetData] = await Promise.all([
                fetchMethodData(sourceUrl, sourceEnv, sourceToken, classIdentifier, methodIdentifier),
                fetchMethodData(targetUrl, targetEnv, targetToken, classIdentifier, methodIdentifier)
            ]);

            // 5. Determine output folder
            const currentUrl = getCurrentUrl();
            let rootEnv = 'dev';
            if (currentUrl && currentUrl.includes('hom')) rootEnv = 'hom';
            if (currentUrl && currentUrl.includes('prod')) rootEnv = 'prod';

            const rootName = `sydle-${rootEnv}`;
            const scriptsPath = path.join(
                process.cwd(),
                rootName,
                ...sourceData.packageIdentifier.split('.'),
                classIdentifier,
                methodIdentifier,
                'scripts'
            );

            // 6. Generate diff files
            generateDiffFiles({
                sourceScripts: sourceData.scripts,
                targetScripts: targetData.scripts,
                scriptsPath,
                sourceEnv,
                targetEnv,
                sourceUrl,
                targetUrl
            }, logger);

            logger.success('Open the conflict file(s) to view and merge changes manually if preferred.');

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error(`Compare command failed: ${message}`);
            if (options.verbose && error instanceof Error) logger.debug(error.stack);
        }
    });

module.exports = compareCommand;
