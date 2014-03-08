var async = require('async'),
	cheerio = require('cheerio'),
	request = require('request'),
	RateLimiter = require('limiter').RateLimiter,
	restify = require('restify');

var PRODUCT_FETCH_THROTTLING = new RateLimiter(150, 'hour');

var categories = null,
	server = restify.createServer({
		name: 'odi-gcloud-proxy',
	});

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
var fetchProductByFullIdentifier = function (fullIdentifier, callback) {
	PRODUCT_FETCH_THROTTLING.removeTokens(1, function() {
		request('http://govstore.service.gov.uk/cloudstore/' + fullIdentifier, function (error, response, html) {
			var product = null;
			if (!error && response.statusCode == 200) {
				var $ = cheerio.load(html);
				product = { details: { }, supplier: { }, docs: { } };
				product.name = $('#product_addtocart_form div.product-shop.grid12-7 div.product-name h1').text();
				product.sku = $('#product_addtocart_form div.product-shop.grid12-7 div.product-sku').text().split('Service ID: ')[1];
				product.supplier.name = $('#product_addtocart_form div.product-shop.grid12-7 div.from-supplier').text().split('From: ')[1];
				product.description = $('#short-desc').text();
				$('#full-attributes-table tr').each(function (i, element) {
					if (!$(this).hasClass('details-tr')) {
						product.details[$('th', this).text()] = $('td', this).text();
					}
				});
				$('#product_addtocart_form div.grid12-9 div.supplier-info-block table tr').each(function (i, element) {
					product.supplier[$('td', this).eq(0).text()] = $('td', this).eq(1).text();
				});
				$('#product_addtocart_form div.grid12-9 ul li').each(function (i, element) {
					product.docs[$('a', this).text()] = $('a', this).attr('href');
				});
			} 
			callback(error, product);
		});
	});
}

server.get('/id/:id', function (req, res, next) {
	fetchProductByFullIdentifier(req.params.id, function (err, product) {
		res.send({ results: [ product ] });
		next();
	});
});

server.get('/search/:searchString', function (req, res, next) {
	// TODO: need to support multiple pages of results
	request('http://govstore.service.gov.uk/cloudstore/search/?q=' + req.params.searchString, function (error, response, html) {
		if (!error && response.statusCode == 200) {
			var $ = cheerio.load(html),
				fullIdentifiers = [ ];
			$('.product-shop-inner').each(function (i, element) {
				fullIdentifiers.push($('.desc.std strong a', this).attr('href').split("http://govstore.service.gov.uk/cloudstore/")[1]);
			});
			async.map(fullIdentifiers, function (fullIdentifier, callback) {
				fetchProductByFullIdentifier(fullIdentifier, function(err, product) {
					callback(null, product);
				});
			}, function (err, products) {
				res.send({ results: products });
				next();
			});
		}
	});
});

server.get('/categories', function (req, res, next) {
	var respond = function () {
		res.send(categories);
		next();		
	};
	if (!categories) {
		fetchAllCategories(function (err, c) {
			categories = { cached: new Date(), results: c };
			respond();
		});
	} else {
		respond();
	}
});

server.listen(8080);

