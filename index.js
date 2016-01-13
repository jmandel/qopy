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
//dictionary = ["about", "abound", "abetter", "thousand"]
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

Array.prototype.flatMap = function(fn) {
  return Array.prototype.concat.apply([], this.map(fn));
}


function choicesFrom(e, wordDetails){
  var ret = []
  var subpattern = e.pattern[0]
  var nexte = Object.assign({}, e, {pattern: e.pattern.slice(1)})

  var word = wordDetails[0]
  var misprint = wordDetails[1]

  if (typeof subpattern === "string") {
    if (subpattern.indexOf(word[0]) !== -1){
      ret.push([word.slice(1), misprint])
    } else if (!misprint){
      ret.push([word.slice(1), true])
    }
  } else if (subpattern[0] === 'anything'){
    for (var i=0;i<word.length;i++){
      ret.push([word.slice(i), misprint])
    }
  } else if (subpattern[0] === 'word'){
    for (var i=2;i<word.length;i++){
      if (wordExists[word.slice(0, i)]) {
        ret.push([word.slice(i), misprint])
      }
    }
  } else if (subpattern[0] === 'reverse-word') {
    for (var i=2;i<word.length;i++){
      if (wordExists[word.slice(0, i).split("").reverse().join("")]) {
        ret.push([word.slice(i), misprint])
      }
    }
  }

  return ret.map(r => ({nexte: nexte, word: r}))
}

function anagramChoicesFrom(e, wordDetails){
  var ret = [];
  var word = wordDetails[0];
  var subpattern = e.pattern[0]
  var nexte = Object.assign({}, e, {pattern: e.pattern.slice(1)})

  if (typeof subpattern === "string") {
    for (var i=0; i<subpattern.length; i++){
      var char = subpattern[i];
      var where = word.indexOf(char)
      if (where !== -1){
        ret.push([word.slice(0,where).concat(word.slice(where+1)), false])
      }
    }
  } else if (subpattern[0] === 'anything'){
    ret.push(['$', false])
  } else {
    throw "unexpected character in pattern " + subpattern[0]
  }

  return ret.map(r => ({nexte: nexte, word: r}))
}

function letterbankChoicesFrom(e, wordDetails){
  var ret = [];
  var word = wordDetails[0];
  var subpattern = e.pattern[0]
  var char = word[0]


  for (var j=0; j < e.pattern.length; j++) {
    if (e.pattern[j][0] === 'anything'){
      return [{nexte: e, word: ['$']}]
    }
    if (e.pattern[j].indexOf(char) !== -1){
      ret.push({
        nexte: {
          lead: '*/',
          pattern: e.pattern.slice(0,j).concat(e.pattern.slice(j+1))
        },
        word: [word.slice(1), false]
      })
    }
  }

  return ret
}

function cartesianProduct(paramArray) {

  function addTo(curr, args) {

    var i, copy, 
        rest = args.slice(1),
        last = !rest.length,
        result = [];

    for (i = 0; i < args[0].length; i++) {

      copy = curr.slice();
      copy.push(args[0][i]);

      if (last) {
        result.push(copy);

      } else {
        result = result.concat(addTo(copy, rest));
      }
    }

    return result;
  }

  return addTo([], Array.prototype.slice.call(paramArray));
}

function splitWordInto(word, elementLengths){
  var lengthRanges = elementLengths.map(([lower, upper]) => {
    var ret = []
    for (var i=lower;i<=upper;i++){
      ret.push(i)
    }
    return ret
  })

  var splits = cartesianProduct(lengthRanges)
  .filter(r =>
    word.length - 1 ===  r.reduce((sum, val) => sum+val, 0)
  )

  return splits.map( s => { var substrs = [] var sum = 0;
    for (var i=0; i<s.length;i++) {
      var len = s[i]
      substrs.push(word.slice(sum, sum+len))
      sum += len
    }
    return substrs;
  })

}

var MAX_WORD_LEN = 100


function elementMatches(eltSpec, value){
  //console.log("eltmatch", eltSpec, value)
  if (eltSpec.match === 'anything') return true
  if (eltSpec.match === 'word') return !!wordExists[value]
  if (eltSpec.match === 'reverse-word') return !!wordExists[value.split("").reverse().join("")]
  if (typeof eltSpec === 'string') return eltSpec.indexOf(value) !== -1
}

var patternCache = {};

function evaluatePatternOn(e, context, word){
  // console.log("Eval pat on", word, e.elements)
  var targetLen = word.length - 1
  var elements = e.elements;
  var elementLengths = elements.map(e => [e.minLength, Math.min(e.maxLength, targetLen)])
  // console.log("eltlens", elementLengths)

  var splits = splitWordInto(word, elementLengths)
  for (var i=0; i<splits.length;i++){
    var split = splits[i]
    var splitWorks = true
    for (var j=0; j<elements.length;j++){
      if (!elementMatches(elements[j], split[j])) {
        splitWorks = false
        break
      }
    }
    if (splitWorks){
      return true
    }
  }

  return false

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
