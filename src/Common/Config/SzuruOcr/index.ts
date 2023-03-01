import YamlConfigDocument from "../YamlConfigDocument.js";
import JsonConfigDocument from "../JsonConfigDocument.js";
import {YAMLMap, YAMLSeq, Pair, Scalar} from "yaml";
import {SzuruOcrConfig} from "../../Infrastructure/SzuruOcrConfig.js";
import {Dayjs} from "dayjs";

export interface SzuruOcrConfigDocumentInterface {
    setLastCheckedId(id: number): void;
    toJS(): SzuruOcrConfig;
}

export class YamlSzuruOcrConfigDocument extends YamlConfigDocument implements SzuruOcrConfigDocumentInterface {

    setLastCheckedId(id: number) {
        this.parsed.set('lastCheckedId', id);
    }

    toJS(): SzuruOcrConfig  {
        return super.toJS() as SzuruOcrConfig;
    }
}

export const mergeObjectToYaml = (source: object, target: YAMLMap) => {
    for (const [k, v] of Object.entries(source)) {
        if (target.has(k)) {
            const targetProp = target.get(k);
            if (targetProp instanceof YAMLMap && typeof v === 'object') {
                const merged = mergeObjectToYaml(v, targetProp);
                target.set(k, merged)
            } else {
                // since target prop and value are not both objects don't bother merging, just overwrite (primitive or array)
                target.set(k, v);
            }
        } else {
            target.add({key: k, value: v});
        }
    }
    return target;
}

export class JsonSzuruOcrConfigDocument extends JsonConfigDocument implements SzuruOcrConfigDocumentInterface {
    setLastCheckedId(id: number) {
        this.parsed.lastCheckedId = id;
    }

    toJS(): SzuruOcrConfig {
        return super.toJS();
    }
}
