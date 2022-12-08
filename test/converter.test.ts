import Converter from '../src/converter';
import { strict as assert } from 'assert'
import widgets from './widgets.json';
import { Widget } from '../src/types';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import mocha from 'mocha'

// mutates the data object directly
const getData = ()=>{
    return widgets.map(item=>({...item}));
}

describe('converter', () => {
    
    it('instantiates empty database', async () => {
        const con = new Converter() 
        await con.insertAsync([])
        const count = await con.countAsync({})
        assert.deepEqual(0, count)
        // await con.dropDatabaseAsync()
    });

    it('instantiates a database', async () => {
        const data = getData()
        const con = new Converter() 
        await con.insertAsync([data[0]])
        const count = await con.countAsync({})
        assert.equal(1, count)
        // await con.dropDatabaseAsync()
    });

    it('filter by type', async () => {
        const data = getData()
        const con = new Converter() 
        await con.insertAsync(data)
        const results = await con.filterType("sticky note")
        assert.strictEqual(results.length, 358)
    });

    it('starts with text', async () => {
        const data = getData()
        const con = new Converter() 
        await con.insertAsync(data)
        const results = await con.textStartsWith("OUA")
        assert.equal( results.length, 3)
        // await con.dropDatabaseAsync()
    });

    it('text contains', async () => {
        const data = getData()
        const con = new Converter() 
        await con.insertAsync(data)
        const results = await con.textContains("eSC7Wk")
        assert.equal( results.length, 2)
        // await con.dropDatabaseAsync()
    });

    it('runs raw collection filter', async () => {
        const data = getData()
        const con = new Converter()
        await con.insertAsync(data)
        const results = await con.findAsync({type:"sticky note"})
        assert.equal( results.length, 358)
        // await con.dropDatabaseAsync()
    });

    it('text matches Regex', async () => {
        const data = getData()
        const con = new Converter()
        await con.insertAsync(data)
        const results = await con.textMatchesRegex(/eSC7Wk*/g)
        assert.equal( results.length, 2)
        // await con.dropDatabaseAsync()
    });

    it('filter by bg color', async () => {
        const data = getData()
        const con = new Converter() 
        await con.insertAsync(data)
        const results1 = await con.filterBgColor('#FFC2E8FF')
        const results2 = await con.filterBgColor('#FFC2E8')
        const results3 = await con.filterBgColor('blue')
        const results4 = await con.filterBgColor('#FFC2E8asdfasdf')
        const results5 = await con.filterBgColor('aquamarine')
        assert.strictEqual(results1.length,35)
        assert.strictEqual(results2.length,35)
        assert.strictEqual(results3.length,0)
        assert.strictEqual(results4.length,0)
        assert.strictEqual(results5.length,1)
        // await con.dropDatabaseAsync()
    });

    it('can chain custom functions', async () => {
        const data = getData()
        const con = new Converter() 
        await con.insertAsync(data)
        const results1 = await con.filterType('sticky note')
        const results2 = await con.findAsync({ height: { $gte: 150 } })
        const results3 = await con.filterBgColor('#FFC2E8FF')
        const results4 = await con.filterType('sticky note').chainFindAsync({ height: { $gte: 150 } })
        const results5 = await con.filterBgColor('#FFC2E8FF').chainFindAsync({ height: { $gte: 100 } })
        const results6 = await con.filterBgColor('#FFC2E8FF').chainFindAsync({ height: { $gte: 100 } }).filterBgColor('#FFC2EAFF')

        assert.strictEqual(results1.length,358)
        assert.strictEqual(results2.length,50)
        assert.strictEqual(results3.length,35)
        assert.strictEqual(results4.length,4)
        assert.strictEqual(results5.length,13)
        assert.strictEqual(results6.length,0)
    });


    it('can chain custom and standard functions', async () => {
        const data = getData()
        const con = new Converter() 
        await con.insertAsync(data)

        const results1 = await con.filterType('sticky note')
        const results1b = await con.filterType('sticky note').asCursor()
        const results1c = await con.filterType('sticky note').asCursor().sort({type:1})
        const results1d = await con.filterType('sticky note').asCursor().sort({type:1}).limit(1)

        const results2  = await con.findAsync(     { height: { $gte: 150 } })      .sort({type:1}).limit(2)

        const results2b = await con.chainFindAsync({ height: { $gte: 150 } }).asCursor().sort({type:1}).limit(2) as unknown as Widget[]

        const results3 = await con.filterBgColor('#FFC2E8FF').asCursor().sort({type:1}).limit(3) as unknown as Widget[]

        const results4 = await con.filterType('sticky note').chainFindAsync({ height: { $gte: 150 } }).and().sort({type:1}).limit(4)

        const results5 = await con.filterBgColor('#FFC2E8FF').chainFindAsync({ height: { $gte: 100 } }).and().sort({type:1}).limit(5)

        const results6 = await con.filterBgColor('#FFC2E8FF').chainFindAsync({ height: { $gte: 100 } }).filterBgColor('#FFC2EAFF').and().sort({type:1}).limit(1)
        
        
        assert.strictEqual(results1.length,358)
        assert.strictEqual(results1b.length,358)
        assert.strictEqual(results1c.length,358)
        assert.strictEqual(results1d.length,1)
        assert.strictEqual(results2[0].type, 'area')
        assert.strictEqual(results2.length,2)
        assert.strictEqual(results2[0].type, 'area')
        assert.strictEqual(results2b[0].type, 'area')

        assert.strictEqual(results3.length,3)
        assert.strictEqual(results3[0].type, 'area')
        assert.strictEqual(results4.length,4)
        assert.strictEqual(results5.length,5)
        assert.strictEqual(results6.length,0)
    });
    

    it('confirm that findAsync and chainFindAsync return the same results', async () => {
        const data = getData()
        const con = new Converter()
        await con.insertAsync(data)
        const results1 = await con.chainFindAsync({ height: { $gte: 50 } })
        const results2 = await con.findAsync({ height: { $gte: 50 } })
        assert.strictEqual(results1.length,results2.length)
    });

    it('confirm that _updateSync and updateAsync return the same results', async () => {
        const data = getData()
        const con1 = new Converter()
        await con1.insertAsync(data)
        const results1 = await con1.chainUpdateAsync({ height: { $gte: 200 }},{$set:{updated:true}})

        const con2 = new Converter()
        await con2.insertAsync(data)
        const results2 = (await con2.updateAsync({ height: { $gte: 200 }},{$set:{updated:true}},{multi:true, returnUpdatedDocs:true})).affectedDocuments
        assert.strictEqual(results1.length,results2.length)
    });

    it('confirm that chainUpdateSync doesn\'t modify core data', async () => {
        const data = getData()
        const con = new Converter()
        await con.insertAsync(data)
        const results1 = await con.chainUpdateAsync({ height: { $gte: 50 } },{$set:{updated:true}}, {modifyOriginal:false})
        const newResults1 = await con.findAsync({height: { $gte: 50 }, updated:true})
        assert.strictEqual(newResults1.length,0)
        assert.strictEqual(results1.length,519)

        const results2 = (await con.updateAsync({ height: { $gte: 50 } },{$set:{updated:true}},{multi:true, returnUpdatedDocs:true})).affectedDocuments
        const newResults2 = await con.findAsync({height: { $gte: 50 }, updated:true})
        assert.strictEqual(newResults2.length,results2.length)
    });

    it('confirm that updateSync does modify core data', async () => {
        const data = getData()
        const con = new Converter()
        await con.insertAsync(data)
        const results = await con.chainUpdateAsync({ height: { $gte: 200 } },{$set:{updated:true}}, {modifyOriginal:true})
        assert.strictEqual(results.length,29)
    });

    
    it('add Relations', async function (){
        this.timeout(10000);
        const data = getData()
        const con = new Converter() 
        await con.insertAsync(data)
        const results1 = await con.addRelations()
        assert.strictEqual(results1.length,700)
        const results2 = await con.findAsync(
            {"$or":[
                {'arrowParent' : {'$exists': true}}
            ]}
        ).sort({arrowParent:1})
        assert.strictEqual(results2.length,223)
        assert.strictEqual(results2[0].arrowParent,'0-1667868664111')
    });
    

});
