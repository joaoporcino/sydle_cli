/**
 * @fileoverview Create Method Flow Utility
 * 
 * Interactive wizard for gathering method creation information.
 * Handles package/class/method selection with local file system discovery.
 * 
 * @module utils/createMethodFlow
 */

const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');

/**
 * Gets available packages from the root path
 * @param {string} rootPath - Root directory path
 * @returns {string[]} Array of package names
 */
function getAvailablePackages(rootPath) {
    if (!fs.existsSync(rootPath)) return [];
    return fs.readdirSync(rootPath).filter(f =>
        fs.statSync(path.join(rootPath, f)).isDirectory() && !f.startsWith('.')
    );
}

/**
 * Gets available classes from a package
 * @param {string} packagePath - Package directory path
 * @returns {string[]} Array of class names
 */
function getAvailableClasses(packagePath) {
    if (!fs.existsSync(packagePath)) return [];
    return fs.readdirSync(packagePath).filter(f =>
        fs.statSync(path.join(packagePath, f)).isDirectory() &&
        !f.startsWith('.') &&
        f !== 'package.json'
    );
}

/**
 * Gets available methods from a class
 * @param {string} classPath - Class directory path
 * @returns {string[]} Array of method names
 */
function getAvailableMethods(classPath) {
    if (!fs.existsSync(classPath)) return [];
    return fs.readdirSync(classPath).filter(f =>
        fs.statSync(path.join(classPath, f)).isDirectory() &&
        !f.startsWith('.') &&
        f !== 'class.json'
    );
}

/**
 * Prompts for package selection
 * @param {string | undefined} pkgArg - Package argument from CLI
 * @param {string} rootPath - Root directory path
 * @param {import('./logger').Logger} logger - Logger instance
 * @returns {Promise<string | null>} Package name or null if none available
 */
async function promptPackageSelection(pkgArg, rootPath, logger) {
    if (pkgArg) return pkgArg;

    const packages = getAvailablePackages(rootPath);

    if (packages.length === 0) {
        logger.error('❌ No packages found in local environment.');
        return null;
    }

    const ans = await inquirer.prompt([{
        type: 'list',
        name: 'pkg',
        message: 'Select a Package:',
        choices: packages
    }]);
    return ans.pkg;
}

/**
 * Prompts for class selection
 * @param {string | undefined} classArg - Class argument from CLI
 * @param {string} packagePath - Package directory path
 * @param {string} packageName - Package name for error messages
 * @param {import('./logger').Logger} logger - Logger instance
 * @returns {Promise<string | null>} Class name or null if none available
 */
async function promptClassSelection(classArg, packagePath, packageName, logger) {
    if (classArg) return classArg;

    if (!fs.existsSync(packagePath)) {
        logger.error(`❌ Package '${packageName}' not found.`);
        return null;
    }

    const classes = getAvailableClasses(packagePath);

    if (classes.length === 0) {
        logger.error(`❌ No classes found in package '${packageName}'.`);
        return null;
    }

    const ans = await inquirer.prompt([{
        type: 'list',
        name: 'cls',
        message: 'Select a Class:',
        choices: classes
    }]);
    return ans.cls;
}

/**
 * Prompts for method name input
 * @param {string | undefined} methodArg - Method argument from CLI
 * @returns {Promise<string>} Method name
 */
async function promptMethodName(methodArg) {
    if (methodArg) return methodArg;

    const ans = await inquirer.prompt([{
        type: 'input',
        name: 'method',
        message: 'Method Name:',
        validate: input => input ? true : 'Method name is required'
    }]);
    return ans.method;
}

/**
 * Prompts for method selection from existing methods
 * @param {string | undefined} methodArg - Method argument from CLI
 * @param {string} classPath - Class directory path
 * @param {string} className - Class name for error messages
 * @param {import('./logger').Logger} logger - Logger instance
 * @param {string} [actionVerb='Select'] - Action verb for the prompt
 * @returns {Promise<string | null>} Method name or null if none available
 */
async function promptMethodSelection(methodArg, classPath, className, logger, actionVerb = 'Select') {
    if (methodArg) return methodArg;

    const methods = getAvailableMethods(classPath);

    if (methods.length === 0) {
        logger.error(`❌ No methods found in class '${className}'.`);
        return null;
    }

    const ans = await inquirer.prompt([{
        type: 'list',
        name: 'method',
        message: `${actionVerb} a Method:`,
        choices: methods
    }]);
    return ans.method;
}

/**
 * Determines the environment and root path from current API URL
 * @returns {{ env: string, rootFolder: string, rootPath: string }}
 */
function determineEnvironment() {
    const url = process.env.SYDLE_API_URL || '';
    let env = 'prod';
    if (url.includes('dev')) env = 'dev';
    else if (url.includes('hom')) env = 'hom';

    const rootFolder = `sydle-${env}`;
    const rootPath = path.join(process.cwd(), rootFolder);

    return { env, rootFolder, rootPath };
}

/**
 * Validates that the root path exists
 * @param {string} rootPath - Root directory path
 * @param {import('./logger').Logger} logger - Logger instance
 * @returns {boolean} True if exists
 */
function validateRootPath(rootPath, logger) {
    if (!fs.existsSync(rootPath)) {
        logger.error(`❌ Directory not found: ${rootPath}`);
        logger.info(`   Run 'sydle init' or 'sydle obterPacote' first.`);
        return false;
    }
    return true;
}

module.exports = {
    getAvailablePackages,
    getAvailableClasses,
    getAvailableMethods,
    promptPackageSelection,
    promptClassSelection,
    promptMethodName,
    promptMethodSelection,
    determineEnvironment,
    validateRootPath
};
