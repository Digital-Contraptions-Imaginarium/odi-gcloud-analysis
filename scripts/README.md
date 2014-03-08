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


