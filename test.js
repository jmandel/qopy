/*
 * TODO:
 */

import exampleQuery from './example'
import qopy from './lib/qopy'

var t0 = new Date().getTime()
var results = qopy(exampleQuery, 'ukacd')
var t1 = new Date().getTime()

console.log("Matching words", results, results.length, t1-t0)
