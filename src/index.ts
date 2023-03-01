import {SzuruService} from "./Szuru/SzuruService.js";
import {createWorker, OEM, PSM, createScheduler} from 'tesseract.js';
import got from 'got';
import {IncomingMessage} from "http";
import {Coordinate, MicroTag, Note, Tag} from "./Szuru/Atomic.js";
import {formatNumber, mergeArr, sleep} from "./Common/Util/util.js";
import {getConfig} from "./Common/Config/ConfigUtil.js";
import {queue, QueueObject} from 'async';

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import advancedFormat from 'dayjs/plugin/advancedFormat.js';
import tz from 'dayjs/plugin/timezone.js';
import dduration from 'dayjs/plugin/duration.js';
import relTime from 'dayjs/plugin/relativeTime.js';
import {initLogger} from "./Common/loggerFactory.js";
import {NoteExtractOptions, TagExtractOptions} from "./Common/Infrastructure/SzuruOcrConfig.js";
import {HttpFetchTask, OcrTask, UpdateTask} from "./Common/Infrastructure/Queue.js";
import {asTag, configureAllowToProcess, getPolygonFromBlock} from "./Szuru/util.js";
import {open} from "fs/promises";

dayjs.extend(utc);
dayjs.extend(dduration);
dayjs.extend(relTime);
dayjs.extend(tz);
dayjs.extend(advancedFormat);

