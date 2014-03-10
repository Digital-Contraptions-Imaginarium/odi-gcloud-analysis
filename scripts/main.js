var argv = require("optimist")
		.usage('Usage: $0 <search keyword> [<search keyword ...>]wor --out <output CSV filename> [--tl <max no. of list requests to server per hour>] [--td <max no. of product details requests to server per hour>] [--quiet]')
		.demand([ "out" ])
		.alias("out", "o")
		.alias("quiet", "q")
		.default("tl", 300)	
		.default("td", 150)	
		.argv,
	async = require('async'),
	cheerio = require('cheerio'),
	csv = require('csv'),
	fs = require('fs'),
	request = require('request'),
	RateLimiter = require('limiter').RateLimiter,
	// note that the version of underscore I am using is the latest specified
	// as compatible by underscore.string at the moment of writing
	_ = require('underscore'),
	_str = require('underscore.string');
_.mixin(_str.exports());

var PRODUCT_FETCH_THROTTLING = new RateLimiter(1, Math.floor(3600000 / parseInt(argv.td))),
	LIST_FETCH_THROTTLING = new RateLimiter(1, Math.floor(3600000 / parseInt(argv.tl)));

var log = !argv.quiet ? function (s) {
		    var entryDate = new Date();
		    console.log(entryDate.getFullYear() + "/" + (entryDate.getMonth() < 9 ? '0' : '') + (entryDate.getMonth() + 1) + "/" + (entryDate.getDate() < 10 ? '0' : '') + entryDate.getDate() + " " + (entryDate.getHours() < 10 ? '0' : '') + entryDate.getHours() + ":" + (entryDate.getMinutes() < 10 ? '0' : '') + entryDate.getMinutes() + ":" + (entryDate.getSeconds() < 10 ? '0' : '') + entryDate.getSeconds() + " - " + s);
		} : function () { };

var fetchProductById = function (productId, callback) {
	PRODUCT_FETCH_THROTTLING.removeTokens(1, function() {
		request('http://govstore.service.gov.uk/cloudstore/' + productId, function (error, response, html) {
			var product = null;
			if (error || response.statusCode !== 200) {
				console.error("Error fetching http://govstore.service.gov.uk/cloudstore/" + productId + " . Aborting.");
				process.exit(1);
			}
			var $ = cheerio.load(html);
			product = { id: productId, details: { }, supplier: { }, docs: { } };
			product.name = _.trim($('#product_addtocart_form div.product-shop.grid12-7 div.product-name h1').text());
			// note that the reg exp below's objective is just to extract 
			// value off the clutter, not to get a valid, parseable number
			product.pricing = $('span.price').text().match(/£([\d,.]*)/)[1];
			product.sku = _.trim($('#product_addtocart_form div.product-shop.grid12-7 div.product-sku').text().split('Service ID: ')[1]);
			product.supplier.name = _.trim($('#product_addtocart_form div.product-shop.grid12-7 div.from-supplier').text().split('From: ')[1]);
			product.description = _.trim($('#short-desc').text());
			$('#full-attributes-table tr').each(function (i, element) {
				if (!$(this).hasClass('details-tr')) {
					product.details[$('th', this).text()] = _.trim($('td', this).text());
				}
			});
			$('#product_addtocart_form div.grid12-9 div.supplier-info-block table tr').each(function (i, element) {
				product.supplier[$('td', this).eq(0).text()] = _.trim($('td', this).eq(1).text());
			});
			// does the code below breaks if more documents have the same 
			// name?
			$('#product_addtocart_form div.grid12-9 ul li').each(function (i, element) {
				product.docs[$('a', this).text()] = _.trim($('a', this).attr('href'));
			});
			callback(error, product);
		});
	});
}

