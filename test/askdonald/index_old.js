const quotes = require('./quotes.json');
const keywordExtractor = require('keyword-extractor');
const NlpAnalyzer=require('./nlpdonald');
//import NlpAnalyzer from 'nlpdonald';
exports.handler = async (event, context) => {
  console.log(event.queryStringParameters);
  var response = {
    statusCode: 200,
    headers: { 
      'content-type': 'application/json',
      "Access-Control-Allow-Origin": "*"
    }
  };
  if (!event.queryStringParameters || !event.queryStringParameters.question ||event.queryStringParameters.question=='') {
    response.statusCode = 400;
    response.body = JSON.stringify({ message: 'Question parameter is required' });
    return response;
  }
  try {
    aiQuotes=analyze(event.queryStringParameters.question);
    adviceFromDonald=aiQuotes[Math.floor(Math.random() * aiQuotes.length)];
    console.log(adviceFromDonald);
    if (adviceFromDonald.rank==0) {
      console.log("No ai matches, returning random quote");
      adviceFromDonald=getRandomQuote();
    }
    response.body = JSON.stringify(adviceFromDonald);
    return response;
  } catch (e) {
    response.statusCode = e.code;
    response.message = e.message;
    return response;
  }
};

function analyze(question){
	var analyzed=NlpAnalyzer.analyze(question);
	//console.log(analyzed);
	
  var aiquotes=[...quotes];
  aiquotes.forEach(q=>{
    q.rank=0;
    quote=q.quote.toLowerCase();
    analyzed.sentenceSubjects.forEach(word=>{
      var rgxp = new RegExp(word.toLowerCase(), "g");
      var matches=quote.toLowerCase().match(rgxp);
      if (matches) {
        q.rank+=matches.length+1;
      }
    })
  });
  aiquotes.forEach(q=>{
    quote=q.quote.toLowerCase();
    analyzed.sentenceObjects.forEach(word=>{
      var rgxp = new RegExp(word.toLowerCase(), "g");
      var matches=quote.toLowerCase().match(rgxp);
      if (matches) {
        q.rank+=matches.length+1;
      }
    })	
  });
  aiquotes.forEach(q=>{
    quote=q.quote.toLowerCase();
    analyzed.sentenceAdjectives.forEach(word=>{
      var rgxp = new RegExp(word.toLowerCase(), "g");
      var matches=quote.toLowerCase().match(rgxp);
      if (matches) {
        q.rank+=matches.length;
      }
    })	
  });
 aiquotes.forEach(function(q){
	 quote=q.quote.toLowerCase();
	 analyzed.donaldKeys.forEach(function(word){
		var rgxp = new RegExp(word.toLowerCase(), "g");
		var matches=quote.toLowerCase().match(rgxp);
		//match returns an array, no need to re-declare with []
		if (matches){
			q.rank+=matches.length;
		}
	 })
 })
  aiquotes=aiquotes.sort((a,b)=>{
    return b.rank-a.rank;
  })
  //console.log(quotes);
  var toprank=aiquotes[0].rank;
  //console.log(aiquotes[0])
  aiquotes=aiquotes.filter(q=>{
    return q.rank==toprank;
  })
  //console.log(aiquotes);
  return aiquotes;
  
}


function getRandomQuote() {
  return quotes[Math.floor(Math.random() * quotes.length)];
}
function getAiQuote(question) {
  var extraction_result = keywordExtractor.extract(question, {
    language: "english",
    remove_digits: true,
    return_changed_case: true,
    remove_duplicates: false

  });
  //Faking it up a bit
  if (question.indexOf('What would')>-1 || question.indexOf('What should')>-1 || question.indexOf('What will')>-1) {
    extraction_result.push("I will");
    extraction_result.push("I would");
    extraction_result.push("I could");
    extraction_result.push("We will");
    extraction_result.push("We would");
    extraction_result.push("I should");
  }
  console.log(extraction_result);
  aiquotes=aiquotes.sort((a,b)=>{
    return b.rank-a.rank;
  })
  //console.log(quotes);
  var toprank=aiquotes[0].rank;
  //console.log(aiquotes[0])
  aiquotes=aiquotes.filter(q=>{
    return q.rank==toprank;
  })
  //console.log(aiquotes);
  return aiquotes;
}
  //console.log(getRandomQuote());
  exports.handler({queryStringParameters:{question:'Where did you go to school'}});