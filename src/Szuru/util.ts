import {StrongExtractOptions, SzuruOcrConfig} from "../Common/Infrastructure/SzuruOcrConfig.js";
import {Coordinate, MicroTag, Post, Tag} from "./Atomic.js";
import {Logger} from "winston";
import {Block} from "tesseract.js";

export const configureAllowToProcess = (config: StrongExtractOptions, logger: Logger) => {
    const {
        tags: {
            enable: tagEnable = true,
            behavior: tagBehavior = 'empty'
        } = {},
        notes: {
            enable: noteEnable = true,
            behavior: noteBehavior = 'empty'
        } = {},
    } = config;
    return (post: Post) => {
        let shouldProcessTags = tagEnable;
        if(shouldProcessTags) {
            shouldProcessTags = post.tags.length === 0 || tagBehavior !== 'empty';
        }
        let shouldProcessNotes = noteEnable;
        if(shouldProcessNotes) {
            shouldProcessNotes = post.notes.length === 0 || noteBehavior !== 'empty';
        }
        return {
            any: shouldProcessNotes || shouldProcessTags,
            notes: shouldProcessNotes,
            tags: shouldProcessTags
        }
    }
}

export const getPolygonFromBlock = (post: Post, block: Block) => {
    const polygon: Coordinate[] = [];
    if(block.polygon !== undefined && block.polygon !== null) {
        for (const poly of block.polygon) {
            // convert to szuru coordinates (0-1)
            polygon.push([poly[0] / post.canvasWidth, poly[1] / post.canvasHeight]);
        }
    } else if(block.bbox !== undefined && block.bbox !== null) {
        polygon.push([block.bbox.x0/post.canvasWidth, block.bbox.y0/post.canvasHeight]);
        polygon.push([block.bbox.x1/post.canvasWidth, block.bbox.y0/post.canvasHeight]);
        polygon.push([block.bbox.x1/post.canvasWidth, block.bbox.y1/post.canvasHeight]);
        polygon.push([block.bbox.x0/post.canvasWidth, block.bbox.y1/post.canvasHeight]);
    }
    return polygon;
}

export const asTag = (val: MicroTag | Tag): val is Tag => {
    return 'implications' in val;
}
