import process from "process";
import path from "path";
import winston, {Logger} from "winston";
import {DuplexTransport} from "winston-duplex";
import {ErrorWithCause} from "pony-cause";
import {NullTransport} from 'winston-null';
import {LoggerFactoryOptions} from "./Infrastructure/Logging.js";
import {castToBool, fileOrDirectoryIsWriteable, logLevels, projectDir, resolvePath} from "./Util/util.js";
import {labelledFormat} from "./Util/logging.js";

const {transports} = winston;

export const getLogger = (options: LoggerFactoryOptions, name = 'app'): Logger => {

    const errors: (Error | string)[] = [];

    if (!winston.loggers.has(name)) {
        const {
            level,
            additionalTransports = [],
            defaultLabel = 'App',
            file: {
                dirname = undefined,
                ...fileRest
            } = {},
            console,
            stream
        } = options || {};

        const consoleTransport = new transports.Console({
            ...console,
            handleExceptions: true,
            handleRejections: true,
        });

        const myTransports = [
            consoleTransport,
            new DuplexTransport({
                stream: {
                    transform(chunk, e, cb) {
                        cb(null, chunk);
                    },
                    objectMode: true,
                },
                name: 'duplex',
                handleExceptions: true,
                handleRejections: true,
                ...stream,
                dump: false,
            }),
            ...additionalTransports,
        ];

        let realDir = resolveLogDir(dirname);

        if(realDir !== undefined) {
            try {
                fileOrDirectoryIsWriteable(realDir);
            } catch (e: any) {
                let msg = 'WILL NOT write logs to rotating file due to an error while trying to access the specified logging directory';
                if(castToBool(process.env.IS_DOCKER) === true) {
                    msg += `Make sure you have specified user in docker run command!`;
                }
                errors.push(new ErrorWithCause<Error>(msg, {cause: e}));
                realDir = undefined;
            }
        }


        if (realDir !== undefined) {
            const rotateTransport = new winston.transports.DailyRotateFile({
                createSymlink: true,
                symlinkName: 'ocr-current.log',
                filename: 'cor-%DATE%.log',
                datePattern: 'YYYY-MM-DD',
                maxSize: '5m',
                dirname: realDir,
                ...fileRest,
                handleExceptions: true,
                handleRejections: true,
            });
            // @ts-ignore
            myTransports.push(rotateTransport);
        }

        const loggerOptions = {
            level: level || 'info',
            format: labelledFormat(defaultLabel),
            transports: myTransports,
            levels: logLevels,
        };

        winston.loggers.add(name, loggerOptions);
    }

    const logger = winston.loggers.get(name);
    if (errors.length > 0) {
        for (const e of errors) {
            logger.error(e);
        }
    }
    return logger;
}

export const resolveLogDir = (dirname: any): undefined | string => {
    let realDir: string | undefined;

    if (dirname !== undefined && dirname !== '' && dirname !== null) {

        const dirBool = castToBool(dirname, false);
        if (dirBool !== undefined) {
            if (!dirBool) {
                realDir = undefined;
            } else {
                realDir = path.resolve(projectDir, './logs');
            }
        } else {
            realDir = resolvePath(dirname as string, projectDir);
        }
    }

    return realDir;
}

export const initLogger = async (args: any) => {
    // create a pre config logger to help with debugging
    // default to debug if nothing is provided
    const {
        logLevel = process.env.LOG_LEVEL ?? 'debug',
        logDir = process.env.LOG_DIR,
    } = args || {};

    const initLoggerOptions = {
        level: logLevel,
        console: {
            level: logLevel
        },
        file: {
            level: logLevel,
            dirname: logDir,
        },
        stream: {
            level: logLevel
        }
    }

    return getLogger(initLoggerOptions, 'init');
}


winston.loggers.add('noop', {transports: [new NullTransport()]});

export const NoopLogger = winston.loggers.get('noop');
