/**
 * @fileoverview Delete Method Command
 * 
 * CLI command to delete a method folder and optionally remove from Sydle.
 * Portuguese: sydle excluirMetodo
 * English alias: sydle deleteMethod
 * 
 * @module commands/deleteMethod
 */

const { Command } = require('commander');
const fs = require('fs');
const path = require('path');
const { ensureAuth } = require('../utils/authFlow');
const { createLogger } = require('../utils/logger');
const { handleMethodDeletion } = require('../utils/deleteMethod');
const {
    determineEnvironment,
    validateRootPath,
    promptPackageSelection,
    promptClassSelection,
    promptMethodSelection
} = require('../utils/methodFlow');

const deleteMethodCommand = new Command('excluirMetodo')
    .alias('deleteMethod')
    .description('Delete a method folder and optionally remove it from Sydle')
    .argument('[package]', 'Package identifier')
    .argument('[class]', 'Class identifier')
    .argument('[method]', 'Method identifier')
    .option('-v, --verbose', 'Show verbose logging')
    .action(async (pkgArg, classArg, methodArg, options) => {
        const logger = createLogger(options.verbose);

        try {
            // 1. Authentication Check
            if (!(await ensureAuth())) {
                return;
            }

            // 2. Determine Environment and Root Path
            const { rootPath } = determineEnvironment();

            if (!validateRootPath(rootPath, logger)) {
                return;
            }

            // 3. Interactive Prompts
            const packageName = await promptPackageSelection(pkgArg, rootPath, logger);
            if (!packageName) return;

            const packagePath = path.join(rootPath, packageName);
            const className = await promptClassSelection(classArg, packagePath, packageName, logger);
            if (!className) return;

            const classPath = path.join(packagePath, className);
            const methodName = await promptMethodSelection(
                methodArg,
                classPath,
                className,
                logger,
                'Select a Method to DELETE'
            );
            if (!methodName) return;

            // 4. Validate Path
            const methodFolder = path.join(classPath, methodName);

            if (!fs.existsSync(methodFolder)) {
                logger.error(`❌ Method folder not found: ${packageName}/${className}/${methodName}`);
                return;
            }

            // 5. Execute Logic
            logger.warn(`\n⚠ Process initiating for: ${methodName}`);
            logger.info('   Deleting local folder locally first...');

            try {
                fs.rmSync(methodFolder, { recursive: true, force: true });
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                logger.error(`❌ Failed to delete local folder: ${message}`);
                return;
            }

            // Delegate to the utility that handles logic (confirmation, system check, rollback)
            await handleMethodDeletion(methodFolder, rootPath, logger);

        } catch (error) {
            logger.error(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
            if (options.verbose && error instanceof Error) logger.debug(error.stack);
        }
    });

module.exports = deleteMethodCommand;
