import PEG from 'pegjs'
import fs from 'fs'

var grammarSpec = fs.readFileSync(__dirname+'/../grammar.peg').toString()
var grammar = PEG.buildParser(grammarSpec)

var dictionaries = {
  ukacd: fs.readFileSync('dictionary/ukacd.txt').toString().split('\n')
}


export default function(queryExpression, dictionaryChoice){
  var dictionary = dictionaries[dictionaryChoice]

  var wordExists = dictionary.reduce((coll, w) => {
    coll[w] = true
    return coll
  }, {})


  var query = grammar.parse(queryExpression)
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
        if (words.length > MAX_WORDS)
          return words
      }
      }

      return words
      }

      function elementMatches(e, element, context, word){
        if (typeof element === 'string'){
          return  (word.length==1 && element.indexOf(word) !== -1)
        }
        if (element.match === 'anything') return true
          if (element.match === 'word') return !!wordExists[word]
            if (element.match === 'reverse-word') return !!wordExists[word.split("").reverse().join("")]
              if (element.type){
                var ret = evaluateQualifiedPattern(element, context, word+'$')
                return ret
              }
      }

      function applyFit(decision, fitList){
        var ret =  fitList.map(fits =>  fits.filter(f=>!overlap(f, decision)))
        return ret
      }


      function overlap(a, b){
        if (a[0] < b[0] && a[1] > b[0]) return true
          if (a[0] < b[1] && a[1] > b[1]) return true
            if (a[0] >= b[0] && a[1] <= b[1]) return true
              return false
      }

      function isValidSolution(word, ranges){
        var covered = word.split("").map(l => 0).slice(0,-1)
        for (var i=0; i<ranges.length; i++){
          for (var j=ranges[i][0]; j<ranges[i][1]; j++){
            covered[j]++
          }
          }

          for (var i=0;i<covered.length;i++){
            if (covered[i] !== 1){
              return false
            }
          }
          return true
          }

          function doConstraintPropagation(word, decided, undecided){

            undecided.sort((a,b)=>a.length - b.length)

            //console.log("Constraining", word, decided, decided.length, undecided, undecided.length)
            if (undecided.length === 0){
              return isValidSolution(word, decided)
            }

            if (undecided[0].length === 0) {
              return false // constrained down to zero options :(
            }

            for (var i=0;i<undecided[0].length;i++){
              var decision = undecided[0][i]
              var remaining = applyFit(decision, undecided.slice(1))
              var works = doConstraintPropagation(word, decided.concat([decision]), remaining)
              if (works) return works
            }

            return false

            }

            function alignElementsToWord(e, context, ranges, elements, word, count){
              if (elements.length === 0) return (word === '$')
                var maxElt = e.anagram ? elements.length : 1

              if (e.anagram && count == 0){
                if (elements.filter(a=>a.match==='anything').length > 0) {
                  var starless = elements.filter(a=>a.match !=='anything')
                  var gapSize = word.length - 1 - starless.reduce((sum, v)=>sum+(v.minLength ||1), 0)
                  var newElements = _.range(gapSize).map(v=>"abcdefghijklmnopqrstuvwxyz")
                  var newRanges = _.range(gapSize).map(v=>[1,1])
                  elements = elements.filter(a=>a.match !== 'anything').concat(newElements)
                  ranges = ranges.concat(newRanges)
                }
              }

              // first recursive step heuristics
              if (count === 0){
                //console.log("begin", word)

                if (e.qualifier.length[0] > word.length-1) {
                  return false
                }

                if (e.qualifier.length[1] < word.length-1) {
                  return false
                }

                //console.log("len check", word, e.minLength, e.maxLength, elements, ranges)
                if (e.maxLength === e.minLength){
                  if(word.length !== e.maxLength+1) return false
                }
              if (word.length - 1 > e.maxLength) return false
                if (word.length - 1 < e.minLength) return false

                  var fitLocations = [];

                  for (var i=0;i<elements.length;i++){
                    var goodFits = [];
                    fitLocations.push(goodFits);
                    var element = elements[i]
                    for (var j=0;j<word.length;j++){
                      for (var k=j; k<word.length; k++) {
                        var expectLength = 1;
                        if (element.maxLength && element.maxLength < (k-j)) break
                          if(elementMatches(e, element, context, word.slice(j,k))){
                            goodFits.push([j,k])
                          }
                      }
                      }
                      if (goodFits.length === 0) return false
                      }

                      if (e.anagram && count == 0){
                        return doConstraintPropagation(word, [], fitLocations)
                      }

                      }


                      for (var i=0; i<maxElt; i++){
                        var element = elements[i]

                        for (var j=ranges[i][0]; j <= ranges[i][1] && j < word.length ; j++){
                          //TODO accept misprints here, when they're enabled and when 'element' is a simple matcher
                          if (!elementMatches(e, element, context, word.slice(0,j))){
                            console.log("not at", element, i, ranges[i], word.slice(0,j), maxElt)
                            continue
                          }
                          if (alignElementsToWord(e,
                                                  context,
                                                ranges.slice(0,i).concat(ranges.slice(i+1)),
                                                elements.slice(0,i).concat(elements.slice(i+1)),
                                                word.slice(j), count+1)) {
                                                  console.log("yes", word)
                                                  return true
                                                }
                        }
                      }

                      return false
                      }

                      function evaluateSimplePattern(e, context, word){
                        return alignElementsToWord(e, context, e.ranges, e.elements, word, 0)
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


                      }

