const { Command } = require('commander');
const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');
const { ensureAuth } = require('../utils/authFlow');
const { createLogger } = require('../utils/logger');
const { handleMethodDeletion } = require('../utils/deleteMethod');

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

            let packageName = pkgArg;
            let className = classArg;
            let methodName = methodArg;

            // 3. Interactive Prompts if arguments are missing
            if (!packageName || !className || !methodName) {

                // Get available packages
                const packages = fs.readdirSync(rootPath).filter(f =>
                    fs.statSync(path.join(rootPath, f)).isDirectory() && !f.startsWith('.')
                );

                if (packages.length === 0) {
                    logger.error('❌ No packages found in local environment.');
                    return;
                }

                if (!packageName) {
                    const ans = await inquirer.prompt([{
                        type: 'list',
                        name: 'pkg',
                        message: 'Select a Package:',
                        choices: packages
                    }]);
                    packageName = ans.pkg;
                }

                // Get available classes in the package
                const packagePath = path.join(rootPath, packageName);

                if (!fs.existsSync(packagePath)) {
                    logger.error(`❌ Package '${packageName}' not found.`);
                    return;
                }

                if (!className) {
                    const classes = fs.readdirSync(packagePath).filter(f =>
                        fs.statSync(path.join(packagePath, f)).isDirectory() && !f.startsWith('.') && f !== 'package.json'
                    );

                    if (classes.length === 0) {
                        logger.error(`❌ No classes found in package '${packageName}'.`);
                        return;
                    }

                    const ans = await inquirer.prompt([{
                        type: 'list',
                        name: 'cls',
                        message: 'Select a Class:',
                        choices: classes
                    }]);
                    className = ans.cls;
                }

                if (!methodName) {
                    // List available methods
                    const classPath = path.join(packagePath, className);
                    const methods = fs.readdirSync(classPath).filter(f =>
                        fs.statSync(path.join(classPath, f)).isDirectory() && !f.startsWith('.') && f !== 'class.json'
                    );

                    if (methods.length === 0) {
                        logger.error(`❌ No methods found in class '${className}'.`);
                        return;
                    }

                    const ans = await inquirer.prompt([{
                        type: 'list',
                        name: 'method',
                        message: 'Select a Method to DELETE:',
                        choices: methods
                    }]);
                    methodName = ans.method;
                }
            }

            // 4. Validate Paths
            const classPath = path.join(rootPath, packageName, className);
            const methodFolder = path.join(classPath, methodName);

            if (!fs.existsSync(methodFolder)) {
                logger.error(`❌ Method folder not found: ${packageName}/${className}/${methodName}`);
                return;
            }

            // 5. Execute Logic
            // We simulate the watcher behavior: delete the folder first, then call the handler.
            // The handler will confirm with the user and either patch Sydle (delete) or restore the folder.

            logger.warn(`\n⚠ Process initiating for: ${methodName}`);
            logger.info('   Deleting local folder locally first...');

            try {
                fs.rmSync(methodFolder, { recursive: true, force: true });
            } catch (err) {
                logger.error(`❌ Failed to delete local folder: ${err.message}`);
                return;
            }

            // Delegate to the utility that handles logic (confirmation, system check, rollback)
            await handleMethodDeletion(methodFolder, rootPath, logger);

        } catch (error) {
            logger.error(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
            if (options.verbose) logger.debug(error.stack);
        }
    });

module.exports = deleteMethodCommand;
