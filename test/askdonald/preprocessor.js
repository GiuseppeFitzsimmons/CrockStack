const nlpDonald=require("./nlpdonald");
const quotes=require("./quotes.json");
const fs=require('fs');

function preprocess() {
    var _keywords=[];
    quotes.forEach(function(quote){
        var analysed=nlpDonald.analyze(quote.quote);
        _keywords=[..._keywords,...analysed.sentenceObjects,...analysed.sentenceSubjects];
    })
    console.log(_keywords);
    writeProcessFile(_keywords);
}
function writeProcessFile(keywords) {
    if (fs.existsSync('processed.json')) {
        fs.unlinkSync('processed.json')
      }
    fs.writeFile("processed.json", JSON.stringify(keywords), function(err) {
        if(err) {
            return console.log(err);
        }
    
        console.log("The file was written");
    }); 
} 

preprocess();