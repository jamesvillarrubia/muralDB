/* eslint-disable @typescript-eslint/no-explicit-any */
import Nedb from '@seald-io/nedb'
import Cursor from '@seald-io/nedb/lib/cursor'
import { Widget, Options, Cursor as C, UpdateOptions } from './types' 

const ensureArray = (input: any[]|any)=>{
    if(!Array.isArray(input)){ return [input] }
    return input
}

class MuralDB extends Nedb{
    acct: string
    mural: string
    queue: Promise<void|Array<Widget>>
    cacheDb: MuralDB|null
    [K: string]: any



    constructor(options ={}){
        super(options);

        const {
            data = [], 
            // idField="id", 
            // dbname="muraldb", 
            acctId, 
            muralId
        } = options as Options
        // this.raw = data
        this.acct = acctId
        this.mural = muralId
        this.queue = Promise.resolve()
        this.cacheDb = null;

        if(!Array.isArray(data)){
            throw ('Data must be an array of objects')
        }
    }


    // Added to make the class thenable
    then(
        onFulfilled?:
          | ((value: any) => any)
          | undefined
          | null,
        onRejected?:
          | ((reason: any) => any)
          | undefined
          | null
      ){        
       if(onFulfilled) onFulfilled(this.queue); 
       if(onRejected) onRejected(this.queue);
    }
    catch (onRejected: ((value: any) => any)) {
        return onRejected(this.queue);
    }
    
    finally (onFinally: (() => any)) {
        return onFinally()
    }


    chain(callback: (value:Widget[]|void)=>Promise<Widget[]|void>): Promise<any>|C<any> {
        return this.queue = this.queue
            .then(callback)
            .finally(()=>{ // this is CRITICAL or queues will continue to add, despite distinct awaits
                this.queue = Promise.resolve() //new Cursor(this, {}, this.queuePromise.resolve()
                this.cacheDb = null
            })
    }

    asCursor(projection={}) : C<Widget[]> {
        const cursor = new Cursor(this,{})

        const proxyCursor: C<Widget[]> = {
            sort: (function (this: C<any>, x: any): C<Widget[]> {
                this.sort(x)
                return proxyCursor
            }).bind(cursor),

            limit: (function (this: C<any>, x: number): C<Widget[]> {
                this.limit(x)
                return proxyCursor
            }).bind(cursor),

            skip: (function (this: C<any>, x: number): C<Widget[]> {
                this.skip(x)
                return proxyCursor
            }).bind(cursor),
            projection: cursor.projection,
            exec: cursor.exec,
            then: (async function (
                this: any,
                onFulfilled?: ((value: any) => any) |
                    undefined |
                    null,
                onRejected?: ((reason: any) => any) |
                    undefined |
                    null
            ): Promise<any> {
                const results = await this.queue
                this.cacheDb = null // clear it so the newDB is forced to be created
                await this.setupCacheDb(results)
                const output = this.cacheDb.findAsync({}).sort(cursor._sort).skip(cursor._skip).limit(cursor._limit).projection(projection)
                this.cacheDb = null // remove the cache so that it doesn't bias the next sort/skip/limit
                if (onFulfilled)
                    onFulfilled(output)
                if (onRejected)
                    onRejected(output)
            }).bind(this),
        }
        return proxyCursor

        ////// THIS WORKS FOR asCursor() but not asCursor().limit()
        // return cursor
        // .then(async (r)=>{
        //     console.log('before queue')
        //     const results = await this.queue
        //     return results
        // })
    }
    // add an extra mechanism to call
    and = this.asCursor


    async setupCacheDb(results: void | Widget[]): Promise<any>{
        this.cacheDb = this.cacheDb || new MuralDB()
        const count = await this.cacheDb.countAsync({})

        if(results){
            await this.cacheDb.insertAsync(results)
        }else if(count === 0){
            await this.cacheDb.insertAsync(this.getAllData())
        }
    }

    async runOperation(results: void | Widget[], func:string, params:any){
        await this.setupCacheDb(results)
        // run the command on the new db
        return this.cacheDb ? await this.cacheDb[func](...params) : null

    }


    chainFindAsync (query: any, projection: any ={}) : MuralDB{
        this.chain(async(results: any): Promise<any[]>=>{
            await this.setupCacheDb(results)
            return this.cacheDb ? await this.cacheDb.findAsync(query,projection) : Promise.resolve([]) // returns entire results set
        })
        return this
    }

