export interface MicroTag {
    names: string[]
    category: string
    usages: number
}

export interface Tag extends MicroTag {
    version: number
    implications: MicroTag[]
    suggestions: MicroTag[]
    creationTime: string
    lastEditTime: string
    description: string
}

export type Coordinate = [number, number];

export interface Note {
    polygon: Coordinate[]
    text: string
}

export interface MicroPost {
    id: number
    thumbnailUrl: string
}

export interface Post {
    id: number
    version: number
    creationTime: string
    lastEditTime: string
    safety: string
    source: string
    type: string
    mimeType: string
    fileSize: number
    canvasWidth: number
    canvasHeight: number
    contentUrl: string
    thumbnailUrl: string
    flags: any[]
    tags: MicroTag[]
    relations: MicroPost[]
    user: { name: string, avatarUrl: string }
    score: number
    ownScore: number
    tagCount: number
    notes: Note[]
    comments: any[]
    pools: any[]

}

export interface PagedSearchResult<T> {
    query: string
    offset: number
    limit: number
    total: number
    results: T[]
}
