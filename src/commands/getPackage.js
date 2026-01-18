const { Command } = require('commander');
const { ensureAuth } = require('../utils/authFlow');
const { processClasses } = require('../core/processClasses');

const obterPacoteCommand = new Command('obterPacote')
    .alias('getPackage')
    .description('Obter pacote do Sydle')
    .argument('<identifier>', 'Package identifier')
    .action(async (identifier) => {
        try {
            if (!(await ensureAuth())) {
                return;
            }

            // Query filtering by package identifier
            const query = {
                query: {
                    term: { "package.identifier.keyword": identifier }
                },
                sort: [{ "_id": "asc" }]
            };

            await processClasses({
                query,
                description: `Fetching package ${identifier} and creating folders...`
            });
        } catch (error) {
            console.error('Error:', error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    });

module.exports = obterPacoteCommand;
