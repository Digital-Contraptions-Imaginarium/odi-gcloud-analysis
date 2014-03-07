var cheerio = require('cheerio'),
	request = require('request'),
	restify = require('restify');

var server = restify.createServer({
	name: 'odi-gcloud-proxy',
});

server.listen(8080);

server.get('/id/:id', function send(req, res, next) {
	request('http://govstore.service.gov.uk/cloudstore/' + req.params.id, function (error, response, html) {
		if (!error && response.statusCode == 200) {
			var $ = cheerio.load(html),
				product = { details: { }, supplierInformation: { }, docs: { } };
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
			res.send({ product: product });
		}
		return next();
	});
});

server.get('/serviceid/:serviceid', function send(req, res, next) {
	request('http://govstore.service.gov.uk/cloudstore/search/?q=' + req.params.serviceid, function (error, response, html) {
		if (!error && response.statusCode == 200) {
			var $ = cheerio.load(html),
				fullIdentifiers = [ ];
			$('.product-shop-inner').each(function (i, element) {
				fullIdentifiers.push($('.desc.std strong a', this).attr('href').split("http://govstore.service.gov.uk/cloudstore/")[1]);
			});
			res.send({ fullIdentifiers: fullIdentifiers });
		}
		return next();
	});
});
