const { Command } = require('commander');
const { ensureAuth } = require('../utils/authFlow');
const { searchPaginated, get } = require('../api/main');
const { processClasses } = require('../core/processClasses');
const { createLogger } = require('../utils/logger');

const CLASS_METADATA_ID = '000000000000000000000000';

const initCommand = new Command('iniciar')
    .alias('init')
    .description('Initialize Sydle environment (all classes)')
    .option('-v, --verbose', 'Mostrar logs detalhados')
    .action(async (options) => {
        const logger = createLogger(options.verbose);
        try {
            if (!(await ensureAuth())) {
                return;
            }

            logger.progress('Fetching all classes from Sydle...');

            // Query to fetch ALL classes
            const query = {
                query: { match_all: {} },
                sort: [{ "_id": "asc" }]
            };

            // Fetch all classes from API
            const classesData = [];
            await searchPaginated(CLASS_METADATA_ID, query, 50, async (hits) => {
                logger.progress(`Found ${hits.length} classes in this batch...`);
                for (const hit of hits) {
                    if (hit._source) {
                        // Fetch full class to ensure we have all details including scripts
                        try {
                            const fullClass = await get(CLASS_METADATA_ID, hit._source._id);
                            classesData.push(fullClass);
                        } catch (error) {
                            logger.warn(`Failed to fetch class ${hit._source._id}, using search result.`);
                            classesData.push(hit._source);
                        }
                    }
                }
            });

            logger.info(`Total classes fetched: ${classesData.length}`);

            // Process all classes
            await processClasses(classesData, {
                description: 'Processing all classes and creating folders...'
            });

        } catch (error) {
            logger.error('Error: ' + (error instanceof Error ? error.message : String(error)));
            if (options.verbose && error instanceof Error) logger.debug(error.stack);
            process.exit(1);
        }
    });

module.exports = initCommand;
