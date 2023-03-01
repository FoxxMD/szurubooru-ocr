import dayjs, {Dayjs} from 'dayjs';
import winston from 'winston';
import {ErrorWithCause} from "pony-cause";
import {LEVEL, MESSAGE} from "triple-beam";

const {format} = winston;
const {combine, printf, timestamp, label, splat, errors} = format;
const s = splat();
const SPLAT = Symbol.for('splat')

const CWD = process.cwd();

type StringReturn = (err:any) => string;

export interface LogMatch {
    [key: string | number]: string | StringReturn
}


export const defaultFormat = (defaultLabel = 'App') => printf(({
                                                                   level,
                                                                   message,
                                                                   labels = [defaultLabel],
                                                                   leaf,
                                                                   itemId,
                                                                   timestamp,
                                                                   // @ts-ignore
                                                                   [SPLAT]: splatObj,
                                                                   stack,
                                                                   ...rest
                                                               }) => {
    let stringifyValue = splatObj !== undefined ? JSON.stringify(splatObj) : '';
    let msg = message;
    let stackMsg = '';
    if (stack !== undefined) {
        const stackArr = stack.split('\n');
        const stackTop = stackArr[0];
        const cleanedStack = stackArr
            .slice(1) // don't need actual error message since we are showing it as msg
            .map((x: string) => x.replace(CWD, 'CWD')) // replace file location up to cwd for user privacy
            .join('\n'); // rejoin with newline to preserve formatting
        stackMsg = `\n${cleanedStack}`;
        if (msg === undefined || msg === null || typeof message === 'object') {
            msg = stackTop;
        } else {
            stackMsg = `\n${stackTop}${stackMsg}`
        }
    }

    let nodes = labels;
    if (leaf !== null && leaf !== undefined && !nodes.includes(leaf)) {
        nodes.push(leaf);
    }
    const labelContent = `${nodes.map((x: string) => `[${x}]`).join(' ')}`;

    return `${timestamp} ${level.padEnd(7)}: ${labelContent} ${msg}${stringifyValue !== '' ? ` ${stringifyValue}` : ''}${stackMsg}`;
});


export const labelledFormat = (labelName = 'App') => {
    //const l = label({label: labelName, message: false});
    return combine(
        timestamp(
            {
                format: () => dayjs().local().format(),
            }
        ),
        // l,
        s,
        errorAwareFormat,
        //errorsFormat,
        defaultFormat(labelName),
    );
}

const errorAwareFormat = {
    transform: (einfo: any, {stack = true}: any = {}) => {

        // because winston logger.child() re-assigns its input to an object ALWAYS the object we recieve here will never actually be of type Error
        const includeStack = stack && (!isProbablyError(einfo, 'simpleerror') && !isProbablyError(einfo.message, 'simpleerror'));

        if (!isProbablyError(einfo.message) && !isProbablyError(einfo)) {
            return einfo;
        }

        let info: any = {};

        if (isProbablyError(einfo)) {
            const tinfo = transformError(einfo);
            info = Object.assign({}, tinfo, {
                // @ts-ignore
                level: einfo.level,
                // @ts-ignore
                [LEVEL]: einfo[LEVEL] || einfo.level,
                message: tinfo.message,
                // @ts-ignore
                [MESSAGE]: tinfo[MESSAGE] || tinfo.message
            });
            if(includeStack) {
                // so we have to create a dummy error and re-assign all error properties from our info object to it so we can get a proper stack trace
                const dummyErr = new ErrorWithCause('');
                const names = Object.getOwnPropertyNames(tinfo);
                for(const k of names) {
                    if(dummyErr.hasOwnProperty(k) || k === 'cause') {
                        // @ts-ignore
                        dummyErr[k] = tinfo[k];
                    }
                }
                // @ts-ignore
                info.stack = stackWithCauses(dummyErr);
            }
        } else {
            const err = transformError(einfo.message);
            info = Object.assign({}, einfo, err);
            // @ts-ignore
            info.message = err.message;
            // @ts-ignore
            info[MESSAGE] = err.message;

            if(includeStack) {
                const dummyErr = new ErrorWithCause('');
                // Error properties are not enumerable
                // https://stackoverflow.com/a/18278145/1469797
                const names = Object.getOwnPropertyNames(err);
                for(const k of names) {
                    if(dummyErr.hasOwnProperty(k) || k === 'cause') {
                        // @ts-ignore
                        dummyErr[k] = err[k];
                    }
                }
                // @ts-ignore
                info.stack = stackWithCauses(dummyErr);
            }
        }

        // remove redundant message from stack and make stack causes easier to read
        if(info.stack !== undefined) {
            let cleanedStack = info.stack.replace(info.message, '');
            cleanedStack = `${cleanedStack}`;
            cleanedStack = cleanedStack.replaceAll('caused by:', '\ncaused by:');
            info.stack = cleanedStack;
        }

        return info;
    }
}

const isProbablyError = (val: any, explicitErrorName?: string) => {
    if(typeof val !== 'object' || val === null) {
        return false;
    }
    const {name, stack} = val;
    if(explicitErrorName !== undefined) {
        if(name !== undefined && name.toLowerCase().includes(explicitErrorName)) {
            return true;
        }
        if(stack !== undefined && stack.trim().toLowerCase().indexOf(explicitErrorName.toLowerCase()) === 0) {
            return true;
        }
        return false;
    } else if(stack !== undefined) {
        return true;
    } else if(name !== undefined && name.toLowerCase().includes('error')) {
        return true;
    }

    return false;
}

const _transformError = (err: Error, seen: Set<Error>, matchOptions?: LogMatch) => {
    if (!err || !isProbablyError(err)) {
        return '';
    }
    if (seen.has(err)) {
        return err;
    }

    try {

        // @ts-ignore
        let mOpts = err.matchOptions ?? matchOptions;

        // @ts-ignore
        const cause = err.cause as unknown;

        if (cause !== undefined && cause instanceof Error) {
            // @ts-ignore
            err.cause = _transformError(cause, seen, mOpts);
        }

        return err;
    } catch (e: any) {
        // oops :(
        // we're gonna swallow silently instead of reporting to avoid any infinite nesting and hopefully the original error looks funny enough to provide clues as to what to fix here
        return err;
    }
}

export const transformError = (err: Error): any => _transformError(err, new Set());
