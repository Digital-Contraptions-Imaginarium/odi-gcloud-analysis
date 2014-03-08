var argv = require("optimist")
		.usage('Usage: $0 --out <output JSON filename>')
		// .alias("port", "p")
		// .default("port", "8080")
		.argv,
	async = require('async'),
	cheerio = require('cheerio'),
	fs = require('fs'),
	request = require('request'),
	RateLimiter = require('limiter').RateLimiter,
	_ = require('underscore');

var PRODUCT_FETCH_THROTTLING = new RateLimiter(150, 'hour'),
	LIST_FETCH_THROTTLING = new RateLimiter(300, 'hour');

var categories = null,
	server = restify.createServer({
		name: 'odi-gcloud-proxy',
	});

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

var fullTextSearchPage = function (searchText, pageNo, callback) {
	LIST_FETCH_THROTTLING.removeTokens(1, function () {
		// Note that the call below can return duplicate results!
		console.log('http://govstore.service.gov.uk/cloudstore/search/?p=' + pageNo + '&q=' + searchText);
		request('http://govstore.service.gov.uk/cloudstore/search/?p=' + pageNo + '&q=' + searchText, function (error, response, html) {
			if (error || response.statusCode != 200) {
				console.log("Error fetching the a list of products. Exiting...");
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

var fullTextSearch = function (searchText, callback) {
	LIST_FETCH_THROTTLING.removeTokens(1, function () {
		// Note that the call below can return duplicate results!
		request('http://govstore.service.gov.uk/cloudstore/search/?q=' + searchText, function (error, response, html) {
			if (error || response.statusCode != 200) {
				console.log("Error fetching the a list of products. Exiting...");
				process.exit(1);
			}
			var $ = cheerio.load(html),
				temp = $('#solr_search_result_page_container div.category-products div.toolbar div p').text().match(/Items (\d+) to (\d+) of (\d+)/),
				pageSize = parseInt(temp[2]) - parseInt(temp[1]) + 1,
				noOfPages = Math.ceil(parseInt(temp[3]) / pageSize);
			async.reduce(_.range(1, noOfPages + 1), [ ], function (memo, pageNo, callback) {
				fullTextSearchPage(searchText, pageNo, function (err, results) {
					callback(err, _.uniq(memo.concat(results)));
				});
			}, callback);
		});
	});
};
