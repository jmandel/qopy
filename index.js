/*
 * TODO:
 *  - re-sort dictionary by word LENGTH
 *  - implement timeout after 1k words (configurable)
 */

import PEG from 'pegjs'
import fs from 'fs'

var grammarSpec = fs.readFileSync('grammar.peg').toString()

var ticks = [new Date().getTime()]
function tick(){
  ticks.push(new Date().getTime())
  return ticks.slice(1).map((tickTime, i)=>tickTime - ticks[i])
}

var grammar = PEG.buildParser(grammarSpec)
console.log("Grammer built", tick())

var words = fs.readFileSync('dictionary/ukacd.txt').toString().split('\n')
var wordExists = words.reduce((coll, w) => {
  coll[w] = true
  return coll
}, {})

console.log("Words loaded", words.length, tick())

var example = grammar.parse("9:.<.")

try {
  console.log(JSON.stringify(example, null, 2))
} catch (e) {
  console.log(e.message, '\n', JSON.stringify(e.location, null, 2))
}

function evaluate(start){
  var context = {
    candidates: words.filter( w => w.length >= start.size[0] && w.length <= start.size[1])
  }
  return evaluateExpression(start.expression, context)
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


function evaluatePatternOn(e, word){
  if (e.lead === '*/') {
    if (word[0] === '$') return true
  }

  if (e.pattern.length === 0){
    var isMatch = (word[0] === '$')
    var isMisprint = word[1]
    return (isMatch && (
             (e.lead === undefined && !isMisprint) ||
             (e.lead === '/' && !isMisprint) ||
             (e.lead === '`' && isMisprint) ||
              e.lead === '?`'))
  }

  var choicesFn = {
    '/': anagramChoicesFrom,
    '*/': letterbankChoicesFrom
  }[e.lead] || choicesFrom

  var choices = choicesFn(e, word)
  for (var i=0;i<choices.length;i++){
    if (evaluatePatternOn(choices[i].nexte, choices[i].word)){
      return true
    }
  }
  return false
}

function evaluateWord(e, word){
  var ret = false;
  if (e.pattern) {
    ret = evaluatePatternOn(e, [word, false]);
  } else if (e.op === 'not'){
    ret = !evaluateWord(e.args[0], word)
    //console.log("Not convered", word, ret)
  } else if (e.op === 'or') {
    for (var i=0; i< e.args.length;i++){
      ret = evaluateWord(e.args[i], word)
      if (ret) break
    }
  } else if (e.op === 'and') {
    for (var i=0; i< e.args.length;i++){
      ret = evaluateWord(e.args[i], word)
      if (!ret) break
    }
  } else {
    throw "Unrecognized " + e
  }
  return ret
}

function evaluateExpression(e, context){
  var words = []

  if (e.lead === '/' || e.lead === '*/'){
    var hasStar = e.pattern.filter(p => p[0] === 'anything').length > 0
    if (hasStar) {
      e.pattern = e.pattern.filter(p => p[0] !== 'anything')
      e.pattern.push(['anything'])
    }
  }

  for (var i=0;i<context.candidates.length;i++){
    var word = context.candidates[i]
    //console.log("so gonna wordl", word)
    if (evaluateWord(e, word+'$')) {
      words.push(word)
    }
  }
  return words
}

var results = evaluate(example)
console.log("Matching words", results, results.length, tick());
