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
    .description('Compare code between two environments (dev, hom, prod)')
    .argument('[classIdentifier]', 'Class identifier')
    .argument('[methodIdentifier]', 'Method identifier')
    .argument('[sourceEnv]', 'Source environment (dev, hom, prod)')
    .argument('[targetEnv]', 'Target environment (dev, hom, prod)')
    .action(async (classIdentifierArg, methodIdentifierArg, sourceEnvArg, targetEnvArg) => {
        try {
            // 1. Interactive flow for missing arguments
            const args = await promptCompareArgs({
                classIdentifier: classIdentifierArg,
                methodIdentifier: methodIdentifierArg,
                sourceEnv: sourceEnvArg,
                targetEnv: targetEnvArg
            });

            const { classIdentifier, methodIdentifier, sourceEnv, targetEnv } = args;

            // 2. Ensure access to both environments
            await ensureEnvironmentAccess(sourceEnv);
            await ensureEnvironmentAccess(targetEnv);

            // 3. Resolve URLs and tokens
            const sourceUrl = resolveUrl(sourceEnv);
            const targetUrl = resolveUrl(targetEnv);

            console.log(`Source URL (${sourceEnv}): ${sourceUrl}`);
            console.log(`Target URL (${targetEnv}): ${targetUrl}`);

            const sourceToken = getTokenForUrl(sourceUrl);
            const targetToken = getTokenForUrl(targetUrl);

            if (!sourceToken) console.warn(`Warning: No token found for source URL ${sourceUrl}`);
            if (!targetToken) console.warn(`Warning: No token found for target URL ${targetUrl}`);

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
            });

            console.log('Open the conflict file(s) to view and merge changes manually if preferred.');

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('Compare command failed:', message);
        }
    });

module.exports = compareCommand;
