const { Command } = require('commander');
const { performLogin, ensureAuth } = require('../utils/authFlow');

const loginCommand = new Command('login')
    .description('Login to the Sydle CLI')
    .argument('[username]', 'Your username')
    .argument('[password]', 'Your password')
    .action(async (username, password) => {
        try {
            if (username && password) {
                await performLogin(username, password);
            } else {
                await ensureAuth(true);
            }
        } catch (error) {
            console.error('Login failed:', error.message);
        }
    });

module.exports = loginCommand;
