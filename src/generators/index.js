const { generateClassDts } = require('./classDts');
const { generateJsconfig } = require('./jsconfig');
const { generateGlobalsDts } = require('./globalsDts');
const { generateSydleDts } = require('./sydleDts');
const { generatePackageDts } = require('./packageDts');
const { generateClassSchema } = require('./classSchema');
const { generateMethodFiles } = require('./methodFiles');
const { generateInputFiles } = require('./inputFiles');
const { mapToTsType, mapToZodSchema, getRelativePath } = require('./utils');

module.exports = {
    generateClassDts,
    generateJsconfig,
    generateGlobalsDts,
    generateSydleDts,
    generatePackageDts,
    generateClassSchema,
    generateMethodFiles,
    generateInputFiles,
    mapToTsType,
    mapToZodSchema,
    getRelativePath
};
