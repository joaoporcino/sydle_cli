const { generateClassDts } = require('./classDts');
const { generateJsconfig } = require('./jsconfig');
const { generateGlobalsDts } = require('./globalsDts');
const { generateSydleDts } = require('./sydleDts');
const { generatePackageDts } = require('./packageDts');
const { generateClassSchema } = require('./classSchema');
const { generateFieldsSchema } = require('./fieldsSchema');
const { generateSydleZod } = require('./sydleZodGenerator');
const { generateMethodFiles } = require('./methodFiles');
const { generateInputFiles } = require('./inputFiles');
const { mapToTsType, mapToZodSchema, getRelativePath } = require('./utils');
const { generateAiDocs } = require('./aiDocs');

module.exports = {
    generateClassDts,
    generateJsconfig,
    generateGlobalsDts,
    generateSydleDts,
    generatePackageDts,
    generateClassSchema,
    generateFieldsSchema,
    generateSydleZod,
    generateMethodFiles,
    generateInputFiles,
    mapToTsType,
    mapToZodSchema,
    getRelativePath,
    generateAiDocs
};
