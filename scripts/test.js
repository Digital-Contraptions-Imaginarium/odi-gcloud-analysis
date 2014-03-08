var restify = require('restify');

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
					firstLevel: topCategoryKey,
					secondLevel: secondLevelCategoryKey,
					url: categories[topCategoryKey][secondLevelCategoryKey].url
				});
			});
		});
		callback(null, flattenedCategories);
	});
}


