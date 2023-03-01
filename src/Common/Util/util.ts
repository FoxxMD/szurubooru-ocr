import pathUtil from "path";
import {constants, promises, accessSync} from "fs";
import {ConfigFormat, numberFormatOptions} from "../Infrastructure/Atomic.js";
import {ErrorWithCause} from "pony-cause";
import path from "path";
import {fileURLToPath} from "url";
import {SzuruOcrConfig} from "../Infrastructure/SzuruOcrConfig.js"
// @ts-ignore
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function readConfigFile(path: string, opts?: any): Promise<[string?, ConfigFormat?]> {
    const {log, throwOnNotFound = true} = opts || {};
    let extensionHint: ConfigFormat | undefined;
    const fileInfo = pathUtil.parse(path);
    if (fileInfo.ext !== undefined) {
        switch (fileInfo.ext) {
            case '.json':
            case '.json5':
                extensionHint = 'json';
                break;
            case '.yaml':
                extensionHint = 'yaml';
                break;
        }
    }
    try {
        await promises.access(path, constants.R_OK);
        const data = await promises.readFile(path);
        return [(data as any).toString(), extensionHint]
    } catch (e: any) {
        const {code} = e;
        if (code === 'ENOENT') {
            if (throwOnNotFound) {
                if (log) {
                    log.warn(`No file found at path: ${path}`, {filePath: path});
                }
                e.extension = extensionHint;
                throw new Error(`No file found at path: ${path}`);
            } else {
                return [];
            }
        } else if (code === 'EACCES') {
            if (log) {
                log.warn(`Unable to access file path due to permissions: ${path}`, {filePath: path});
            }
            e.extension = extensionHint;
            throw new ErrorWithCause(`Unable to access file path due to permissions: ${path}`, {cause: e});
        } else {
            const err = new ErrorWithCause(`Encountered error while parsing file at ${path}`, {cause: e})
            if (log) {
                log.error(e);
            }
            e.extension = extensionHint;
            // @ts-ignore
            err.extension = extensionHint;
            throw err;
        }
    }
}

export const fileOrDirectoryIsWriteable = (location: string) => {
    const pathInfo = pathUtil.parse(location);
    const isDir = pathInfo.ext === '';
    try {
        accessSync(location, constants.R_OK | constants.W_OK);
        return true;
    } catch (err: any) {
        const {code} = err;
        if (code === 'ENOENT') {
            // file doesn't exist, see if we can write to directory in which case we are good
            try {
                accessSync(pathInfo.dir, constants.R_OK | constants.W_OK)
                // we can write to dir
                return true;
            } catch (accessError: any) {
                if(accessError.code === 'EACCES') {
                    // also can't access directory :(
                    throw new Error(`No ${isDir ? 'directory' : 'file'} exists at ${location} and application does not have permission to write to the parent directory`);
                } else {
                    throw new ErrorWithCause(`No ${isDir ? 'directory' : 'file'} exists at ${location} and application is unable to access the parent directory due to a system error`, {cause: accessError});
                }
            }
        } else if(code === 'EACCES') {
            throw new Error(`${isDir ? 'Directory' : 'File'} exists at ${location} but application does not have permission to write to it.`);
        } else {
            throw new ErrorWithCause(`${isDir ? 'Directory' : 'File'} exists at ${location} but application is unable to access it due to a system error`, {cause: err});
        }
    }
}

export const projectDir = path.resolve(__dirname, '../../../');
export const configDir: string = process.env.CONFIG_DIR !== undefined ? path.resolve(process.env.CONFIG_DIR) : path.resolve(projectDir, './config');


/**
 * Naively detect if a string is most likely json5
 *
 * Check if string begins with comments, opening bracket, or opening curly brace.
 * */
export const likelyJson5 = (str: string): boolean => {
    let validStart = false;
    const lines = str.split('\r\n');
    for(const line of lines) {
        const trimmedLine = line.trim();
        if(trimmedLine.indexOf('//') === 0) {
            // skip line if it starts with a comment
            continue;
        }
        // if the first non-comment line starts with an opening curly brace or bracket its ~probably~ json...
        const startChar = trimmedLine.charAt(0);
        validStart = ['{','['].some(x => x === startChar);
        break;
    }
    return validStart;
}

export const castToBool = (val: any, allowNumbers = true): boolean | undefined => {
    if (val === null || val === undefined) {
        return undefined;
    }
    if (typeof val === 'boolean') {
        return val;
    }
    if (typeof val === 'number' && allowNumbers) {
        if (val === 1) {
            return true;
        }
        if (val === 0) {
            return false;
        }
        return undefined;
    } else if (typeof val === 'string') {
        if (val.trim() === '') {
            return undefined;
        }
        if(val.trim().toLocaleLowerCase() === 'true') {
            return true;
        }
        if(val.trim().toLocaleLowerCase() === 'false') {
            return false;
        }
        if(allowNumbers) {
            if(Number.parseInt(val.trim()) === 1) {
                return true;
            }
            if(Number.parseInt(val.trim()) === 0) {
                return false;
            }
        }
        return undefined;
    }
    return undefined;
}

export const resolvePath = (pathVal: string, relativeRoot: string) => {
    const pathInfo = pathUtil.parse(pathVal);
    // if path looks absolute then just resolve any relative parts and return as-is
    if (pathInfo.root !== '') {
        return pathUtil.resolve(pathVal);
    }
    // if there is no root then resolve it with relative root
    if (pathInfo.dir === '') {
        return pathUtil.resolve(relativeRoot, './', pathVal);
    }
    return pathUtil.resolve(relativeRoot, pathVal);
}

export const logLevels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    verbose: 4,
    debug: 5,
    trace: 5,
    silly: 6
};

export const mergeArr = (objValue: [], srcValue: []): (any[] | undefined) => {
    if (Array.isArray(objValue)) {
        return objValue.concat(srcValue);
    }
}
export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export const formatNumber = (val: number | string, options?: numberFormatOptions) => {
    const {
        toFixed = 2,
        defaultVal = null,
        prefix = '',
        suffix = '',
        round,
    } = options || {};
    let parsedVal = typeof val === 'number' ? val : Number.parseFloat(val);
    if (Number.isNaN(parsedVal)) {
        return defaultVal;
    }
    if(!Number.isFinite(val)) {
        return 'Infinite';
    }
    let prefixStr = prefix;
    const {enable = false, indicate = true, type = 'round'} = round || {};
    if (enable && !Number.isInteger(parsedVal)) {
        switch (type) {
            case 'round':
                parsedVal = Math.round(parsedVal);
                break;
            case 'ceil':
                parsedVal = Math.ceil(parsedVal);
                break;
            case 'floor':
                parsedVal = Math.floor(parsedVal);
        }
        if (indicate) {
            prefixStr = `~${prefix}`;
        }
    }
    const localeString = parsedVal.toLocaleString(undefined, {
        minimumFractionDigits: toFixed,
        maximumFractionDigits: toFixed,
    });
    return `${prefixStr}${localeString}${suffix}`;
};
