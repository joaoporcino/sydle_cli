const { Command } = require('commander');
const { ensureAuth } = require('../utils/authFlow');
const { processClasses } = require('../core/processClasses');

const obterClasseCommand = new Command('obterClasse')
    .description('Fetch and generate files for a specific class identifier')
    .argument('<identifier>', 'Class identifier')
    .action(async (identifier) => {
        try {
            if (!(await ensureAuth())) {
                return;
            }

            // Query filtering by class identifier
            const query = {
                query: {
                    term: { "identifier.keyword": identifier }
                },
                sort: [{ "_id": "asc" }]
            };

            await processClasses({
                query,
                description: `Fetching class ${identifier} and creating folders...`
            });
        } catch (error) {
            console.error('Error:', error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    });

module.exports = obterClasseCommand;
