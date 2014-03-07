var async = require('async'),
	cheerio = require('cheerio'),
	request = require('request'),
	restify = require('restify');

/*
var client = restify.createJsonClient({
	url: 'http://localhost:8080',
	version: '*'
});

client.get('/id/' + 'agilisys-digital-platform', function(err, req, res, obj) {
	console.log(obj);
});
*/

var fetchTopCategories = function (callback) {
	request('http://govstore.service.gov.uk/cloudstore/', function (error, response, html) {
		if (error || response.statusCode != 200) {
			console.log("Error fetching the top categories. Exiting...");
			process.exit(1);
		}
		var $ = cheerio.load(html),
			categories = [ ];
		$('#nav li.level0').each(function (i, element) {
			categories.push({
				name: $('a', this).eq(0).text().replace(/\n/g, ''),
				url: $('a', this).eq(0).attr('href')
			});
		});
		callback(null, categories);
	});
}

var fetchAllCategories = function (callback) {
	fetchTopCategories(function (err, topCategories) {
		async.reduce(topCategories, [ ], function (memo, topCategory, callback) {
			request(topCategory.url, function (error, response, html) {
				var categories = [ ];
				if (error || response.statusCode != 200) {
					console.log("Error fetching the complete list of categories. Exiting...");
					process.exit(1);
				}
				var $ = cheerio.load(html);
				$('#narrow-by-list2 dd ol li').each(function (i, element) {
					categories.push({
						topLevel: topCategory.name,
						secondLevel: $('a', this).text(),
						url: $('a', this).attr('href')
					})
				});
				callback(null, memo.concat(categories));
			});
		}, callback);	
	});
}

fetchAllCategories(function (err, categories) {
	console.log(categories);
})