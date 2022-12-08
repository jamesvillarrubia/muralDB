/**
 * NOTICE 
 * This file was used to create the test data from a real, complex, mural output. 
 * Until a cleaner test model can be created, this can be used to obfuscate 
 * sensitive information in your own test data set.
 */

/* tslint:disable */
/* eslint-disable @typescript-eslint/no-var-requires */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const { default: Obfuscator } = require('data-obfuscator/build/src/obfuscator');
const json = require('./widgets.original.json')
const fs = require('fs')


const o = new Obfuscator()

const keys = new Set()
json.forEach(w=>{
    Object.keys(w).forEach(k=>{
        keys.add(k)
    })
})

o.ignoredFields = keys;
o.ignoredFields.delete('test')
o.ignoredFields.add('yes')
o.ignoredFields.delete("firstName");
o.ignoredFields.delete("lastName");
o.ignoredFields.delete("contentEditedBy")
o.ignoredFields.delete("createdBy")
o.ignoredFields.delete("updatedBy")
o.ignoredFields.delete("hyperlink")
o.ignoredFields.delete("text")
o.ignoredFields.delete("url")
o.ignoredFields.delete("thumbnailUrl")
o.ignoredFields.delete("link")
const results = o.obfuscate(json);

fs.writeFileSync("widgets.json",JSON.stringify(results))