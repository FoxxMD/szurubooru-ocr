import {ConfigFormat} from "../Infrastructure/Atomic.js";
import {Document as YamlDocument} from "yaml";
import {configDir, likelyJson5, readConfigFile} from "../Util/util.js";
import JsonConfigDocument from "./JsonConfigDocument.js";
import YamlConfigDocument from "./YamlConfigDocument.js";
import {ConfigDocumentInterface} from "./AbstractConfigDocument.js";
import {ConfigToObjectOptions} from "./ConfigToObjectOptions.js";
import {JsonSzuruOcrConfigDocument, YamlSzuruOcrConfigDocument} from "./SzuruOcr/index.js";
import {Logger} from "winston";

export const parseFromJsonOrYamlToObject = (content: string, options?: ConfigToObjectOptions): [ConfigFormat, ConfigDocumentInterface<YamlDocument | object>?, Error?, Error?] => {
    let obj;
    let configFormat: ConfigFormat = 'yaml';
    let jsonErr,
        yamlErr;

    const likelyType = likelyJson5(content) ? 'json' : 'yaml';

    const {
        location,
        jsonDocFunc = (content: string, location?: string) => new JsonSzuruOcrConfigDocument(content, location),
        yamlDocFunc = (content: string, location?: string) => new YamlSzuruOcrConfigDocument(content, location),
        allowArrays = false,
    } = options || {};

    try {
        const jsonObj = jsonDocFunc(content, location);
        const output = jsonObj.toJS();
        const oType = output === null ? 'null' : typeof output;
        if (oType !== 'object') {
            jsonErr = new Error(`Parsing as json produced data of type '${oType}' (expected 'object')`);
            obj = undefined;
        } else {
            obj = jsonObj;
            configFormat = 'json';
        }
    } catch (err: any) {
        jsonErr = err;
    }

    try {
        const yamlObj = yamlDocFunc(content, location)
        const output = yamlObj.toJS();
        const oType = output === null ? 'null' : typeof output;
        if (oType !== 'object') {
            yamlErr = new Error(`Parsing as yaml produced data of type '${oType}' (expected 'object')`);
            obj = undefined;
        } else if (obj === undefined && (likelyType !== 'json' || yamlObj.parsed.errors.length === 0)) {
            configFormat = 'yaml';
            if (yamlObj.parsed.errors.length !== 0) {
                yamlErr = new Error(yamlObj.parsed.errors.join('\n'))
            } else {
                obj = yamlObj;
            }
        }
    } catch (err: any) {
        yamlErr = err;
    }

    if (obj === undefined) {
        configFormat = likelyType;
    }
    return [configFormat, obj, jsonErr, yamlErr];
}

export const getConfig = async (logger: Logger): Promise<YamlSzuruOcrConfigDocument | JsonSzuruOcrConfigDocument> => {
    let fileConfigFormat: ConfigFormat | undefined = undefined;
    let configStr: string | undefined = undefined;
    let configDoc: YamlSzuruOcrConfigDocument | JsonSzuruOcrConfigDocument;
    let location!: string;

    for(const fileNames of ['config.json','config.yaml']) {
        try {
            location = `${configDir}/${fileNames}`;
            const [foundConfigStr, foundFileFormat] = await readConfigFile(location, {log: logger});
            configStr = foundConfigStr;
            fileConfigFormat = foundFileFormat;
            logger.info(`Found config file: ${configDir}`);
            break;
        } catch (e) {
            if(e.message.includes('No file found')) {
                continue;
            } else {
                throw e;
            }
        }
    }
    const [format, configObj, jsonErr, yamlErr] = parseFromJsonOrYamlToObject(configStr, {location});

    if (format !== undefined && fileConfigFormat === undefined) {
        fileConfigFormat = 'yaml';
    }

    if (configObj === undefined) {
        logger.error(`Could not parse config contents as JSON or YAML. Looks like it should be ${fileConfigFormat}?`);
        if (fileConfigFormat === 'json') {
            logger.error(jsonErr);
            logger.error('Check DEBUG output for yaml error');
            logger.debug(yamlErr);
        } else {
            logger.error(yamlErr);
            logger.error('Check DEBUG output for json error');
            logger.debug(jsonErr);
        }
        throw new Error('Could not parse config contents as JSON or YAML')
    }

    return configObj as (YamlSzuruOcrConfigDocument | JsonSzuruOcrConfigDocument);
}
