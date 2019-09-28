const quoteDB = require('./quotes.json');
const quotes = quoteDB.quotes;
const categories = quoteDB.categories;
const AWS = require('aws-sdk');
const comprehend = new AWS.Comprehend({ apiVersion: '2017-11-27', region: 'us-east-1' });
require('fuzzyset.js');

exports.handler = async (event, context) => {
  //console.log(event.queryStringParameters);
  var response = {
    statusCode: 200,
    headers: {
      'content-type': 'application/json',
      "Access-Control-Allow-Origin": "*"
    }
  };
  question = event.queryStringParameters.question
  if (!question){
    question = event.body.question
  }
  if (!question) {
    response.statusCode = 400;
    response.body = JSON.stringify({ message: 'Question parameter is required' });
    return response;
  }
  try {
    //Await is used to wait while the promise executes
    aiQuotes = await nlpQuote(question);
    //console.log(aiQuotes);
    adviceFromDonald = aiQuotes[Math.floor(Math.random() * aiQuotes.length)];
    //console.log(adviceFromDonald);
    if (adviceFromDonald.rank == 0) {
      console.log("No ai matches, returning random quote");
    }
    response.body = JSON.stringify(adviceFromDonald);
    //console.log(response);
    return response;
  } catch (e) {
    response.statusCode = e.code;
    response.message = e.message;
    return response;
  }
};
/*
//async means the function can run asynchronously, allowing it to use await. However, every function in the chain must also be asynchronous
async function nlpQuote(question){
	const params = {
		LanguageCode: 'en',
		Text: question
	}
	//let "code" await=> the let code waits for the await code to work, in this case we detect key phrases
	//before giving them to keyPhrases. Generally assume that let and var are interchangeable, the main useful difference
	//being that let is "scoped"(=local) to the loop, whereas var stays in memory
	let keyPhrases=await comprehend.detectKeyPhrases(params)
	console.log(keyPhrases)
}

 //console.log(getRandomQuote());
 */

