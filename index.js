/*
 * TODO:
 *  - implement a separate searcher for anagram+star mode, which uses constraint propagation
 *    to tile the elements until they don't overlap.
  *    each position  'word' is a variable whos vals can be {unassigned, elt1, elt2, ... eltn}
 *  - re-sort dictionary by word LENGTH
 *  - implement timeout after 1k words (configurable)
 */

import PEG from 'pegjs'
import fs from 'fs'
import exampleQuery from './example'
import combinatorics from 'js-combinatorics'
import _ from 'underscore'

var grammarSpec = fs.readFileSync('grammar.peg').toString()

var ticks = [new Date().getTime()]
function tick(){
  ticks.push(new Date().getTime())
  return ticks.slice(1).map((tickTime, i)=>tickTime - ticks[i])
}

try {
  var grammar = PEG.buildParser(grammarSpec)
} catch(e){
  console.log(e, typeof e, e.stack)
  console.log(e.message, '\n', JSON.stringify(e.location, null, 2))
  process.exit(0)
}
console.log("Grammer built", tick())

var dictionary = fs.readFileSync('dictionary/ukacd.txt').toString().split('\n')
//dictionary = ["elating"]
var wordExists = dictionary.reduce((coll, w) => {
  coll[w] = true
  return coll
}, {})

console.log("Words loaded", dictionary.length, tick())

var example = grammar.parse(exampleQuery)

try {
  console.log(JSON.stringify(example, null, 2))
} catch (e) {
  console.log(e.message, '\n', JSON.stringify(e.location, null, 2))
}

function evaluate(start){

  var context = {
    candidates: dictionary.filter( w => w.length >= start.qualifier.length[0] && w.length <= start.qualifier.length[1])
  }

  var words = []

  for (var i=0;i<context.candidates.length;i++){
    var word = context.candidates[i]
    //console.log("so gonna wordl", word)
    if (evaluateQualifiedPattern(start, context, word+'$')) {
      words.push(word)
      if (words.length > 1000)
        return words
    }
  }

  return words
}

function elementMatches(e, element, context, word){
  if (typeof element === 'string'){
    return  (word.length && element.indexOf(word) !== -1)
  }
  if (element.match === 'anything') return true
  if (element.match === 'word') return !!wordExists[word]
  if (element.match === 'reverse-word') return !!wordExists[word.split("").reverse().join("")]
  if (element.type){
    var ret = evaluateQualifiedPattern(element, context, word+'$')
    return ret
  }
}

function alignElementsToWord(e, context, ranges, elements, word, count){
  if (elements.length === 0) return (word === '$')
  var maxElt = e.anagram ? elements.length : 1


  // first recursive step heuristics
  if (!count){
    var simples = elements.filter(e=> e.length==1)
    for (var i=0; i<simples.length;i++){
      if (word.indexOf(simples[i]) === -1) return false
    }
    if (e.maxLength === e.minLength){
      if(word.length !== e.maxLength+1) return false
    }
    if (word.length - 1 > e.maxLength) return false
    if (word.length - 1 < e.minLength) return false
  }


  for (var i=0; i<maxElt; i++){
    var element = elements[i]

    for (var j=ranges[i][0]; j <= ranges[i][1] && j < word.length ; j++){
      //TODO accept misprints here, when they're enabled and when 'element' is a simple matcher
      if (!elementMatches(e, element, context, word.slice(0,j))){
        continue
      }
      if (alignElementsToWord(e,
                              context,
                              ranges.slice(0,i).concat(ranges.slice(i+1)),
                              elements.slice(0,i).concat(elements.slice(i+1)),
                              word.slice(j), (count||0)+1)) {
                                return true
                              }
    }
  }

  return false
}

function evaluateSimplePattern(e, context, word){
  return alignElementsToWord(e, context, e.ranges, e.elements, word)
}

function evaluateQualifiedPattern(e, context, word){
  // console.log("Evaluate qualipat", "WORD", word, word.length)

 if (e.type === 'simple-pattern') {
    return evaluateSimplePattern(e, context, word)
 }

 if (e.type !== 'compound-pattern') {
  throw new Error("got non-compound in evaluateQualiflied" + e)
 }

 if (e.op === 'not') {
    return !evaluateQualifiedPattern(e.args[0], context, word)
  } else if (e.op === 'or') {
    for (var i=0; i< e.args.length;i++){
      if (evaluateQualifiedPattern(e.args[i], context, word))
        return true
    }
    return false
  } else if (e.op === 'and') {
    for (var i=0; i< e.args.length;i++){
      if (!evaluateQualifiedPattern(e.args[i], context, word))
        return false
    }
    return true
  }

  throw "Unrecognized " + e

}

var results = evaluate(example)
console.log("Matching words", results, results.length, tick());
