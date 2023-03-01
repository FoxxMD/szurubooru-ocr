export interface SzuruEnv {
    token: string,
    user: string,
    endpoints: {
        front: string
        back: string
    }
    query?: Record<string, any>
}

export interface TagExtractOptions {
    enable?: boolean
    behavior?: 'add' | 'overwrite' | 'empty'
}

export interface NoteExtractOptions {
    enable?: boolean
    behavior?: 'add' | 'overwrite' | 'empty'
}

export interface StrongExtractOptions {
    tags?: TagExtractOptions
    notes?: NoteExtractOptions
}

export interface SzuruOcrConfig {
    lastCheckedId?: number

    workers?: {
        ocr?: number
        http?: number
    }

    extract: {
        tags?: boolean | TagExtractOptions
        notes?: boolean | NoteExtractOptions
    }

    confidenceThreshold?: number

    szuru: SzuruEnv
}
