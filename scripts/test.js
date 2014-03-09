var csv = require('csv'),
	fs = require('fs'),
	path = require('path');

var testData = [ 
	{ foo: "boo" },
	{ loo: "soo" }
];

csv()
	.from.array(testData, {
		columns: true
	})
	.to.stream(fs.createWriteStream(path.join(__dirname, "foo.csv")), {
			header: true,
			newColumns: true
		})
	.transform(function (row, index) {
		row.foo = row.id;
		return row;
	});
	/*
	.transform(function (row, index, callback) {
		process.nextTick(function() {
        	callback(null, row);
    	}); 
	})
	.on('close', function (count) {
		console.log('Number of lines: ' + count);
	})
	.on('error', function (error) {
		console.log(error.message);
	});
	*/
