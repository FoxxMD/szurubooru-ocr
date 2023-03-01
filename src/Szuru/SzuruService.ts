import got, {CancelableRequest} from 'got';
import {PagedSearchResult, Post, Tag} from "./Atomic.js";
import {SzuruEnv} from "../Common/Infrastructure/SzuruOcrConfig.js";
import {Logger} from "winston";
import {mergeArr} from "../Common/Util/util.js";

const makeApiCall = (endpoint: string, token: string) => {
    return async (url: string, {headers = {}, body = undefined, method = 'GET', ...requestedOpts} = {}) => {
        const defaultHeaders = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Token ${token}`
        };

        const opts: any = {
            headers: {
                ...defaultHeaders,
                ...headers
            },
            method,
            ...requestedOpts
            // should at least also have [body] if post
        };
        if (body !== undefined) {
            if (typeof body !== 'string') {
                opts.json = body
            } else {
                opts.body = body;
            }
        }

        try {
            return await got(`${endpoint}/${url}`, opts).json();
        } catch (e) {
            throw e;
        }
    }
};

export class SzuruService {

    endpoint: string;
    token: string;

    user: string;

    api: (url: string, options: any) => Promise<unknown>

    private tags?: Tag[]

    private mappedTags?: Map<string, Tag> = new Map();

    logger: Logger;

    constructor(opts: SzuruEnv, logger: Logger) {
        this.endpoint = opts.endpoints.back;
        this.token = opts.token;
        this.user = opts.user;
        this.logger = logger.child({labels: ['Szuru']}, mergeArr);

        this.api = makeApiCall(this.endpoint, Buffer.from(`${this.user}:${this.token}`).toString('base64'));
    }

    getPosts = async (params: Record<string, any> | undefined = {}): Promise<PagedSearchResult<Post>> => {
        const {limit, offset, ...rest} = params;
        const queryArr = Object.entries(rest).reduce((acc: string[], curr) => {
            const [key, val] = curr;
            let valStr = val;
            if(Array.isArray(val)) {
                valStr = val.join(',');
            }
            return acc.concat(`${key}:${valStr}`);
        }, []);

        return await this.api('posts', {
            searchParams: {
                limit,
                offset,
                query: queryArr.join(' ')
            },
            method: 'GET'
        }) as PagedSearchResult<Post>;
    }

    updatePostRaw = async (id: number, version: number, payload: object): Promise<Post> => {
        try {
            return await this.api(`post/${id}`, {
                method: 'PUT',
                body: {
                    version,
                    ...payload
                }
            }) as Post;
        } catch (e) {
            this.logger.error(`Error occurred while updating Post ${id}`);
            this.logger.error(e);
        }
    }

    updatePost = async (post: Post, payload: object): Promise<Post> => {
        return this.updatePostRaw(post.id, post.version, payload);
    }

    getTags = async (params: Record<string, any> | undefined = {}): Promise<PagedSearchResult<Tag>> => {
        return await this.api('tags', {
            searchParams: params,
            method: 'GET'
        }) as PagedSearchResult<Tag>;
    }

    getAllTags = async (params: Record<string, any> | undefined = {}): Promise<Tag[]> => {
        this.logger.verbose('Getting all tags...');
        let tags: Tag[] = [];
        let offset = 0;
        let total = 1;
        let isEmpty = false;

        const {limit = 100, ...rest} = params;
        let firstFetch = false;

        while(tags.length < total && !isEmpty) {
            const resp = await this.getTags({offset, limit, ...rest});
            isEmpty = resp.total === 0;
            total = resp.total;
            tags = tags.concat(resp.results);
            if(firstFetch) {
                this.logger.verbose(`Found ${total} tags, fetched ${tags.length} so far...`);
                firstFetch = false;
            } else {
                this.logger.verbose(`Fetched ${tags.length} tags so far...`);
            }
            offset += limit;
        }
        return tags;
    }

    cacheTags = async () => {
        if(this.tags === undefined) {
            this.logger.verbose('Caching tags...');
            this.tags = await this.getAllTags();
            for(const tag of this.tags) {
                for(const name of tag.names) {
                    this.mappedTags.set(name.toLocaleLowerCase(), tag);
                }
            }
        }
    }

    getTagByName = async (val: string): Promise<Tag | undefined> => {
        await this.cacheTags();
        return this.mappedTags.get(val.toLocaleLowerCase());
    }
}