    filterType(types: string[]|string, projection:any={}) : MuralDB{
        types = ensureArray(types)
        this.chain(async(results: void | Widget[]) : Promise<any[]> =>{
            const func = 'chainFindAsync'
            const params = [{type:{'$in':types}},projection]
            return await this.runOperation(results, func, params)
        })
        return this
    }


    textStartsWith(text:string, projection={}) : MuralDB{
        this.chain(async(results: void | Widget[]): Promise<any[]>=>{
            const func = 'chainFindAsync'
            const params = [{
                // @ts-expect-error this context is passed as the object from the nedb library
                $where: function():boolean{return !!this.text && this.text.startsWith(text)}
            },projection]

            return this.runOperation(results, func, params)
        })
        return this
    }



    // Updates widgets and works with chained results
    chainUpdateAsync (query: any, updateQuery:any, options?: UpdateOptions) : MuralDB {

        // check if the user wants to update the original dataset or just the results of the chain
        options = Object.assign({ 
            multi:true,
            returnUpdatedDocs:true,
            modifyOriginal: false
        }, options)
        // super cannot exist inside the chain promise, so it must be bound externally and referenced.
        // const update = this.updateAsync
        this.chain(async(results: void | Widget[]): Promise<void|Widget[]>=>{
            await this.setupCacheDb(results)
            if(options?.modifyOriginal){
                await this.updateAsync.apply(this,[query,updateQuery,options])
            }       
            const output = await this.updateAsync.apply(this.cacheDb,[query,updateQuery,options])
            return output.affectedDocuments || []
            // this should return the entire DB, not just the modified ones.  User should follow a new query for modified elements
    
        })
        return this
    }


    // modifies only objects in the result set.
    // returns the entire results, not just the changed ones
    // modifyOriginal:boolean, parentField:string
    addRelations( modifyOriginal = true, parentField = 'arrowParent') : MuralDB{
        
        this.chain( async (results: void | Widget[]): Promise<any[]>=>{
            await this.setupCacheDb(results)
            // get the arrows from the FULL original db
                // type:arrow && tip:single
                // parent = startRefId
                // widget = endRefId
            const arrows = await this.findAsync({
                type:'arrow',
                tip:'single'
            },{
                endRefId:1, startRefId:1
            })

            //update by adding parents but only in the selected DB
            const relationPromises = arrows.map(async (a)=>{
                const query = {_id:a._id};
                const set = {$set:{[parentField]:a.startRefId}}
                const options = {multi:false,returnUpdatedDocs:true }
                if(modifyOriginal && a.startRefId){
                    await this.updateAsync.apply(this,[query,set, options])
                }
                return this.updateAsync.apply(this.cacheDb,[query,set, options])
                    .then(r=>r.affectedDocuments);                 
  
            })
            await Promise.all(relationPromises)

            // returns entire results set
            return this.cacheDb ? this.cacheDb.findAsync({}) : Promise.resolve([]) 

        })
        return this
    }

    textContains(text:string, projection={}) : MuralDB{
       this.chain(async(x): Promise<any[]>=>{
            const func = 'chainFindAsync'
            const params = [{
                // @ts-expect-error this context is passed as the object from the nedb library
                $where: function():boolean{return !!this.text && this.text.includes(text)}
            },projection]
            return this.runOperation(x, func, params)
        })
        return this
    }

