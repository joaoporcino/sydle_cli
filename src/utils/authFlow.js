const inquirer = require('inquirer');
const { signIn } = require('../api/auth');
const config = require('./config');
const { setEnvValue } = require('./env');
const { logger } = require('./logger');

const performLogin = async (username, password, url) => {
    // Save URL to .env if provided
    if (url) {
        setEnvValue('SYDLE_API_URL', url);
        process.env.SYDLE_API_URL = url;

        // Auto-detect and save specific environment URL
        let envKey = 'SYDLE_URL_PROD';
        if (url.includes('-dev') || url.includes('/dev')) envKey = 'SYDLE_URL_DEV';
        else if (url.includes('-hom') || url.includes('/hom')) envKey = 'SYDLE_URL_HOM';

        setEnvValue(envKey, url);
        process.env[envKey] = url;

        logger.info(`Configuration saved to .env (SYDLE_API_URL and ${envKey})`);
    }

    logger.progress('Logging in...');
    const data = await signIn(username, password);

    if (data.accessToken && data.accessToken.token) {
        config.set('token', data.accessToken.token);

        // Store token in envTokens map
        const tokenUrl = url || process.env.SYDLE_API_URL;
        if (tokenUrl) {
            const envTokens = config.get('envTokens') || {};
            envTokens[tokenUrl] = data.accessToken.token;
            config.set('envTokens', envTokens);
        }

        logger.success('Login successful! Token saved.');
        return true;
    } else {
        logger.error('Login failed: No token received.');
        return false;
    }
};

const ensureAuth = async (force = false) => {
    let url = process.env.SYDLE_API_URL;
    let token = config.get('token');

    if (!force && url && token) {
        return true;
    }

    // 1. Ask for environment
    const envChoices = ['dev', 'hom', 'prod', 'custom'];
    const { environment } = await inquirer.prompt([
        {
            type: 'list',
            name: 'environment',
            message: 'Select the environment:',
            choices: envChoices
        }
    ]);

    // 2. Resolve URL based on environment
    let selectedUrl = null;
    if (environment !== 'custom') {
        const envVarName = `SYDLE_URL_${environment.toUpperCase()}`;
        if (process.env[envVarName]) {
            selectedUrl = process.env[envVarName];
            logger.info(`Using stored URL for ${environment}: ${selectedUrl}`);
        }
    }

    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'url',
            message: 'Enter the API Base URL:',
            default: selectedUrl || process.env.SYDLE_API_URL || 'https://cbmsa-dev.sydle.one/api/1',
            when: !selectedUrl // Only ask if we didn't find it in env vars OR user selected custom/override
        },
        {
            type: 'input',
            name: 'username',
            message: 'Enter your username:'
        },
        {
            type: 'password',
            name: 'password',
            message: 'Enter your password:'
        }
    ]);

    // If URL was prompted, use it. Otherwise use the one we looked up.
    const finalUrl = answers.url || selectedUrl || url;

    return await performLogin(answers.username, answers.password, finalUrl);
};

module.exports = { performLogin, ensureAuth };