async function nlpQuote(question) {
  //slice -1 takes the last character, as it's shorthand for length-1
  if (question.slice(-1) != '?') {
    question += '?'
  }
  const params = {
    LanguageCode: 'en',
    Text: question
  }
  var result = await new Promise(function (resolve, reject) {
    comprehend.detectKeyPhrases(params, function (err, data) {
      if (err) {
        reject(err)
      }
      else {
        //resolve executes the .then, reject executes the .catch
        resolve(data)
      }
    })
  }).then(function (data) {
    //console.log(data)
    data.KeyPhrases.forEach(function (keyPhrase) {
      //split turns an array into a string, the " " is included to define the separator between elements of the array/string
      let keyWords = keyPhrase.Text.split(" ");
      let filtered = keyWords.filter(function (word) {
        //We're only choosing words that are not included in stopwords
        return !stopwords.includes(word.toLowerCase())
      })
      //join turns our string back into an array
      keyPhrase.Text = filtered.join(' ');
    })
    found = false;
    quotes.forEach(function (quoteObject) {
      quoteObject.rank = 0;
      let quote = quoteObject.quote.toLowerCase()
      //regexp is a Regular Expression, and allows one to search through a string
      //We're going through the KeyPhrases, turning the Text (which is an element of the KeyPHrases object) into lowercase,
      //then counting when it matches (the quote) and putting it in an array
      let quoteArray = quote.split(" ");
      let fuzzySet = FuzzySet();
      quoteArray.forEach(function (fuzz) {
        fuzzySet.add(fuzz)

      })
      data.KeyPhrases.forEach(function (keyPhrase) {
        let keyArray = keyPhrase.Text.split(' ');
        keyArray.forEach(function (key) {
          //console.log(key)
          let fuzzied = fuzzySet.get(key, null, .7);
          if (fuzzied) {
            found = true;
            fuzzied.forEach(function (match) {
              quoteObject.rank += match[0]
            })
          }
        })

				/*var rgxp = new RegExp(keyPhrase.Text.toLowerCase(), "g");
				//quote.match returns an array as .match always returns an array
				var matches=quote.match(rgxp);
				if (matches){
					//matches.length is the number of matches in the array
					quoteObject.rank+=matches.length
				}*/
      })
    })
    if (!found) {
      //console.log(categories);
      categories.forEach(function (category) {
        let categoryKeyWords = category.keywords
        category.rank = 0;
        let fuzzySet = FuzzySet()
        categoryKeyWords.forEach(function (categoryKeyWord) {
          fuzzySet.add(categoryKeyWord)
        })
        data.KeyPhrases.forEach(function (keyPhrase) {
          let keyArray = keyPhrase.Text.split(' ');
          keyArray.forEach(function (key) {

            let fuzzied = fuzzySet.get(key, null, .7);
            if (fuzzied) {
              fuzzied.forEach(function (match) {
                category.rank += match[0]
              })
            }
          })

        })

      })
      sortedCategories = categories.sort(function (a, b) {
        return b.rank - a.rank;
      })
      //console.log(sortedCategories[0]);
      if (sortedCategories[0].rank > 0) {
        quotes.forEach(function (quoteObject) {
          if (quoteObject.categories.includes(sortedCategories[0].name)) {
            quoteObject.rank++;
          }

        })
      }
    }
    //so lets say we get here and we still haven't found a match (we could set found=true above after "if (sortedCategories[0].rank > 0) {")
    //There's an extra category called SALAD, which has no key words, which I assigned to complete nonsense quotes.
    //So if we still don't have a matching quote, we could just...
    //iterate through our quotes again
      //and if quote.categories.includes("SALAD")
        //we just increment the rank of the quote
    //that's all. Then below the quotes will be sorted and filtered, and only those with the category salad will be returned
    //I'd suggest that we log this, with the question, to see what questions are not getting pertinent responses.


    /*	forEach (categories);{
        categories.rank=0;
        //create keyWords as individual words from keyPhrase
        let keyWords=keyPhrase.Text.split(" ");
        //fuzzyKeyWords is hopefully keyWords that match those in categories
        let fuzzyKeyWords=keyWords.match(categories);
        forEach (fuzzyKeyWords);{
          
        }
    
    
      	
      }
      */


		/*SUPPOSE we get here, and we didn't find a match (we could just put a variable before quotes.forEach that says "found=false" and then set it )
		to true when we get a match), then we might want to apply the categories, like this...*/
    //Just like the whole block above...
    //for each category
    //set the rank of the category to 0
    //create a fuzzyzet
    //for each word in the category (have a look at the quotes.json file)
    //add the word to the fuzzyset
    //for each keyword
    //split the keyword on " " (a space, in case the keyword is "white house")
    //for each keyword in the split array
    //get the fuzzy match (like above), and add its value to the rank of the category
    //Now our categories array each has a rank ranging from 0 to something (or zero to zero, in the case that we didn't find matching category)
    //we sort out category (as we do below)
    //Take the top category (categories[0]), and then
    //for each quote, if the category includes the name of the top category, up the rank of the quote by 1
    //then continue as below

    var sortedQuotes = quotes.sort(function (a, b) {
      //The way the ranking works is comparing two ranks via subtraction. Obviously, if the number is negative then the rank was inferior, postive means the rank was superior, 0 means equal ranks
      return b.rank - a.rank;
    })
    //console.log(sortedQuotes);
    var filteredQuotes = sortedQuotes.filter(function (quoteObject) {
      return quoteObject.rank >= sortedQuotes[0].rank;
    })
    return filteredQuotes;
  }).catch(function (err) {
    console.log(err)
  })
  return result;
}



const stopwords = [
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

exports.handler({ queryStringParameters: { question: 'Do you believe in Canada?' } });




/* for (cat in categories){
 let categoryKeyWords=categories[cat]
 console.log(cat, categoryKeyWords);
}
*/
