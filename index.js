import PEG from 'pegjs'
import fs from 'fs'

var grammarSpec = fs.readFileSync('grammar.peg').toString()

var ticks = [new Date().getTime()]
function tick(){
  ticks.push(new Date().getTime())
  return (ticks.slice(-1)[0] - ticks.slice(-2)[0])
}

var grammar = PEG.buildParser(grammarSpec)
console.log("Grammer built", tick())

var words = fs.readFileSync('dictionary/allwords.txt').toString().split('\n')
var wordExists = words.reduce((coll, w) => {
  coll[w] = true
  return coll
}, {})

console.log("Words loaded", words.length, tick())

var example = grammar.parse("swor.");

function evaluate(start){
  var context = {
    candidates: words.filter( w => w.length >= start.size[0] && w.length <= start.size[1])
  }
  return evaluateExpression(start.expression, context)
}

Array.prototype.flatMap = function(fn) {
  return Array.prototype.concat.apply([], this.map(fn));
}

function matchesPattern(p){
  return function(word){

    word += "$"
    var firstWord = {}
    firstWord[word] = true

    return p.reduce((matches, subpattern) => {
      return Object.keys(matches).flatMap(matchword => {
        switch (typeof subpattern) {
          case 'string':
              if (matchword.match(RegExp('^[' + subpattern+']'))){
                return [matchword.slice(1)]
              }
              return []
              break;
          default:
              return []
        }
      }).reduce((coll, word)=>{
        coll[word] = true
        return coll
      }, {})
    }, firstWord)['$'] == true
  }
}

function evaluateExpression(e, context){
  if (e.pattern) {
    // var ret =  context.candidates.filter(matchesPattern(e.pattern))
    var ret = [];
    for (var i=0;i<context.candidates.length;i++){
      var matches = [context.candidates[i]+'$']
      for (var j=0; j<e.pattern.length; j++){
        var pattern = e.pattern[j]
        var newMatches = []
        for (var k=0; k<matches.length; k++){
          var match = matches[k]
          if (typeof pattern === 'string' && pattern.indexOf(match[0]) > -1){
            var newMatch = match.slice(1)
            newMatches.push(newMatch)
          } else if (typeof pattern ==='object' && pattern[0] === 'anything') {
            for (var l=0;l<match.length;l++){
              newMatches.push(match.slice(l))
            }
          } else if (typeof pattern ==='object' && pattern[0] === 'word') {
            for (var l=0;l<match.length;l++){
              if (wordExists[match.slice(0, l)]) {
                newMatches.push(match.slice(l))
              }
            }
          } else if (typeof pattern ==='object' && pattern[0] === 'reverse-word') {
            for (var l=0;l<match.length;l++){
              if (wordExists[match.slice(0, l).split("").reverse().join("")]) {
                newMatches.push(match.slice(l))
              }
            }
          }
        }
        matches = newMatches
        if (matches.length === 0) break
      }
      if (matches.indexOf('$') !== -1) ret.push(context.candidates[i])
    }
    console.log("Matching words", ret, tick());
    return ret
  }
}

evaluate(example)

try {
  console.log(JSON.stringify(example, null, 2))
} catch (e) {
  console.log(e.message, '\n', JSON.stringify(e.location, null, 2))
}
