const { Command } = require('commander');
const { ensureAuth } = require('../utils/authFlow');
const { processClasses } = require('../core/processClasses');

const initCommand = new Command('init')
    .description('Initialize the project with all classes from Sydle')
    .action(async () => {
        try {
            if (!(await ensureAuth())) {
                return;
            }

            // Query to fetch ALL classes
            const query = {
                query: { match_all: {} },
                sort: [{ "_id": "asc" }]
            };

            await processClasses({
                query,
                description: 'Fetching all classes and creating folders...'
            });
        } catch (error) {
            console.error('Error:', error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    });

module.exports = initCommand;
