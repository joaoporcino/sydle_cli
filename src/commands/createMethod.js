const { Command } = require('commander');
const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');
const { ensureAuth } = require('../utils/authFlow');
const { createLogger } = require('../utils/logger');
const { scaffoldMethod } = require('../utils/scaffoldMethod');

const createMethodCommand = new Command('criarMetodo')
    .alias('createMethod')
    .description('Scaffold a new method for a class')
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
                    const ans = await inquirer.prompt([{
                        type: 'input',
                        name: 'method',
                        message: 'Method Name:',
                        validate: input => input ? true : 'Method name is required'
                    }]);
                    methodName = ans.method;
                }
            }

            // 4. Validate Paths
            const classPath = path.join(rootPath, packageName, className);
            if (!fs.existsSync(classPath)) {
                logger.error(`❌ Class folder not found: ${packageName}/${className}`);
                return;
            }

            const methodFolder = path.join(classPath, methodName);

            // 5. Check if method already exists
            if (fs.existsSync(methodFolder)) {
                logger.error(`❌ Method '${methodName}' already exists at path:`);
                logger.log(`   ${methodFolder}`);
                return;
            }

            // 6. Scaffold
            // Create the folder first so scaffoldMethod can do its work (it expects folder path)
            fs.mkdirSync(methodFolder, { recursive: true });

            const success = scaffoldMethod(methodFolder, rootPath, methodName, logger);

            if (success) {
                logger.success('\n✅ Method successfully created!');
                logger.info('   Run \'sydle watch\' to sync edits automatically.');
            } else {
                logger.warn('⚠ Scaffolding function returned false (files might already exist).');
            }

        } catch (error) {
            logger.error(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
            if (options.verbose) logger.debug(error.stack);
        }
    });

module.exports = createMethodCommand;
