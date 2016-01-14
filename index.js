/*
 * TODO:
 *  - update to use new parse tree
 *  - consider all splits of a word based on subpatterns
 *  - try applying each split, returning # misprints
 *  - re-sort dictionary by word LENGTH
 *  - implement timeout after 1k words (configurable)
 */

import PEG from 'pegjs'
import fs from 'fs'
import exampleQuery from './example'
import combinatorics from 'js-combinatorics'
function* fibonacci() { // a generator function
    let [prev, curr] = [0, 1];
    while (true) {
        [prev, curr] = [curr, prev + curr];
        yield curr;
    }
}

for (let n of fibonacci()) {
    console.log(n);
    // truncate the sequence at 1000
    if (n >= 1000) {
        break;
    }
}

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
//dictionary = ["about", "abound", "abetter", "thousand", "url", "bought", "triangle", "altering"]
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
    }
  }

  return words
}

function elementMatches(eltSpecs, anagram, context, value){
  //console.log("Elt matchies", eltSpecs, anagram, value)
  if (!anagram) {
    var eltSpec = eltSpecs[0]
    if (eltSpec.match === 'anything') return [0]
    if (eltSpec.match === 'word') return !!wordExists[value] ? [0] : []
    if (eltSpec.match === 'reverse-word') return !!wordExists[value.split("").reverse().join("")] ? [0] : []
      if (typeof eltSpec === 'string'){
        return value.length > 0 && eltSpec.indexOf(value) !== -1 ? [0] : []
      }
    if (eltSpec.type){
      return evaluateQualifiedPattern(eltSpec, context, value+'$') ? [0] : []
    }
  } else {
    var possibleElements = []
    for (var i=0; i < eltSpecs.length; i++){
      var eltSpec = eltSpecs[i]
      if (elementMatches([eltSpec], false, context, value).length > 0) {
        possibleElements.push(i)
      }
    }
    return possibleElements
  }
}

function rangesFit(context, budget, anagram, ranges, elements, word){
  if (ranges.length === 0) {
    //console.log("Success", word)
    return (word === '$')
  }

  for (var i=0; i <= word.length;i++){
    var possibleElements = elementMatches(elements, anagram, context, word.slice(0,i))
    //console.log("Possible", possibleElements, elements, word, i,ranges.length, elements.length, word.slice(0, i), ".")

    if (possibleElements.length == 0) {
      //console.log("Impossible", word, i)
      continue
    }

    for (var j=0;j<possibleElements.length;j++) {
      var spliceIdx = possibleElements[j]
      var splicedRanges = ranges.slice(0,spliceIdx).concat(ranges.slice(spliceIdx+1))
      var splicedElts = elements.slice(0,spliceIdx).concat(elements.slice(spliceIdx+1))
      if (rangesFit(context, budget - i, anagram, splicedRanges, splicedElts, word.slice(i))) {
        return true
      }
    }
  }
  return false
}

function evaluatePatternOn(e, context, word){
  // console.log("Eval pat on", word, e.elements)
  var targetLen = word.length - 1
  var elements = e.elements
  var elementLengths = e.ranges
  return rangesFit(context, e.maxLength, !!e.anagram, e.ranges, elements, word)
}

function evaluateSimplePattern(e, context, word){
  var ret = false;
  if (e.elements) {
    ret = evaluatePatternOn(e, context, word);
  }
  return ret
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
