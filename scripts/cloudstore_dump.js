var argv = require("optimist")
		.usage('Usage: $0 <search keyword> [<search keyword ...>] --out <output CSV filename> [--cache <caching folder path>] [--total] [--tl <max no. of list requests to server per hour>] [--td <max no. of product details requests to server per hour>] [--quiet]')
		.demand([ "out" ])
		.alias("cache", "c")
		.alias("out", "o")
		.alias("quiet", "q")
		.default("tl", 360)	
		.default("td", 120)	
		.argv,
	async = require('async'),
	cheerio = require('cheerio'),
	csv = require('csv'),
	fs = require('fs'),
	path = require('path'),
	request = require('request'),
	RateLimiter = require('limiter').RateLimiter,
	// note that the version of underscore I am using is the latest specified
	// as compatible by underscore.string at the moment of writing
	_ = require('underscore'),
	_str = require('underscore.string');
_.mixin(_str.exports());

var FIELDS_RENAME_MAP = [
	{ from: "Do you company with the Government Open Standards Principles (see: http://www.cabinetoffice.gov.uk/openstandards)?",
	  to: "government_open_standards_compliant" }
]

var PRODUCT_FETCH_THROTTLING = new RateLimiter(1, Math.floor(3600000 / parseInt(argv.td))),
	LIST_FETCH_THROTTLING = new RateLimiter(1, Math.floor(3600000 / parseInt(argv.tl)));

var log = !argv.quiet ? function (s) {
		    var entryDate = new Date();
		    console.log(entryDate.getFullYear() + "/" + (entryDate.getMonth() < 9 ? '0' : '') + (entryDate.getMonth() + 1) + "/" + (entryDate.getDate() < 10 ? '0' : '') + entryDate.getDate() + " " + (entryDate.getHours() < 10 ? '0' : '') + entryDate.getHours() + ":" + (entryDate.getMinutes() < 10 ? '0' : '') + entryDate.getMinutes() + ":" + (entryDate.getSeconds() < 10 ? '0' : '') + entryDate.getSeconds() + " - " + s);
		} : function () { };

var fetchProductById = function (productId, callback) {

	var columnRename = function (fieldName) {
		fieldName = _.trim(fieldName);
		var fieldReplacement = _.find(FIELDS_RENAME_MAP, function (rule) { return rule.from === fieldName; });
		return fieldReplacement ? fieldReplacement.to : _.underscored(fieldName.replace(/[^\w ]/g, "").toLowerCase());
	}

	if (argv.cache && fs.existsSync(path.join(argv.cache, productId + ".json"))) {
		callback(null, JSON.parse(fs.readFileSync(path.join(argv.cache, productId + ".json"))));
	} else {
		PRODUCT_FETCH_THROTTLING.removeTokens(1, function() {
			request('http://govstore.service.gov.uk/cloudstore/' + productId, function (error, response, html) {
				var product = null;
				if (error || response.statusCode !== 200) {
					console.error("Error fetching http://govstore.service.gov.uk/cloudstore/" + productId + " . Aborting.");
					console.error(error);
					callback(error, null);
				} else {
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
							product.details[columnRename($('th', this).text())] = _.trim($('td', this).text());
						}
					});
					$('#product_addtocart_form div.grid12-9 div.supplier-info-block table tr').each(function (i, element) {
						product.supplier[columnRename($('td', this).eq(0).text())] = _.trim($('td', this).eq(1).text());
					});
					// does the code below breaks if more documents have the same 
					// name?
					$('#product_addtocart_form div.grid12-9 ul li').each(function (i, element) {
						product.docs[columnRename($('a', this).text())] = _.trim($('a', this).attr('href'));
					});
					if (argv.cache) fs.writeFileSync(path.join(argv.cache, productId + ".json"), JSON.stringify(product));
					callback(null, product);
				}
			});
		});
	}
}

