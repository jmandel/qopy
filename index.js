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

var words = fs.readFileSync('dictionary/allwords.txt').toString().split('\n')
var wordExists = words.reduce((coll, w) => {
  coll[w] = true
  return coll
}, {})

console.log("Words loaded", words.length, tick())

var example = grammar.parse("12-: *<");

function evaluate(start){
  var context = {
    candidates: words.filter( w => w.length >= start.size[0] && w.length <= start.size[1])
  }
  return evaluateExpression(start.expression, context)
}

Array.prototype.flatMap = function(fn) {
  return Array.prototype.concat.apply([], this.map(fn));
}

/*
 * TODO:
 *  - figure out lead as NOT
 *  - figure out lead as ANAGRAM
 *  - figure out lead as LETTERBANK
 */


function evaluatePattern(e, context) {
  if (e.pattern && [undefined, '`', '?`'].indexOf(e.lead) !== -1 ){
    var ret = [];
    for (var i=0;i<context.candidates.length;i++){
      var matches = [[context.candidates[i]+'$', false]]
      for (var j=0; j<e.pattern.length; j++){
        var pattern = e.pattern[j]
        var newMatches = []
        for (var k=0; k<matches.length; k++){
          var match = matches[k][0]
          var misprinted = matches[k][1]

          if (typeof pattern === 'string'){
            var nextCharCorrect = pattern.indexOf(match[0]) !== -1
            var newMatch = match.slice(1)
            if (nextCharCorrect){
              newMatches.push([newMatch, misprinted])
            } else if (!misprinted && !nextCharCorrect){
              newMatches.push([newMatch, true])
            }
          } else if (typeof pattern ==='object' && pattern[0] === 'anything') {
            if 
            for (var l=0;l<match.length;l++){
              newMatches.push([match.slice(l), misprinted])
            }
          } else if (typeof pattern ==='object' && pattern[0] === 'word') {
            for (var l=0;l<match.length;l++){
              if (wordExists[match.slice(0, l)]) {
                newMatches.push([match.slice(l), misprinted])
              }
            }
          } else if (typeof pattern ==='object' && pattern[0] === 'reverse-word') {
            for (var l=0;l<match.length;l++){
              if (wordExists[match.slice(0, l).split("").reverse().join("")]) {
                newMatches.push([match.slice(l), misprinted])
              }
            }
          }
        }
        matches = newMatches
        if (matches.length === 0) break
      }
      var wordCounts = false;
      for (var j=0;j<matches.length;j++){
        if (matches[j][0] === '$' && (
            (e.lead === undefined && matches[j][1] === false) ||
            (e.lead === '`' && matches[j][1] === true) ||
             e.lead === '?`')){
          ret.push(context.candidates[i])
          break
        }
      }
    }
    return ret
  }

}

function evaluateExpression(e, context){
  var words;
  if (e.pattern){
    words = evaluatePattern(e, context)
  } else if (e.op === 'and'){
    var words = context.candidates
    for (var i=0;i<e.args.length;i++){
      var subExpr =e.args[i]
      words = evaluateExpression(subExpr, Object.assign({}, context, {candidates: words}))
    }
  } else if (e.op === 'or'){
    var words = []
    for (var i=0;i<e.args.length;i++){
      var subExpr =e.args[i]
      words = words.concat(evaluateExpression(subExpr, context))
    }
  } else if (e.op === 'not'){
    var nonWords = evaluateExpression(e.args[0], context)
    var nonWordsObj = {}
    for (var i=0;i<nonWords.length; i++){
      nonWordsObj[nonWords[i]] = true
    }

    var words = []
    for (var i=0;i<context.candidates.length;i++){
      var word = context.candidates[i]
      if (nonWordsObj[word] === undefined){
        words.push(word)
      }
    }
  }

  console.log("Matching words", words, words.length, tick());
  return words


}

evaluate(example)

try {
  console.log(JSON.stringify(example, null, 2))
} catch (e) {
  console.log(e.message, '\n', JSON.stringify(e.location, null, 2))
}
