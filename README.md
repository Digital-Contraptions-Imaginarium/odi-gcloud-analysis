## Summary

The objective of this project is to:
- make the profiles of products and services published on HM Government's "CloudStore" website at [http://govstore.service.gov.uk/cloudstore](http://govstore.service.gov.uk/cloudstore) available in a machine-readable format
- use that data to analyse how, of all CloudStore products and services, *data* products have changed over the last two years by comparison with an available dump of the same data from May 2012
- produce lists of data products and services that address specific categories of services such as: hosting, consultancy, analysis, conversion or visualisation. 

## Outcome

On 14 March 2014, 620 companies listed on CloudStore today 2,842 products and services whose description included the word "data", over a total of 12,775 products.

Of these, 35 companies offered 40 products and services whose description explicitly referred to "open data".

In respect to the only previous snapshot we have of CloudStore, dated May 2012, we can see how the attention to data services and to open data in particular has increased substantially. 

At the time, the whole of CloudStore was about 1/10th of the size of today and listed 1,135 products and services. We had 58 suppliers offering 96 data products and services, 1 of which only referred to "open data".

This means that within the success of CloudStore's +1,025% growth in 22 months (110% month-on-month, like saying that it doubled in size every month), data services grew by +2,860% and open data services in particular by +3,900%.

![Summary table](images/table_1.png)

## cloudstore_dump.js command line tool

### Usage

    node cloudstore_dump.js <search keyword> [<search keyword ...>] --out <output CSV filename> [--cache <caching folder path>] [--total] [--tl <max no. of list requests to server per hour>] [--td <max no. of product details requests to server per hour>] [--quiet]

*search keywords*: the dump will contain only those products whose description contains any of the specified keywords. Combined terms should be specified in quotes, e.g.:

    node cloudstore_dump.js "open data" consultancy --out opendata_consultancies.csv

*out*: the required output CSV file

*cache*: if a path is specified, one JSON file for each product is saved here as it is read from the website. Once a product's file exists, that product won't be scraped agan from the CloudStore website but the cache will be used instead.

*total* (optional): also calculates the total number of products in CloudStore and prints it to standard output at completion. This can be time consuming as the number is calculated by fetching all pages of all lists of products by category for all categories. 

*tl*/*td* (optional): these values are used to specify throttling on the script's requests to the server. *tl* specifies the max number of requests for lists of products and *td* the max number of requests for detail pages. The default values are respectively 360 and 120. Requests are equally distributed in time.   

*quiet*: produces no output to standard output unless there are errors.
