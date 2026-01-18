const { Command } = require('commander');
const { executeMainMethod } = require('../api/main');

const mainCommand = new Command('executar')
    .alias('main')
    .description('Execute the main functionality')
    .argument('<id>', 'Entity ID')
    .argument('<method>', 'Method to execute (e.g., _get, _update)')
    .option('-d, --data <json>', 'JSON data payload', '{}')
    .option('-m, --http-method <httpMethod>', 'HTTP Method (GET, POST, etc.)', 'POST')
    .action(async (id, method, options) => {
        try {
            let data = {};
            try {
                data = JSON.parse(options.data);
            } catch (e) {
                console.error('Invalid JSON data provided.');
                return;
            }

            // Auto-detect HTTP method for _get
            let httpMethod = options.httpMethod;
            if (method === '_get' && options.httpMethod === 'POST') {
                httpMethod = 'GET';
            }

            console.log(`Executing ${method} on ${id}...`);
            const result = await executeMainMethod(id, method, data, httpMethod);
            console.log(JSON.stringify(result, null, 2));
        } catch (error) {
            console.error('Operation failed.');
        }
    });

module.exports = mainCommand;
