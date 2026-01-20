const { Command } = require('commander');
const { performLogin, ensureAuth } = require('../utils/authFlow');
const { createLogger } = require('../utils/logger');

const loginCommand = new Command('login')
    .description('Login to the Sydle CLI')
    .argument('[username]', 'Your username')
    .argument('[password]', 'Your password')
    .option('-v, --verbose', 'Mostrar logs detalhados')
    .action(async (username, password, url, options) => {
        const logger = createLogger(options.verbose);
        try {
            if (username && password) {
                await performLogin(username, password, url);
            } else {
                await ensureAuth(true);
            }
        } catch (error) {
            logger.error(`Login failed: ${error instanceof Error ? error.message : String(error)}`);
            if (options.verbose && error instanceof Error) logger.debug(error.stack);
        }
    });

module.exports = loginCommand;