const inquirer = require('inquirer');
const { signIn } = require('../api/auth');
const config = require('./config');
const { setEnvValue } = require('./env');

const performLogin = async (username, password, url) => {
    // Save URL to .env if provided
    if (url) {
        setEnvValue('SYDLE_API_URL', url);
        process.env.SYDLE_API_URL = url;
        console.log('Configuration saved to .env');
    }

    console.log('Logging in...');
    const data = await signIn(username, password);

    if (data.accessToken && data.accessToken.token) {
        config.set('token', data.accessToken.token);
        console.log('Login successful! Token saved.');
        return true;
    } else {
        console.error('Login failed: No token received.');
        return false;
    }
};

const ensureAuth = async (force = false) => {
    let url = process.env.SYDLE_API_URL;
    let token = config.get('token');

    if (!force && url && token) {
        return true;
    }

    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'url',
            message: 'Enter the API Base URL:',
            default: process.env.SYDLE_API_URL || 'https://cbmsa-dev.sydle.one/api/1',
            when: !url
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

    // If URL was prompted, use it. Otherwise use existing.
    const finalUrl = answers.url || url;

    return await performLogin(answers.username, answers.password, finalUrl);
};

module.exports = { performLogin, ensureAuth };
