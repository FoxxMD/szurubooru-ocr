import {Post} from "../../Szuru/Atomic.js";
import {RecognizeResult} from "tesseract.js";

export interface HttpFetchTask {
    post: Post
}

export interface OcrTask extends HttpFetchTask {
    post: Post
    imageData: string
}

export interface UpdateTask extends OcrTask {
    result: RecognizeResult
}