var fetchAllCategories = function (callback) {

	var fetchTopCategories = function (callback) {
		LIST_FETCH_THROTTLING.removeTokens(1, function() {
			request('http://govstore.service.gov.uk/cloudstore/', function (error, response, html) {
				if (error || response.statusCode != 200) {
					console.error("Error fetching the top categories. Exiting...");
					process.exit(1);
				}
				var $ = cheerio.load(html),
					categories = [ ];
				$('#nav li.level0').each(function (i, element) {
					categories.push({
						name: $('a', this).eq(0).text().replace(/\n/g, '').toLowerCase().replace(/\(\w+\)/, ""),
						url: $('a', this).eq(0).attr('href')
					});
				});
				callback(null, categories);
			});
		});
	};

	var categories = { };
	fetchTopCategories(function (err, topCategories) {
		// eachSeries here is used just not to cause a burts of requests to
		// the source website
		async.eachSeries(topCategories, function (topCategory, callback) {
			LIST_FETCH_THROTTLING.removeTokens(1, function() {
				if (!categories[topCategory.name]) categories[topCategory.name] = { };
				request(topCategory.url, function (error, response, html) {
					if (error || response.statusCode != 200) {
						console.error("Error fetching the complete list of categories. Exiting...");
						process.exit(1);
					}
					var $ = cheerio.load(html);
					$('#narrow-by-list2 dd ol li').each(function (i, element) {
						categories[topCategory.name][$('a', this).text().toLowerCase().replace(/\(\w+\)/, "")] = { url: $('a', this).attr('href') };
					});
					callback(null);
				});
			});
		}, function (err) {
			callback(err, categories);
		});	
	});
};

var fetchAllProductsIds = function (callback) {
	fetchAllCategories(function (err, categories) {
		var allCategoriesUrls = Object.keys(categories).reduce(function (memo, topCategoryName) {
			return memo.concat(Object.keys(categories[topCategoryName]).map(function (secondLevelCategoryName) {
				return categories[topCategoryName][secondLevelCategoryName].url;
			}));
		}, [ ]);
		async.reduce(allCategoriesUrls, [ ], function (memo, categoryUrl, callback) {
			fetchProductsIdsByCategoryURL(categoryUrl, function (err, productIds) {
				callback(err, _.uniq(memo.concat(productIds)));
			});
		}, function (err, productIds) {
			callback(err, productIds.sort());
		});
	});
};

var fetchProductsIdsByCategoryURL = function (categoryUrl, callback) {

	// TODO: fetchProductsIdsByCategoryURLPage and fullTextSearchPage are 
	// almost identical, do we really need two separate functions?
	var fetchProductsIdsByCategoryURLPage = function (categoryUrl, pageNo, callback) {
		var productIds = [ ];
		LIST_FETCH_THROTTLING.removeTokens(1, function () {
			request(categoryUrl + '/where/p/' + pageNo, function (error, response, html) {
				if (error || response.statusCode != 200) {
					console.error("Error fetching a list of products. Exiting...");
					process.exit(1);
				}
				var $ = cheerio.load(html);
				$('#products-list li').each(function (i, element) {
					// TODO: how is it possible here that I match more a's than the
					// expected ones, and that they do not have href attributes?
					var found = $('div.product-shop.grid12-9.persistent-grid2-1 div h2 a', this).attr('href');
					if (found) {
						productIds.push(found.match(/[^\/]+$/)[0]);
					}
				});
				callback(null, productIds);
			});
		});
	}

	LIST_FETCH_THROTTLING.removeTokens(1, function () {
		request(categoryUrl, function (error, response, html) {
			if (error || response.statusCode != 200) {
				console.error("Error fetching the a list of products. Exiting...");
				process.exit(1);
			}
			var $ = cheerio.load(html),
				temp = $('div.category-products div div.sorter p.amount').text().match(/Items (\d+) to (\d+) of (\d+)/);
			if (temp) {
				// multiple results pages
				pageSize = parseInt(temp[2]) - parseInt(temp[1]) + 1,
				noOfPages = Math.ceil(parseInt(temp[3]) / pageSize);
			} else {
				// one page of results only
				temp = $('div.category-products div.toolbar div p strong').text().match(/(\d+) Item\(s\)/);
				pageSize = temp[1];
				noOfPages = 1;
			}
			async.reduce(_.range(1, noOfPages + 1), [ ], function (memo, pageNo, callback) {
				fetchProductsIdsByCategoryURLPage(categoryUrl, pageNo, function (err, results) {
					callback(err, memo.concat(results));
				});
			}, callback);
		});
	});
};

