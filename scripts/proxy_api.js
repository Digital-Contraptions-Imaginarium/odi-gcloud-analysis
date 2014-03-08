var async = require('async'),
	cheerio = require('cheerio'),
	request = require('request'),
	RateLimiter = require('limiter').RateLimiter,
	restify = require('restify');

var PRODUCT_FETCH_THROTTLING = new RateLimiter(150, 'hour'),
	CATEGORY_FETCH_THROTTLING = new RateLimiter(300, 'hour');

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

var fetchAllCategories = async.memoize(function (callback) {
	var categories = { };
	fetchTopCategories(function (err, topCategories) {
		// eachSeries here is used just not to cause a burts of requests to
		// the source website
		async.eachSeries(topCategories, function (topCategory, callback) {
			if (!categories[topCategory.name]) {
				categories[topCategory.name] = { };
			}
			request(topCategory.url, function (error, response, html) {
				if (error || response.statusCode != 200) {
					console.log("Error fetching the complete list of categories. Exiting...");
					process.exit(1);
				}
				var $ = cheerio.load(html);
				$('#narrow-by-list2 dd ol li').each(function (i, element) {
					categories[topCategory.name][$('a', this).text()] = { url: $('a', this).attr('href') };
				});
				callback(null);
			});
		}, function (err) {
			callback(err, categories);
		});	
	});
});

var fetchProductsIdsByCategoryURL = function (categoryUrl, callback) {
	request('http://govstore.service.gov.uk/cloudstore/saas/accessibility/where/p/1', function (error, response, html) {
		if (error || response.statusCode != 200) {
			console.log("Error fetching the a list of products. Exiting...");
			process.exit(1);
		}
		var $ = cheerio.load(html),
			temp = $('div.m-block.mb-category-products div.category-products div div.sorter p.amount').text().match(/Items (\d+) to (\d+) of (\d+)/),
			pageSize = temp[2] - temp[1] + 1,
			noOfPages = Math.ceil(temp[3] / pageSize);
		async.reduce(Array.apply(null, Array(noOfPages)).map(function (_, i) {return i + 1;}), [ ], function (memo, pageNo, callback) {
			fetchProductsIdsByCategoryURLPageNo(categoryUrl, pageNo, function (err, results) {
				callback(err, memo.concat(results));
			});
		}, callback);
	});
}

var fetchProductsIdsByCategoryURLPageNo = function (categoryUrl, pageNo, callback) {
	var productIds = [ ];
	CATEGORY_FETCH_THROTTLING.removeTokens(1, function () {
		request('http://govstore.service.gov.uk/cloudstore/saas/accessibility/where/p/' + pageNo, function (error, response, html) {
			if (error || response.statusCode != 200) {
				console.log("Error fetching a list of products. Exiting...");
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
	fetchAllCategories(function (err, categories) {
		res.send({ results: categories });
		next();		
	})
});

server.get('/list/:topLevel/:secondLevel', function (req, res, next) {
	fetchAllCategories(function (err, categories) {
		fetchProductsIdsByCategoryURL(categories[req.params.topLevel][req.params.secondLevel].url, function (err, productIds) {
			res.send({ results: productIds });
			next();
		});
	});
});

server.listen(8080);

