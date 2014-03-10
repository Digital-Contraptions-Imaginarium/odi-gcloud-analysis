## Comparing the 2012 dump with the current

Because of the difficulty of scraping the CloudStore website in full, we decided to limit our attention to the products verifying either of the conditions described below:

- they contain the word "data" in their description
- they contain the word "yes" in the column named "General: Open Standards supported and documented?" in the 2012 dump and "Do you company with the Government Open Standards Principles (see: http://www.cabinetoffice.gov.uk/openstandards)?" on the current website

This is justified by the fact that many products match the latter condition without matching the former. In the 2012 dump only there are  

"data" 97
"open" 16
"General: Open Standards supported (...)" 643



The documentation below is outdated

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


