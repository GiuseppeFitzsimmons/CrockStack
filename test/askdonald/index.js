/*
AskDonald is the NLP Donald Trump quote engine for WhatWouldDonaldDo (whatwoulddododo.com)
*/

const quoteDB = require('./quotes.json');
const quotes = quoteDB.quotes;
const categories = quoteDB.categories;
const AWS = require('aws-sdk');
const comprehend = new AWS.Comprehend({ apiVersion: '2017-11-27', region: 'us-east-1' });
require('fuzzyset.js');

exports.handler = async (event, context) => {
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

      })
    })
    if (!found) {
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
    var sortedQuotes = quotes.sort(function (a, b) {
      //The way the ranking works is comparing two ranks via subtraction. Obviously, if the number is negative then the rank was inferior, postive means the rank was superior, 0 means equal ranks
      return b.rank - a.rank;
    })
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

