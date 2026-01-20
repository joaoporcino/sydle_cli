/**
 * @fileoverview List Instance Command
 * 
 * CLI command to list/search instances of a class.
 * Portuguese: sydle listarInstancia
 * English alias: sydle listInstance
 * 
 * @module commands/listInstance
 */

const { Command } = require('commander');
const { ensureAuth } = require('../utils/authFlow');
const { createLogger } = require('../utils/logger');
const { searchPaginated } = require('../api/main');
const {
    parsePackageClass,
    validatePackageAndClass
} = require('../utils/instanceDataFlow');

const listInstanceCommand = new Command('listarInstancia')
    .alias('listInstance')
    .alias('li')
    .description('Lista/busca instâncias de uma classe (List/search class instances)')
    .argument('<package.class>', 'Pacote e classe (ex: recursosHumanos.templatesDemissao)')
    .option('-q, --query <json>', 'Query Elasticsearch em JSON', '{"query":{"match_all":{}}}')
    .option('-l, --limit <n>', 'Limite de resultados', '10')
    .option('-f, --fields <fields>', 'Campos a exibir (separados por vírgula)', '_id,name,nome,identifier')
    .option('-v, --verbose', 'Mostrar logs detalhados')
    .action(async (packageClass, options) => {
        const logger = createLogger(options.verbose);

        try {
            // 1. Authentication Check
            if (!(await ensureAuth())) {
                return;
            }

            // 2. Parse package.class
            const parsed = parsePackageClass(packageClass);
            if (!parsed) {
                logger.error('❌ Formato inválido. Use: package.class');
                return;
            }

            const { packageId, classId } = parsed;
            logger.info(`\n🔍 Buscando instâncias de ${packageId}.${classId}...`);

            // 3. Validate package and class
            const validation = await validatePackageAndClass(packageId, classId, logger);
            if (!validation) {
                return;
            }

            const { classData } = validation;

            // 4. Parse query
            let query;
            try {
                query = JSON.parse(options.query);
            } catch (e) {
                logger.error('❌ Query JSON inválida');
                return;
            }

            // 5. Execute search
            const limit = parseInt(options.limit, 10) || 10;
            const displayFields = options.fields.split(',').map(f => f.trim());
            const results = [];

            await searchPaginated(classData._id, query, limit, async (hits) => {
                for (const hit of hits) {
                    if (results.length >= limit) break;
                    results.push(hit._source);
                }
            });

            // 6. Display results
            if (results.length === 0) {
                logger.info('\n   Nenhuma instância encontrada.');
                return;
            }

            logger.success(`\n✅ ${results.length} instância(s) encontrada(s):\n`);

            for (const instance of results) {
                const displayValues = [];
                for (const field of displayFields) {
                    if (instance[field] !== undefined && instance[field] !== null) {
                        const value = typeof instance[field] === 'object'
                            ? JSON.stringify(instance[field])
                            : String(instance[field]);
                        displayValues.push(`${field}: ${value.substring(0, 50)}`);
                    }
                }
                console.log(`   • ${displayValues.join(' | ')}`);
            }

            logger.info(`\n   Use 'sydle obterInstancia ${packageClass} <_id>' para baixar uma instância.`);

        } catch (error) {
            logger.error(`❌ Erro: ${error instanceof Error ? error.message : String(error)}`);
            if (options.verbose && error instanceof Error) logger.debug(error.stack);
        }
    });

module.exports = listInstanceCommand;