    textMatchesRegex(expression:RegExp|string, projection={}) : MuralDB{
        try {
            const regex = new RegExp(expression);
            this.chain(async(x): Promise<any[]>=>{
                const func = 'chainFindAsync'
                const params = [{
                    // @ts-expect-error this context is passed as the object from the nedb library
                    $where: function():boolean{return !!this.text && !!this.text.match(regex)}
                },projection]
                return this.runOperation(x, func, params)
            })
            return this            
        } catch(e) {
            throw "Invalid Regex expression."
        }
    }
    filterBgColor(color:string, projection={}) : MuralDB{
        const validColorReg=/^#([0-9a-f]{3}){1,2}$/i;
        if(!validColorReg.test(color)){
            const colors:any = {"aliceblue":"#f0f8ff","antiquewhite":"#faebd7","aqua":"#00ffff","aquamarine":"#7fffd4","azure":"#f0ffff",
            "beige":"#f5f5dc","bisque":"#ffe4c4","black":"#000000","blanchedalmond":"#ffebcd","blue":"#0000ff","blueviolet":"#8a2be2","brown":"#a52a2a","burlywood":"#deb887",
            "cadetblue":"#5f9ea0","chartreuse":"#7fff00","chocolate":"#d2691e","coral":"#ff7f50","cornflowerblue":"#6495ed","cornsilk":"#fff8dc","crimson":"#dc143c","cyan":"#00ffff",
            "darkblue":"#00008b","darkcyan":"#008b8b","darkgoldenrod":"#b8860b","darkgray":"#a9a9a9","darkgreen":"#006400","darkkhaki":"#bdb76b","darkmagenta":"#8b008b","darkolivegreen":"#556b2f",
            "darkorange":"#ff8c00","darkorchid":"#9932cc","darkred":"#8b0000","darksalmon":"#e9967a","darkseagreen":"#8fbc8f","darkslateblue":"#483d8b","darkslategray":"#2f4f4f","darkturquoise":"#00ced1",
            "darkviolet":"#9400d3","deeppink":"#ff1493","deepskyblue":"#00bfff","dimgray":"#696969","dodgerblue":"#1e90ff",
            "firebrick":"#b22222","floralwhite":"#fffaf0","forestgreen":"#228b22","fuchsia":"#ff00ff",
            "gainsboro":"#dcdcdc","ghostwhite":"#f8f8ff","gold":"#ffd700","goldenrod":"#daa520","gray":"#808080","green":"#008000","greenyellow":"#adff2f",
            "honeydew":"#f0fff0","hotpink":"#ff69b4","indianred ":"#cd5c5c","indigo":"#4b0082","ivory":"#fffff0","khaki":"#f0e68c",
            "lavender":"#e6e6fa","lavenderblush":"#fff0f5","lawngreen":"#7cfc00","lemonchiffon":"#fffacd","lightblue":"#add8e6","lightcoral":"#f08080","lightcyan":"#e0ffff","lightgoldenrodyellow":"#fafad2",
            "lightgrey":"#d3d3d3","lightgreen":"#90ee90","lightpink":"#ffb6c1","lightsalmon":"#ffa07a","lightseagreen":"#20b2aa","lightskyblue":"#87cefa","lightslategray":"#778899","lightsteelblue":"#b0c4de",
            "lightyellow":"#ffffe0","lime":"#00ff00","limegreen":"#32cd32","linen":"#faf0e6",
            "magenta":"#ff00ff","maroon":"#800000","mediumaquamarine":"#66cdaa","mediumblue":"#0000cd","mediumorchid":"#ba55d3","mediumpurple":"#9370d8","mediumseagreen":"#3cb371","mediumslateblue":"#7b68ee",
            "mediumspringgreen":"#00fa9a","mediumturquoise":"#48d1cc","mediumvioletred":"#c71585","midnightblue":"#191970","mintcream":"#f5fffa","mistyrose":"#ffe4e1","moccasin":"#ffe4b5",
            "navajowhite":"#ffdead","navy":"#000080","oldlace":"#fdf5e6","olive":"#808000","olivedrab":"#6b8e23","orange":"#ffa500","orangered":"#ff4500","orchid":"#da70d6",
            "palegoldenrod":"#eee8aa","palegreen":"#98fb98","paleturquoise":"#afeeee","palevioletred":"#d87093","papayawhip":"#ffefd5","peachpuff":"#ffdab9","peru":"#cd853f","pink":"#ffc0cb","plum":"#dda0dd","powderblue":"#b0e0e6","purple":"#800080",
            "rebeccapurple":"#663399","red":"#ff0000","rosybrown":"#bc8f8f","royalblue":"#4169e1",
            "saddlebrown":"#8b4513","salmon":"#fa8072","sandybrown":"#f4a460","seagreen":"#2e8b57","seashell":"#fff5ee","sienna":"#a0522d","silver":"#c0c0c0","skyblue":"#87ceeb","slateblue":"#6a5acd","slategray":"#708090","snow":"#fffafa","springgreen":"#00ff7f","steelblue":"#4682b4",
            "tan":"#d2b48c","teal":"#008080","thistle":"#d8bfd8","tomato":"#ff6347","turquoise":"#40e0d0",
            "violet":"#ee82ee","wheat":"#f5deb3","white":"#ffffff","whitesmoke":"#f5f5f5","yellow":"#ffff00","yellowgreen":"#9acd32"};
        
            if (typeof colors[color.toLowerCase()] != 'undefined')
                color = colors[color.toLowerCase()];
        }
        color = color.toUpperCase();

        this.chain(async (x): Promise<any[]>=>{
            const func = 'chainFindAsync'
            const params = [{
                $where: function():boolean{
                    // @ts-expect-error this context is passed as the object from the nedb library
                    return !!this.style && !!this.style.backgroundColor && this.style.backgroundColor.indexOf(color)===0
                }
            },projection]
            return this.runOperation(x, func, params)
        })
        return this
    }

}

export default MuralDB