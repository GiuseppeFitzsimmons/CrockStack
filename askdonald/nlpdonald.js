//import * as Fin from "finnlp";
const processedQuotes=require('./processed.json')
const Fin=require('finnlp');
require ('fin-emphasis');
require ('fin-sentence-type');
module.exports={
	analyze:function (question){
		var returnObject={}
		let processed = new Fin.Run(question);
		console.log(JSON.stringify(processed));
		returnObject.roots=processed.sentences[0].depsTree.tokens;
		//console.log(JSON.stringify(processed.sentences[0].depsTree))
		
		var type=processed.sentenceType()[0];
		//console.log(type[0].type);
		returnObject.type=type[0].type
		returnObject.sentenceObjects=[];
		returnObject.sentenceSubjects=[];
		returnObject.sentenceAdjectives=[];
		//processed.sentences[0].deps.forEach(dep=>{
		foundroot=false;
		for(i=0;i<processed.sentences[0].deps.length;i++){
			dep=processed.sentences[0].deps[i]
			//console.log(dep.label)
			//foundroot has no ==true because defaults to checking whether true or existing
			if ( (dep.label=='DOBJ'||dep.label=='IOBJ'||dep.label=='OBL') /*&& foundroot*/)
			{
				console.log('LABEL',dep.label,processed.sentences[0].tokens[i]);
				//console.log(processed.sentences[0].tokens[i], dep.label)
				returnObject.sentenceObjects.push(processed.sentences[0].tokens[i])
				for(j=i-1;j>0;j--){
					//If the index position of JJ is -1 then there is no JJ
					if (processed.sentences[0].tags[j].indexOf('JJ')>-1){
						returnObject.sentenceAdjectives.push(processed.sentences[0].tokens[j])
					} else {
						break;
					}
				}
			}
			if (dep.label=='NSUBJ'||dep.label=='NSUBJPASS')
			{
				returnObject.sentenceSubjects.push(processed.sentences[0].tokens[i])
				for(j=i-1;j>0;j--){
					//If the index position of JJ is -1 then there is no JJ
					if (processed.sentences[0].tags[j].indexOf('JJ')>-1){
						returnObject.sentenceAdjectives.push(processed.sentences[0].tokens[j])
					} else {
						break;
					}
				}				
			}
			if (dep.label=='ROOT'){
				foundroot=true
			}
		}
		returnObject.donaldKeys=[]
		processed.sentences[0].tokens.forEach(function(token){
			if (processedQuotes.includes(token)){
				returnObject.donaldKeys.push(token)
			}
		})
		
		console.log(returnObject)
		returnObject.sentenceObjects=returnObject.sentenceObjects.filter(word=>{
			return !stopwords.includes(word);
		})
		returnObject.sentenceSubjects=returnObject.sentenceSubjects.filter(word=>{
			return !stopwords.includes(word);
		})
		
		
		return returnObject
		
	}
}
const stopwords=[
  'about', 'after', 'all', 'also', 'am', 'an', 'and', 'another', 'any', 'are', 'as', 'at', 'be',
  'because', 'been', 'before', 'being', 'between', 'both', 'but', 'by', 'came', 'can',
  'come', 'could', 'did', 'do', 'each', 'for', 'from', 'get', 'got', 'has', 'had',
  'he', 'have', 'her', 'here', 'him', 'himself', 'his', 'how', 'if', 'in', 'into',
  'is', 'it', 'like', 'make', 'many', 'me', 'might', 'more', 'most', 'much', 'must',
  'my', 'never', 'now', 'of', 'on', 'only', 'or', 'other', 'our', 'out', 'over',
  'said', 'same', 'see', 'should', 'since', 'some', 'still', 'such', 'take', 'than',
  'that', 'the', 'their', 'them', 'then', 'there', 'these', 'they', 'this', 'those',
  'through', 'to', 'too', 'under', 'up', 'very', 'was', 'way', 'we', 'well', 'were',
  'what', 'where', 'which', 'while', 'who', 'with', 'would', 'you', 'your', 'a', 'i', 'I']
  

//module.exports.analyze('What does the black cat think about fat white people')


//const result = processed.emphasis();
//console.log(result);
/*export default {
	analyze:function(Question){
		var returnObject={intent:'The intent'}
		return returnObject
	}
}
*/