var fullTextSearchPage = function (encodedSearchText, pageNo, callback) {
	LIST_FETCH_THROTTLING.removeTokens(1, function () {
		// note, I have demonstrated experimentally that the call below can 
		// return duplicate results!
		request('http://govstore.service.gov.uk/cloudstore/search/?p=' + pageNo + '&q=' + encodedSearchText, function (error, response, html) {
			if (error || response.statusCode !== 200) {
				console.log("Error fetching http://govstore.service.gov.uk/cloudstore/search/?p=" + pageNo + "&q=" + encodedSearchText + " . Aborting.");
				process.exit(1);
			}
			var $ = cheerio.load(html),
				productIds = [ ];
			$('#products-list li').each(function (i, element) {
				var temp = $('h2.product-name a', this).attr('href');
				if (temp){
					productIds.push(temp.match(/[^\/]+$/)[0]);
				}
			});
			callback(null, _.uniq(productIds));
		});
	});
}

var fullTextSearch = function (searchKeywordsArray, callback) {
	searchKeywordsArray = [ ].concat(searchKeywordsArray || [ ]);
	searchKeywordsArray = searchKeywordsArray.map(function (keyword) { return '"' + keyword + '"'; });
	LIST_FETCH_THROTTLING.removeTokens(1, function () {
		var encodedSearchText = encodeURIComponent(searchKeywordsArray.join("+or+"));
		// note, I have demonstrated experimentally that the call below can 
		// return duplicate results!
		request('http://govstore.service.gov.uk/cloudstore/search/?q=' + encodedSearchText, function (error, response, html) {
			if (error || response.statusCode !== 200) {
				console.log("Error fetching http://govstore.service.gov.uk/cloudstore/search/?q=" + encodedSearchText + " . Aborting.");
				process.exit(1);
			}
			var $ = cheerio.load(html),
				temp = $('#solr_search_result_page_container div.category-products div.toolbar div p').text().match(/Items (\d+) to (\d+) of (\d+)/),
				pageSize = parseInt(temp[2]) - parseInt(temp[1]) + 1,
				noOfPages = Math.ceil(parseInt(temp[3]) / pageSize);
			// note, async.reduce works in series over the input, hence is 
			// suitable for the underlying throttling
			async.reduce(_.range(1, noOfPages + 1), [ ], function (memo, pageNo, callback) {
				fullTextSearchPage(encodedSearchText, pageNo, function (err, results) {
					callback(err, _.uniq(memo.concat(results)));
				});
			}, callback);
		});
	});
};

var dump = function (searchKeywordsArray, outputFilename, callback) {
	log("Fetching the full list of product ids matching the specified search terms...");
	fullTextSearch(searchKeywordsArray, function (err, productIds) {
		log("Completed.");
		log("Fetching product detail data for product id...");
		async.mapSeries(productIds, function (id, callback) {
			log("... " + id);
			fetchProductById(id, function (err, product) {
				// this loop "flattens" the hierarchical structure of the record
				[ "details", "supplier", "docs" ].forEach(function (groupName) {
					Object.keys(product[groupName]).forEach(function (key) {
						product[groupName + " - " + key] = product[groupName][key];
					});
					delete product[groupName];
				});
				callback(null, product);
			});
		}, function (err, products) {
			csv()
				.from.array(products)
				.to.stream(fs.createWriteStream(outputFilename), {
						header: true,
						// the line below identifies all possible column names
						// as the union of the defined keys of each product
						columns: _.union(_.flatten(_.map(products, function (product) { return _.keys(product); }))).sort()
					})
				.on('close', function (count) {
					log('Writing completed. Number of records processed: ' + count);
					callback(null);
				})
				.on('error', function (error) {
					log(error.message);
				});
		});
	});	
}

/*
fetchProductById("product id health-and-safety-risk-assessment-13313", function (err, product) {
	console.log(product);
});
dump(argv._, argv.out, function () { });
*/
var searchKeywordsArray = [ "open data" ].concat(searchKeywordsArray || [ ]);
searchKeywordsArray = searchKeywordsArray.map(function (keyword) { return '"' + keyword + '"'; });
fullTextSearchPage(searchKeywordsArray, 1, function (err, productIds) {
	console.log(productIds.join("\n"));
});