import Nedb from "@seald-io/nedb"

export interface Person {
    firstName: string
    lastName: string
    type: string
}
export interface Style {
    // shared
    backgroundColor?: string
    
    //stickynote
    bold?: boolean
    font?: string
    fontSize?: number
    italic?: boolean
    strike?: boolean
    textAlign?: string
    underline?: boolean
    border?: boolean

    //area
    borderColor?: string
    borderStyle?: string
    borderWidth?: number
    titleFontSize?: number

    //arrow
    strokeColor?: string
    strokeStyle?: string
    strokeWidth?: number
}

export interface Widget{
    id: string
    style: Style
    contentEditedBy: Person
    createdBy: Person
    updatedBy: Person
    type: string    
    hidden: boolean
    hideEditor: boolean
    hideOwner: boolean
    locked: boolean
    lockedByFacilitator: boolean
    presentationIndex: number
    rotation: number
    stackingOrder: number
    updatedOn: number
    x: number
    y:number

    width?: number
    minLines?: number
    shape?: string
    hyperlink?: string
    text?: string
    url?: string
    thumbnailUrl?: string
    link?: string
    instruction?: string
    parentId?: null
    title?: string
    height?: number

    //arrow
    tip?: string
    stackable?: boolean,
    endRefId?: string
    startRefId: string,
    points?: object[]

    // custom fields
    parent?: string[]
    [K: string]: any  //allows the addition of new fields
}

export interface Options {
    idField: string
    acctId: string
    muralId: string
    data: [Widget]
}

export interface Cursor<T>{
    [x: string]: unknown
    sort(query: any): Cursor<T>;
    skip(n: number): Cursor<T>;
    limit(n: number): Cursor<T>;
    projection(query: any): Cursor<T>;
    exec(callback: (err: Error | null, documents: T[]) => void): void;
}

export interface UpdateOptions extends Partial<Nedb.UpdateOptions>{
    modifyOriginal?: boolean
}
