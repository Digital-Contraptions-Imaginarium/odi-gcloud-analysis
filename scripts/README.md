## Proxy API
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