var fullTextSearch = function (searchKeywordsArray, callback) {

	var fullTextSearchPage = function (encodedSearchText, pageNo, callback) {
		LIST_FETCH_THROTTLING.removeTokens(1, function () {
			// note, I have demonstrated experimentally that the call below can 
			// return duplicate results!
			request('http://govstore.service.gov.uk/cloudstore/search/?p=' + pageNo + '&q=' + encodedSearchText, function (error, response, html) {
				if (error || response.statusCode !== 200) {
					console.error("Error fetching http://govstore.service.gov.uk/cloudstore/search/?p=" + pageNo + "&q=" + encodedSearchText + " . Aborting.");
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

	searchKeywordsArray = [ ].concat(searchKeywordsArray || [ ]);
	searchKeywordsArray = searchKeywordsArray.map(function (keyword) { return '"' + keyword + '"'; });
	LIST_FETCH_THROTTLING.removeTokens(1, function () {
		var encodedSearchText = encodeURIComponent(searchKeywordsArray.join("+or+"));
		// note, I have demonstrated experimentally that the call below can 
		// return duplicate results!
		request('http://govstore.service.gov.uk/cloudstore/search/?q=' + encodedSearchText, function (error, response, html) {
			if (error || response.statusCode !== 200) {
				console.error("Error fetching http://govstore.service.gov.uk/cloudstore/search/?q=" + encodedSearchText + " . Aborting.");
				process.exit(1);
			}
			var $ = cheerio.load(html),
				temp = $('#solr_search_result_page_container div.category-products div.toolbar div p').text().match(/Items (\d+) to (\d+) of (\d+)/);
			if (temp) {
				// multiple results pages
				pageSize = parseInt(temp[2]) - parseInt(temp[1]) + 1,
				noOfPages = Math.ceil(parseInt(temp[3]) / pageSize);
			} else {
				// one page of results only
				temp = $('#solr_search_result_page_container div.category-products div.toolbar div p strong').text().match(/(\d+) Item\(s\)/);
				pageSize = temp[1];
				noOfPages = 1;
			}
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

var dumpByProductIds = function (productIds, outputFilename, callback) {
	log("Fetching product detail data for product id...");
	async.mapSeries(productIds, function (id, callback) {
		log("... " + id);
		fetchProductById(id, function (err, product) {
			if (!err) {
				// this loop "flattens" the hierarchical structure of the record
				[ "details", "supplier", "docs" ].forEach(function (groupName) {
					Object.keys(product[groupName]).forEach(function (key) {
						product[groupName + "_" + key] = product[groupName][key];
					});
					delete product[groupName];
				});
			}
			callback(err, product);
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
}

var dumpBySearchKeywords = function (searchKeywordsArray, outputFilename, callback) {
	log("Fetching the full list of product ids matching the specified search terms...");
	fullTextSearch(searchKeywordsArray, function (err, productIds) {
		log("Completed.");
		dumpByProductIds(productIds, outputFilename, callback);
	});
}

var noOfProducts = null;
async.parallel([
	// the actual dump of products data matching the search strings
	function (callback) { dumpBySearchKeywords(argv._, argv.out, callback); },
	// TODO: I don't like the design of what I've done below
	// the calculation of the number of total products
	(!argv.total || argv.quiet) ? 
		function (callback) { callback(null); } :
		function (callback) { 
			fetchAllProductsIds(function (err, productsIds) { 
				noOfProducts = productsIds.length;
				callback(err); 
			});
		}
], function (err) {
	if (err) log('Errors were experienced during the execution of the script.');
	if (argv.total) log('The total number of records in CloudStore is ' + noOfProducts + '.');
})
