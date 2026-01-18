/**
 * @fileoverview Compare Flow Utility
 * 
 * Interactive wizard and helpers for comparing code between environments.
 * Handles environment resolution, authentication, and diff generation.
 * 
 * @module utils/compareFlow
 */

const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { performLogin } = require('./authFlow');
const { createClient } = require('../api/client');

/**
 * Prompts for compare command arguments
 * @param {Object} args - Existing arguments
 * @param {string} [args.classIdentifier] - Class identifier
 * @param {string} [args.methodIdentifier] - Method identifier  
 * @param {string} [args.sourceEnv] - Source environment
 * @param {string} [args.targetEnv] - Target environment
 * @returns {Promise<{ classIdentifier: string, methodIdentifier: string, sourceEnv: string, targetEnv: string }>}
 */
async function promptCompareArgs(args) {
    const questions = [];

    if (!args.classIdentifier) {
        questions.push({
            type: 'input',
            name: 'classIdentifier',
            message: 'Class identifier:',
            validate: input => input.trim() ? true : 'Class identifier is required'
        });
    }
    if (!args.methodIdentifier) {
        questions.push({
            type: 'input',
            name: 'methodIdentifier',
            message: 'Method identifier:',
            validate: input => input.trim() ? true : 'Method identifier is required'
        });
    }
    if (!args.sourceEnv) {
        questions.push({
            type: 'list',
            name: 'sourceEnv',
            message: 'Source environment:',
            choices: ['dev', 'hom', 'prod'],
            default: 'dev'
        });
    }
    if (!args.targetEnv) {
        questions.push({
            type: 'list',
            name: 'targetEnv',
            message: 'Target environment:',
            choices: ['dev', 'hom', 'prod'],
            default: 'hom'
        });
    }

    if (questions.length > 0) {
        const promptAnswers = await inquirer.prompt(questions);
        return { ...args, ...promptAnswers };
    }

    return /** @type {{ classIdentifier: string, methodIdentifier: string, sourceEnv: string, targetEnv: string }} */ (args);
}

/**
 * Gets environment tokens from config
 * @returns {Record<string, string>}
 */
function getEnvTokens() {
    return config.get('envTokens') || {};
}

/**
 * Gets current API URL
 * @returns {string | undefined}
 */
function getCurrentUrl() {
    return config.get('baseUrl') || process.env.SYDLE_API_URL;
}

/**
 * Gets default token
 * @returns {string | undefined}
 */
function getDefaultToken() {
    return config.get('token');
}

/**
 * Resolves environment alias to URL
 * @param {string} envAlias - Environment alias (dev, hom, prod)
 * @returns {string} Resolved URL or alias
 */
function resolveUrl(envAlias) {
    // Check for explicit environment variables in .env
    const envVarName = `SYDLE_URL_${envAlias.toUpperCase()}`;
    if (process.env[envVarName]) return process.env[envVarName];

    const envTokens = getEnvTokens();
    // Check if we have a stored token for a URL matching the alias
    const storedUrl = Object.keys(envTokens).find(url =>
        url.includes(`-${envAlias}`) || url.includes(`/${envAlias}`)
    );
    if (storedUrl) return storedUrl;

    const currentUrl = getCurrentUrl();
    // Heuristic based on current URL
    if (currentUrl) {
        let base = currentUrl;
        let currentEnv = 'prod';
        if (base.includes('-dev')) currentEnv = 'dev';
        else if (base.includes('-hom')) currentEnv = 'hom';

        if (envAlias === currentEnv) return base;

        if (currentEnv !== 'prod' && envAlias !== 'prod') {
            return base.replace(`-${currentEnv}`, `-${envAlias}`);
        }

        if (base.includes('dev')) {
            return base.replace('dev', envAlias === 'prod' ? '' : envAlias)
                .replace('-.', '.').replace('..', '.');
        }
        if (base.includes('hom')) {
            return base.replace('hom', envAlias === 'prod' ? '' : envAlias)
                .replace('-.', '.').replace('..', '.');
        }

        return base;
    }

    // Fallback
    return envAlias;
}

/**
 * Gets token for a specific URL
 * @param {string} url - URL to get token for
 * @returns {string | undefined}
 */
function getTokenForUrl(url) {
    const envTokens = getEnvTokens();
    if (envTokens[url]) return envTokens[url];

    const currentUrl = getCurrentUrl();
    const defaultToken = getDefaultToken();
    if (currentUrl && url === currentUrl) return defaultToken;

    return defaultToken;
}

/**
 * Checks if string is a valid URL
 * @param {string | undefined} u - String to check
 * @returns {boolean}
 */
function isValidUrl(u) {
    return u ? (u.startsWith('http://') || u.startsWith('https://')) : false;
}

/**
 * Ensures access to an environment, prompting for login if needed
 * @param {string} envAlias - Environment alias
 * @returns {Promise<void>}
 */
async function ensureEnvironmentAccess(envAlias) {
    let url = resolveUrl(envAlias);
    let token = isValidUrl(url) ? getTokenForUrl(url) : null;

    if (!isValidUrl(url) || !token) {
        console.log(`\n! Access missing for environment: ${envAlias} (URL: ${url})`);

        const { shouldLogin } = await inquirer.prompt([{
            type: 'confirm',
            name: 'shouldLogin',
            message: `Would you like to login to ${envAlias} now?`,
            default: true
        }]);

        if (shouldLogin) {
            const loginAnswers = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'url',
                    message: `API URL for ${envAlias}:`,
                    default: isValidUrl(url) ? url : undefined,
                    validate: input => input.startsWith('http') ? true : 'Must be a valid URL starting with http'
                },
                { type: 'input', name: 'username', message: 'Username:' },
                { type: 'password', name: 'password', message: 'Password:' }
            ]);

            await performLogin(loginAnswers.username, loginAnswers.password, loginAnswers.url);
        }
    }
}

