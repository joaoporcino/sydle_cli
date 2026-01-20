const { Command } = require('commander');
const { executeMainMethod } = require('../api/main');
const { createLogger } = require('../utils/logger');

const mainCommand = new Command('executar')
    .alias('main')
    .description('Execute the main functionality')
    .argument('<id>', 'Entity ID')
    .argument('<method>', 'Method to execute (e.g., _get, _update)')
    .option('-d, --data <json>', 'JSON data payload', '{}')
    .option('-m, --http-method <httpMethod>', 'HTTP Method (GET, POST, etc.)', 'POST')
    .option('-v, --verbose', 'Mostrar logs detalhados')
    .action(async (id, method, options) => {
        const logger = createLogger(options.verbose);
        try {
            let data = {};
            try {
                data = JSON.parse(options.data);
            } catch (e) {
                logger.error('Invalid JSON data provided.');
                return;
            }

            // Auto-detect HTTP method for _get
            let httpMethod = options.httpMethod;
            if (method === '_get' && options.httpMethod === 'POST') {
                httpMethod = 'GET';
            }

            logger.progress(`Executing ${method} on ${id}...`);
            const result = await executeMainMethod(id, method, data, httpMethod);
            logger.log(JSON.stringify(result, null, 2));
        } catch (error) {
            logger.error(`Operation failed: ${error instanceof Error ? error.message : String(error)}`);
            if (options.verbose && error instanceof Error) logger.debug(error.stack);
        }
    });

module.exports = mainCommand;
