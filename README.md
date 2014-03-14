## cloudstore_dump.js command line tool

The objective of the *cloudstore_dump.js* tool is to scrape HM Government's "CloudStore" website at [http://govstore.service.gov.uk/cloudstore](http://govstore.service.gov.uk/cloudstore) in order to:

- support users into identifying and save to a machine-readable format relevant records, and
- produce figures suitable to measure change in the portfolio of products in time

### Usage

    node cloudstore_dump.js <search keyword> [<search keyword ...>] --out <output CSV filename> [--cache <caching folder path>] [--total] [--tl <max no. of list requests to server per hour>] [--td <max no. of product details requests to server per hour>] [--quiet]

*search keywords*: the dump will contain only those products whose description contains any of the specified keywords. Combined terms should be specified in quotes, e.g.:

    node cloudstore_dump.js "open data" consultancy --out opendata_consultancies.csv

*out*: the required output CSV file

*cache*: if a path is specified, one JSON file for each product is saved here as it is read from the website. Once a product's file exists, that product won't be scraped agan from the CloudStore website but the cache will be used instead.

*total* (optional): also calculates the total number of products in CloudStore and prints it to standard output at completion. This can be time consuming as the number is calculated by fetching all pages of all lists of products by category for all categories. 

*tl*/*td* (optional): these values are used to specify throttling on the script's requests to the server. *tl* specifies the max number of requests for lists of products and *td* the max number of requests for detail pages. The default values are respectively 360 and 120. Requests are equally distributed in time.   

*quiet*: produces no output to standard output unless there are errors.

# The documentation below is outdated

## Comparing the 2012 dump with the current

Because of the difficulty of scraping the CloudStore website in full, we decided to limit our attention to the products verifying either of the conditions described below:

- they contain the word "data" in their description
- they contain the word "yes" in the column named "General: Open Standards supported and documented?" in the 2012 dump and "Do you company with the Government Open Standards Principles (see: http://www.cabinetoffice.gov.uk/openstandards)?" on the current website

This is justified by the fact that many products match the latter condition without matching the former. In the 2012 dump only there are  

"data" 97
"open" 16
"General: Open Standards supported (...)" 643



## Proxy API server
The following APIs ara available:

- */id/[full identifier]* - Returns the full data for the requested product. 
Note that CloudStore uses as unique identifiers not the "service 
ids" (or "SKU") that you can see by browsing the website, but a string that is 
usually a combination of its name and the SKU.

- */search/[search string]* - [INCOMPLETE]

- */categories* - Returns a structured JSON object with the two levels of 
categories, e.g.

	    { "results":
	        { "SaaS": {
	            "Accessibility": { "url":"http://govstore.service.gov.uk/cloudstore/saas/accessibility"},
	            "Agile Tools": {"url":"http://govstore.service.gov.uk/cloudstore/saas/agile-tools"},
	            (...)
	        },
	        { "PaaS": 
	        	(...)
	    	},
	    	(...)
	    }

- */list/[name of top level]/[name of second level]* - Returns a list of all
product identifiers in the category

## dump.js command line utility

The *dump.js* scripts dumps the contents of the CloudStore website by using the 
proxy API server described above. The default output format is a json array 
where every item is a product and the supplier information is copied .

As execution time is normally very long, the script by default writes to 
standard output a log of its operations together with the actual data at 
completion. By specifying the *--quiet* parameter only the data is output.

    node dump.js --quiet > dump.json


