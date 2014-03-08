var async = require('async'),
	restify = require('restify'),
	_ = require('underscore');

var client = restify.createJsonClient({
	url: 'http://localhost:8080',
	version: '*'
});

var getFlattenedCategories = function (callback) {
	client.get('/categories', function(err, req, res, obj) {
		var categories = obj.results,
			flattenedCategories = [ ];
		Object.keys(categories).forEach(function (topCategoryKey) {
			Object.keys(categories[topCategoryKey]).forEach(function (secondLevelCategoryKey) {
				flattenedCategories.push({
					topLevel: topCategoryKey,
					secondLevel: secondLevelCategoryKey,
					url: categories[topCategoryKey][secondLevelCategoryKey].url
				});
			});
		});
		callback(null, flattenedCategories);
	});
};

var getUniqueProductsIdList = function (callback) {
	var productIds = [ ];
	console.log("Fetching the list of categories...");
	getFlattenedCategories(function (err, categories) {
		async.eachSeries(categories, function (category, callback) {
			console.log("Fetching the product ids in category: " + category.topLevel + " > " + category.secondLevel + "...");
			client.get('/list/' + encodeURIComponent(category.topLevel) + '/' + encodeURIComponent(category.secondLevel), function(err, req, res, obj) {
				productIds = _.uniq(productIds.concat(obj.results));
				console.log("Fetched " + obj.results.length + " ids. Found so far " + productIds.length + " unique ids.");
				callback(err);
			});
		}, function (err) {
			callback(err, productIds);
		});
	});
}

getUniqueProductsIdList(function (err, productIds) {
	// console.log(JSON.stringify(productIds));
});