(async function () {
    const initLog = await initLogger({});

    try {
        const configDoc = await getConfig(initLog);

        const config = configDoc.toJS();

        const {
            szuru: szuruConfig,
            extract: {
                notes = true,
                tags = true,
            },
            workers: {
                ocr = 3,
                http = ocr,
            },
            confidenceThreshold = 80,
            lastCheckedId,
        } = config;

        let noteExtract: NoteExtractOptions = {enable: true, behavior: 'empty'};
        if(notes === false) {
            noteExtract.enable = false;
        } else if(typeof notes === 'object') {
            noteExtract = {...noteExtract, ...(notes as NoteExtractOptions)};
        }

        let tagExtract: TagExtractOptions = {enable: true, behavior: 'add'};
        if(tags === false) {
            tagExtract.enable = false;
        } else if(typeof tagExtract === 'object') {
            tagExtract = {...tagExtract, ...(tags as NoteExtractOptions)};
        }

        if(noteExtract.enable === false && tagExtract.enable === false) {
            initLog.warn('Both notes and tags extraction are disabled! Why are you running this program then?');
            return;
        }

        const allowToProcess = configureAllowToProcess({notes: noteExtract, tags: tagExtract}, initLog);

        const {
            endpoints: {
                front: frontendEndpoint
            },
            query = {}
        } = szuruConfig;

        const sservice = new SzuruService(szuruConfig, initLog);

        initLog.info('Initializing Tesseract workers...');
        const scheduler = createScheduler();

        for(let i = 0; i < ocr; i++) {
            const worker = await createWorker({
                //langPath: 'https://tessdata.projectnaptha.com/4.0.0/eng.traineddata.gz',
                //logger: m => console.log(m)
            });
            await worker.loadLanguage('eng');
            await worker.initialize('eng');
            await worker.setParameters({
                //tessedit_pageseg_mode: PSM.AUTO_OSD,
                //tessedit_ocr_engine_mode: OEM.TESSERACT_LSTM_COMBINED
            });
            scheduler.addWorker(worker);
        }
        let foundLastCheckedId = false;
        let endOfList = false;
        let endOfUpdates = false;

        const updateLogger = initLog.child({labels: ['Update']}, mergeArr);
        const updateQueue: QueueObject<UpdateTask> = queue(async (task: UpdateTask) => {
            const {result, post} = task;
            const {notes: allowNotes, tags: allowTags} = allowToProcess(post);

            let notes: Note[] | undefined = undefined;
            let newNotes = false;
            let tags: (MicroTag | Tag)[] | undefined = undefined;
            let newTags = false;
            if(allowNotes) {
                notes = noteExtract.behavior === 'add' ? post.notes : [];
            }
            if(allowTags) {
                tags = tagExtract.behavior === 'add' ? post.tags : [];
            }

            for (const block of result.data.blocks) {
                if (block.confidence >= confidenceThreshold) {
                    // for (const poly of block.polygon) {
                    //     // convert to szuru coordinates (0-1)
                    //     polygon.push([poly[0] / post.canvasWidth, poly[1] / post.canvasHeight]);
                    // }
                    updateLogger.verbose(`Found text block => ${block.text}`, {leaf: `Post ${post.id}`});
                    if(notes !== undefined) {
                        const polygon: Coordinate[] | undefined = getPolygonFromBlock(post, block);
                        if(polygon === undefined) {
                            updateLogger.warn('Could not determine polygon for this block??', {leaf: `Post ${post.id}`})
                        } else {
                            // don't add if we find identical block
                            if(notes.some(x => x.text !== block.text)) {
                                updateLogger.verbose('Not adding as note because identical note was found.', {leaf: `Post ${post.id}`});
                            } else {
                                updateLogger.info('Adding note', {leaf: `Post ${post.id}`});
                                newNotes = true;
                                notes.push({
                                    polygon,
                                    text: block.text
                                });
                            }
                        }
                    }
                    if(tags !== undefined && result.data.confidence > confidenceThreshold) {
                        for(const word of result.data.words) {
                            const existingTag = tags.find(x => x.names.map(y => y.toLocaleLowerCase()).includes(word.text));
                            if(existingTag !== undefined) {
                                updateLogger.debug(`Not adding Tag '${word.text}' because it already exists on this post.`, {leaf: `Post ${post.id}`});
                                continue;
                            }
                            const matchingTag = await sservice.getTagByName(word.text);
                            if(matchingTag !== undefined) {
                                newTags = true;
                                updateLogger.info(`Adding matched Tag '${matchingTag.names[0]}' to post.`, {leaf: `Post ${post.id}`});
                                tags.push(matchingTag);
                            }
                        }
                    }
                } else {
                    updateLogger.debug(`Skipping a block on Post ${post.id} because confidence ${formatNumber(block.confidence)} below threshold of ${confidenceThreshold}`, {leaf: `Post ${post.id}`});
                }
            }

            const payload: any = {};
            if(notes !== undefined && notes.length > 0 && newNotes) {
                payload.notes = notes;
            }
            if(tags !== undefined && tags.length > 0 && newTags) {
                payload.tags = tags.map(x => {
                    const tagVals = [];
                   if(asTag(x)) {
                       if(x.implications.length > 0) {
                           for(const i of x.implications) {
                               tagVals.push(i.names[0]);
                           }
                       }
                   }
                   tagVals.push(x.names[0]);
                   return tagVals;
                }).flat();
            }

            if (Object.keys(payload).length > 0) {
                updateLogger.info('Updating Post', {leaf: `Post ${post.id}`});
                await sservice.updatePost(post, payload);
            }
        }, http);

        updateQueue.drain(() => {
            if(ocrDone) {
                updateLogger.info('Done updating all posts.');
                endOfUpdates = true;
            }
        });

        let ocrDone = false;
        const ocrLogger = initLog.child({labels: ['OCR']}, mergeArr)
        const ocrQueue: QueueObject<OcrTask> = queue(async (task: OcrTask) => {
            ocrLogger.verbose('Analyzing image content', {leaf: `Post ${task.post.id}`});
            const res = await scheduler.addJob('recognize', task.imageData);
            updateQueue.push({...task, result: res});
        }, ocr);

        const httpLogger = initLog.child({labels: ['HTTP']}, mergeArr)
        const httpQueue: QueueObject<HttpFetchTask> = queue(async (task: HttpFetchTask) => {
            const {post} = task;
            const contentUrl = `${frontendEndpoint}/${post.contentUrl}`;
            httpLogger.verbose(`Fetching ${contentUrl}`, {leaf: `Post ${post.id}`});
            const resp = await got.get(contentUrl) as IncomingMessage;
            // @ts-ignore
            const dataUrl = "data:" + resp.headers["content-type"] + ";base64," + Buffer.from(resp.rawBody).toString('base64');
            ocrQueue.push({post, imageData: dataUrl});
        }, http);

        initLog.info('Tesseract workers are ready.');

        if(tagExtract.enable) {
            initLog.info('Tag extraction is enabled, starting tag caching.');
            await sservice.cacheTags();
        }


        let offset = 0;
        let total = 1;

        let newestId: number;
        const discovery = await sservice.getPosts({...query, limit: 1, offset: 0});
        if(discovery.total === 0) {
            initLog.info('No posts found with the given params!');
            return;
        }
        newestId = discovery.results[0].id;

        total = discovery.total;
        initLog.info(`Found ${total} posts.`);
        if(lastCheckedId === undefined) {
            initLog.info(`No 'lastCheckedId' was found in config so will process ALL posts!`);
        } else {
            initLog.info(`Will process posts until Post ${lastCheckedId} is found.`);
        }

        const {limit = 100, ...rest} = query;

        const getPagedPosts = async () => {
            httpLogger.verbose(`Fetching ${limit} posts at offset ${offset}...`);
            const posts = await sservice.getPosts({limit, offset, ...rest});
            for(const p of posts.results) {
                if(p.id === lastCheckedId) {
                    httpLogger.info(`Found Last Checked Post ${lastCheckedId}! Will not queue any more posts.`);
                    foundLastCheckedId = true;
                    break;
                }
                const {any} = allowToProcess(p);
                if(any) {
                    httpQueue.push({post: p});
                } else {
                    httpLogger.verbose(`Post ${p.id} skipped due to extract option requirements not met.`);
                }
            }
            offset += limit;

            if(offset >= total) {
                endOfList = true;
                httpLogger.info(`Reached the end of paginated posts.`);
            }
        }

        ocrQueue.drain(async () => {
            if(foundLastCheckedId || endOfList) {
                ocrLogger.info('Done OCRing all posts.');
                ocrDone = true;
            } else {
                await getPagedPosts();
            }
        });
        await getPagedPosts();
        while(!endOfUpdates) {
            await sleep(2000);
        }

        initLog.info('Done processing posts!');

        initLog.info(`Writing newest ID to config: ${newestId}`);
        configDoc.setLastCheckedId(newestId);
        const handle = await open(configDoc.location as string, 'w');
        await handle.writeFile(configDoc.toString());
        await handle.close();

        initLog.info('Done!');

        process.kill(process.pid, 'SIGTERM');
    } catch (err: any) {
        initLog.error(err);
        process.kill(process.pid, 'SIGTERM');
    }
}());