/**
 * Fetches method data from an environment
 * @param {string} baseUrl - Base API URL
 * @param {string} envName - Environment name for logging
 * @param {string} token - Auth token
 * @param {string} classIdentifier - Class identifier
 * @param {string} methodIdentifier - Method identifier
 * @returns {Promise<{ scripts: string[], packageIdentifier: string }>}
 */
async function fetchMethodData(baseUrl, envName, token, classIdentifier, methodIdentifier) {
    if (!token) throw new Error('No authentication token available.');

    const client = createClient(baseUrl, token);

    // Search for class
    const searchUrl = `/main/_classId/000000000000000000000000/_search`;
    const searchResponse = await client.post(searchUrl, {
        query: { term: { "identifier.keyword": classIdentifier } },
        size: 1
    });

    const hits = searchResponse.data?.hits?.hits;
    if (!hits || hits.length === 0) {
        throw new Error(`Class ${classIdentifier} not found in ${envName}`);
    }

    const classId = hits[0]._id;
    const packageId = hits[0]._source.package._id;

    // Fetch full class
    const classUrl = `/main/_classId/000000000000000000000000/_get`;
    const classResponse = await client.post(classUrl, { _id: classId });

    const _class = classResponse.data;
    const method = (_class.methods || []).find(m => m.identifier === methodIdentifier);
    if (!method) {
        throw new Error(`Method ${methodIdentifier} not found in class ${classIdentifier} in ${envName}`);
    }

    // Fetch package info for folder structure
    const packageUrl = `/main/_classId/000000000000000000000015/_get`;
    const packageResponse = await client.post(packageUrl, { _id: packageId });

    return {
        scripts: method.scripts || [],
        packageIdentifier: packageResponse.data.identifier
    };
}

/**
 * Generates diff/merge files for scripts
 * @param {Object} options - Options
 * @param {string[]} options.sourceScripts - Source scripts
 * @param {string[]} options.targetScripts - Target scripts
 * @param {string} options.scriptsPath - Output path for scripts
 * @param {string} options.sourceEnv - Source environment name
 * @param {string} options.targetEnv - Target environment name
 * @param {string} options.sourceUrl - Source URL
 * @param {string} options.targetUrl - Target URL
 */
function generateDiffFiles({ sourceScripts, targetScripts, scriptsPath, sourceEnv, targetEnv, sourceUrl, targetUrl }) {
    if (!fs.existsSync(scriptsPath)) {
        fs.mkdirSync(scriptsPath, { recursive: true });
    }

    const tempDir = path.join(process.cwd(), '.tmp_diff');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

    const maxScripts = Math.max(sourceScripts.length, targetScripts.length);
    console.log(`\nFound ${sourceScripts.length} script(s) in Source and ${targetScripts.length} in Target.`);
    console.log(`Output folder: ${scriptsPath}`);

    for (let i = 0; i < maxScripts; i++) {
        const sScript = sourceScripts[i] || '';
        const tScript = targetScripts[i] || '';

        const scriptFileName = `script_${i + 1}.js`;
        const scriptPath = path.join(scriptsPath, scriptFileName);

        // Ensure it exists with Source content
        if (!fs.existsSync(scriptPath)) {
            fs.writeFileSync(scriptPath, sScript);
        }

        console.log(`Target Script: ${scriptFileName}`);

        // Prepare temporary files for 3-way merge
        const sourceFile = path.join(tempDir, `merge_local_${i + 1}.js`);
        const targetFile = path.join(tempDir, `merge_remote_${i + 1}.js`);
        const baseFile = path.join(tempDir, `merge_base_${i + 1}.js`);

        fs.writeFileSync(sourceFile, sScript);
        fs.writeFileSync(targetFile, tScript);
        fs.writeFileSync(baseFile, sScript);

        // Check for VS Code environment
        const isVsCode = process.env.TERM_PROGRAM === 'vscode';

        if (i === 0 && isVsCode) {
            console.log('Opening VS Code Merge Editor...');
            console.log('  Current (Left): Source Env');
            console.log('  Incoming (Right): Target Env');
            console.log('  Result: Saving will update script file');

            const { exec } = require('child_process');
            exec(`code --merge "${sourceFile}" "${targetFile}" "${baseFile}" "${scriptPath}"`);
        } else {
            // Fallback: generate conflict file
            const conflictContent = `<<<<<<< ${sourceEnv.toUpperCase()} (${sourceUrl})
${sScript}
=======
${tScript}
>>>>>>> ${targetEnv.toUpperCase()} (${targetUrl})
`;
            const diffFileName = `diff_script_${i + 1}_${sourceEnv}_${targetEnv}.js`;
            const fullDiffPath = path.join(scriptsPath, diffFileName);
            fs.writeFileSync(fullDiffPath, conflictContent);

            if (i === 0) console.log(`Manual merge required (Editor auto-launch skipped).`);
            console.log(`Generated standard conflict file: ${diffFileName}`);
        }
    }
}

module.exports = {
    promptCompareArgs,
    getEnvTokens,
    getCurrentUrl,
    getDefaultToken,
    resolveUrl,
    getTokenForUrl,
    isValidUrl,
    ensureEnvironmentAccess,
    fetchMethodData,
    generateDiffFiles
};
