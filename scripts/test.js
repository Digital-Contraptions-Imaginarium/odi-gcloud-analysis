var restify = require('restify');

var client = restify.createJsonClient({
	url: 'http://localhost:8080',
	version: '*'
});

client.get('/categories', function(err, req, res, obj) {
	console.log(obj);
});
