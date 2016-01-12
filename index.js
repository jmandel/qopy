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

var words = fs.readFileSync('allwords2.txt').toString().split('\n')
console.log("Words loaded", words.length, tick())

var example = grammar.parse("batm..");

try {
  console.log(JSON.stringify(example, null, 2))
} catch (e) {
  console.log(e.message, '\n', JSON.stringify(e.location, null, 2))
}
