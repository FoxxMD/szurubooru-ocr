import AbstractConfigDocument from "./AbstractConfigDocument.js";
import {stringify, parse} from 'comment-json';
import JSON5 from 'json5';
import {ConfigFormat} from "../Infrastructure/Atomic.js";
import {SzuruOcrConfig} from "../Infrastructure/SzuruOcrConfig.js";

class JsonConfigDocument extends AbstractConfigDocument<SzuruOcrConfig> {

    public parsed: SzuruOcrConfig;
    protected cleanParsed: SzuruOcrConfig;
    public format: ConfigFormat;

    public constructor(raw: string, location?: string) {
        super(raw, location);
        this.parsed = parse(raw) as unknown as SzuruOcrConfig;
        this.cleanParsed = JSON5.parse(raw);
        this.format = 'json';
    }

    public toJS(): SzuruOcrConfig {
        return this.cleanParsed;
    }

    public toString(): string {
        return stringify(this.parsed, null, 1);
    }

}

export default JsonConfigDocument;
