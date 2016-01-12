import fs from 'fs'
import request from 'request'

request(process.argv.slice(-1)[0], (err, resp, body) => {
  var wordsIn = body.split('\n')
  var words = wordsIn
  .map( w=> w.toLowerCase().replace(/[^a-z]/g, ""))
  .filter( w=> w.length > 0)
  .reduce((coll, word) => {
    coll[word] = true
    return coll
  }, {})
  var wordsSorted = Object.keys(words).sort()
  console.log(wordsSorted.join('\n'))
})
