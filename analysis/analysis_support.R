library(dplyr)

# 'loadCurrent' and 'load2012' return a data.frame obtained by reading the 
# respective csv files and removing all records whose description does not 
# contain 'filterDescriptionBy'. This is made necessary by the data potentially 
# referencing the search term in any other columns 
loadCurrent <- function (csvFilename, filterDescriptionBy) {
    d <- read.csv(csvFilename, stringsAsFactors = FALSE)
    d[grep(filterDescriptionBy, d$description, ignore.case = TRUE), ]
}

load2012 <- function (csvFilename, filterDescriptionBy) {
    d <- read.csv(csvFilename, skip = 2, stringsAsFactors = FALSE)
    d[grep(filterDescriptionBy, d$General..Service.Description, ignore.case = TRUE), ]
}
