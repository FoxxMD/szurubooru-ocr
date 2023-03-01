import AbstractConfigDocument from "./AbstractConfigDocument.js";
import {Document as YamlDocument} from "yaml";
import {SzuruOcrConfig} from "../Infrastructure/SzuruOcrConfig.js";

export interface ConfigToObjectOptions {
    location?: string,
    jsonDocFunc?: (content: string, location?: string) => AbstractConfigDocument<SzuruOcrConfig>,
    yamlDocFunc?: (content: string, location?: string) => AbstractConfigDocument<YamlDocument>
    allowArrays?: boolean
}
