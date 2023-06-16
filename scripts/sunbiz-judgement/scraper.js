const path = require("path");
const puppeteer = require('puppeteer');
const countAllData = require("./count-all-data");
const excludedFilesObject = require("./excluded-files");
const evaluators = require("./evaluators");

const { mnmScraper, mnmUtilities } = require("mnm7747-scraper");
const { createDirPath, getAllFilesFromDirectory, toUrl, slowDown } = mnmUtilities;
const { moderator, csvDataWriter : writeToCsv, bulkProductDetailsScraper, pageEvaluatorProductsListPaginated, pageEvaluatorSingleProduct, jsonFile } = mnmScraper;



let totalDownloadedImageCount = 0,
    totalProcessedProductObjects = 0,
    maxCsvRows = 500,
    excludedFiles = [],
    startingPointUrls = [];

    global.requestsMade = 0;
    global.failedResponse = 0;



async function printCsv(data, searchKey, resultsDirPath, firstIndex, lastIndex, total)   {

    lastIndex = total > lastIndex ? lastIndex : total;

    await writeToCsv(resultsDirPath, toUrl(`debtors-from-searchkey-${searchKey}-${firstIndex}-to-${lastIndex}-of-${total}`), data, [], true);
    console.log("Done printing csv");

}


async function getStartingPointUrls(page)   {
    let newUrl = await page.evaluate(() => {
        let newUrl = function(){
                let link = Array.from(document.querySelectorAll("a")).find(item => item.innerText.trim().toLowerCase().includes("next list")),
                    url = link ? link.href : null;
                return url;
            }();

        return newUrl;
    });

    // await page.close();

    // page = await browser.newPage();

    await page.goto(newUrl, {waitUntil : "domcontentloaded", timeout : 0});
    let prevUrl = await page.evaluate(() => {
        let prevUrl = function(){
                let link = Array.from(document.querySelectorAll("a")).find(item => item.innerText.trim().toLowerCase().includes("previous list")),
                    url = link ? link.href : null;
                return url;
            }();

        return prevUrl;
    });

    return {
        statusOk : true,
        url : prevUrl,
    };
}


async function getLastObjectUrl(page, nextSearchKey)   {

    if(!nextSearchKey)  {
        return {
            lastObjectUrl : null,
            statusOk : true,
        };
    }
    
    let startingUrl = "http://dos.sunbiz.org/jlilist.html";

    let response = await page.goto(startingUrl, { waitUntil : "domcontentloaded", timeout : 0 });

    await slowDown(2525);
    await page.evaluate((nextSearchKey) => {
        let input = document.querySelector("#debtor_name"),
            submitButton = document.querySelector("input[type='submit']");
        input.value = nextSearchKey;

        submitButton.click();

    }, nextSearchKey);

    await slowDown(5000);

    await page.evaluate(() => {

        let prevUrl = function(){
            let link = Array.from(document.querySelectorAll("a")).find(item => item.innerText.trim().toLowerCase().includes("previous list"));
            return link;
        }();

        prevUrl.click();

    });

    await slowDown(5000);

    let lastObjectUrl = await page.evaluate(() => {

        let arr = Array.from(document.querySelectorAll("tr[onclick^='window.location']")).map(item => {
            let strFn = item.onclick.toString(),
                url = window.location.origin + strFn.slice(strFn.indexOf("/scripts"), strFn.lastIndexOf("'"));
            return url;
        }),
        lastObjectUrl = arr[arr.length - 1];

        return lastObjectUrl;

    });

    
    return {lastObjectUrl, statusOk : true};
}

async function scrapeStartingPointUrls(mainDirPath, searchKeys)   {
    let startingUrl = "http://dos.sunbiz.org/jlilist.html";
        
    await moderator(searchKeys, async (slicedArr) => {

        let jsonFileObject = jsonFile(path.join(mainDirPath, "json"), "starting-urls.json"),
            promises = slicedArr.map(searchKey => {
            return async function() {


                let browser = await puppeteer.launch({headless : false}),
                    page = await browser.newPage(),
                    index = searchKeys.findIndex(item => item === searchKey),
                    nextIndex = index < searchKeys.length ? index + 1 : null,
                    nextSearchKey = searchKeys[nextIndex];


                await page.setViewport({height : 900, width : 1440});
                let response = await page.goto(startingUrl, { waitUntil : "domcontentloaded", timeout : 0 });

                await slowDown(2525);
                await page.evaluate((searchKey) => {
                    let input = document.querySelector("#debtor_name"),
                        submitButton = document.querySelector("input[type='submit']");
                    input.value = searchKey;

                    submitButton.click();

                }, searchKey);

                await slowDown(5000);

                let resultObject = await getStartingPointUrls(page);

                await slowDown(5000);



                let { lastObjectUrl } = await getLastObjectUrl(page, nextSearchKey)


                startingPointUrls.push({
                    searchKey,
                    parentUrl : resultObject.url,
                    lastObjectUrl,
                });

                jsonFileObject.addNewData(startingPointUrls);

                await new Promise((resolve) => {

                    let interval = setInterval(() => {

                        if(resultObject.statusOk)   {
                            clearInterval(interval);

                            page.close();
                            browser.close();

                            resolve();
                            
                        }


                    }, 100);

                    
                });


            }
        });

        await Promise.all(promises.map(item => item()));

    }, 10);

}

async function scrapeDebtorsObject(startingPointUrlObject, mainDirPath)    {

    let {parentUrl, searchKey} = startingPointUrlObject,
        {paginatedEvaluator} = evaluators,
        jsonFileObject = jsonFile(path.join(mainDirPath, "json", "debtors-set"), `debtors-${searchKey}.json`),
        productObjects = await pageEvaluatorProductsListPaginated(parentUrl, paginatedEvaluator, startingPointUrlObject, async (productObjects, parentUrl) => {
            
            try{    

                await jsonFileObject.addNewData(productObjects);
                console.log({productObjects, parentUrl});
            } catch(err)    {
                console.log(err);
            }
            
        });
    
    
    await jsonFileObject.addNewData(productObjects);


    // if(!isSingleScraping)    {
    //     await getAllSingleProductData(mainDirPath);
    // }
    
    // console.log(productObjects);
    
}


async function getAllSingleProductData(mainDirPath, firstIndex = 0, lastIndex = null)    {

    let dirPath = path.join(mainDirPath, "json", "debtors-set"),
        allFiles = await getAllFilesFromDirectory(dirPath, ".json"),
        args = [firstIndex];

        if(lastIndex)   {
            args.push(lastIndex);
        }
    let allDebtorObjects = [];
    allFiles = allFiles.filter(item => !excludedFiles.includes(item));

    await moderator(allFiles, async (slicedArr) => {
        let promises = slicedArr.map(fileName => {
            return async function() {
                console.log(fileName)
                let jsonFileObject = jsonFile(dirPath, fileName),
                    debtorObjects = await jsonFileObject.getSavedData(),
                    searchKey = fileName.replace("debtors-", "").split(".")[0];

                allDebtorObjects.push({
                    debtorObjects,
                    searchKey,
                    total : debtorObjects.length
                });
            }
        });

        await Promise.all(promises.map(item => item()));
    }, allFiles.length);

    allDebtorObjects.sort((a, b) => {
        return a.total < b.total ? -1 : a.total > b.total ? 1 : 0;
    });

    allDebtorObjects.forEach(item => console.log(item.total));
    
    await moderator(allDebtorObjects.slice(...args), async (slicedArr) => {

        // console.log({division, debtorObjectsArray, slicedArr});


        let promises = slicedArr.map(debtorObject => {
            return async function() {

                let {total, debtorObjects, searchKey} = debtorObject;


                let debtorObjectsArray = [],
                    division = Math.ceil(total / maxCsvRows);

                for(let i = 0; i < division; i++)    {

                    let firstIndex = i * maxCsvRows,
                        lastIndex = (i + 1) * maxCsvRows;


                    // console.log({firstIndex, lastIndex, searchKey, firstItemOfCurrent : debtorObjects[firstIndex], lastItemOfPrevious : i > 0 ? debtorObjects[firstIndex - 1] : "No prev item as we are at 0"});

                    debtorObjectsArray.push(debtorObjects.slice(firstIndex, lastIndex));
                }


                // console.log({division, total, debtorObjectsArray, searchKey});

                let i = 0;

                await moderator(debtorObjectsArray, async (slice) => {

                    let [debtorObjectsSlice] = slice,
                        firstIndex = (i * maxCsvRows) + 1,
                        lastIndex = ((i + 1) * maxCsvRows);

                    console.log({total : debtorObjectsSlice.length, searchKey, grandTotal : total});

                    await getSingleProductData(debtorObjectsSlice, searchKey, mainDirPath, firstIndex, lastIndex, total);

                    i++;

                }, 1);

                // await getSingleProductData(debtorObjects, searchKey, mainDirPath, startingIndex);

            }
        });

        await Promise.all(promises.map(item => item()));

    }, 1);

}


async function getAllSingleProductDataByArray(mainDirPath, includedFiles = [], sliceIndex = 0)    {

    let dirPath = path.join(mainDirPath, "json", "debtors-set"),
        allFiles = await getAllFilesFromDirectory(dirPath, ".json");

    let allDebtorObjects = [];
    
    allFiles = allFiles.filter(item => includedFiles.includes(item));

    await moderator(allFiles, async (slicedArr) => {
        let promises = slicedArr.map(fileName => {
            return async function() {
                console.log(fileName)
                let jsonFileObject = jsonFile(dirPath, fileName),
                    debtorObjects = await jsonFileObject.getSavedData(),
                    searchKey = fileName.replace("debtors-", "").split(".")[0];

                allDebtorObjects.push({
                    debtorObjects,
                    searchKey,
                    total : debtorObjects.length
                });
            }
        });

        await Promise.all(promises.map(item => item()));
    }, allFiles.length);

    allDebtorObjects.sort((a, b) => {
        return a.total < b.total ? -1 : a.total > b.total ? 1 : 0;
    });

    allDebtorObjects.forEach(item => console.log(item.total));
    
    await moderator(allDebtorObjects, async (slicedArr) => {

        // console.log({division, debtorObjectsArray, slicedArr});


        let promises = slicedArr.map(debtorObject => {
            return async function() {

                let {total, debtorObjects, searchKey} = debtorObject;


                let debtorObjectsArray = [],
                    division = Math.ceil(total / maxCsvRows);

                for(let i = 0; i < division; i++)    {

                    let firstIndex = i * maxCsvRows,
                        lastIndex = (i + 1) * maxCsvRows;

                    debtorObjectsArray.push(debtorObjects.slice(firstIndex, lastIndex));
                }

                // console.log({division, total, debtorObjectsArray, searchKey});

                let i = sliceIndex > 0 ? sliceIndex / maxCsvRows : 0;


                await moderator(debtorObjectsArray.slice(i), async (slice) => {

                    let [debtorObjectsSlice] = slice,
                        firstIndex = (i * maxCsvRows) + 1,
                        lastIndex = ((i + 1) * maxCsvRows);

                    console.log({total : debtorObjectsSlice.length, searchKey, grandTotal : total, firstIndex, lastIndex});

                    await getSingleProductData(debtorObjectsSlice, searchKey, mainDirPath, firstIndex, lastIndex, total);

                    console.log({total : debtorObjectsSlice.length, searchKey, grandTotal : total, firstIndex, lastIndex});

                    console.log("\n\n\n\n ++++++++++============= next - iteration =============++++++++++ \n\n\n\n")

                    i++;

                }, 1);

                // await getSingleProductData(debtorObjects, searchKey, mainDirPath, startingIndex);

            }
        });

        await Promise.all(promises.map(item => item()));

    }, 1);

}

async function getSingleProductData(debtorObjects, searchKey, mainDirPath, firstIndex, lastIndex, total, sliceIndex = 0)   {

    let {detailsEvaluator} = evaluators,
        jsonFileObject = jsonFile(path.join(mainDirPath, "json", "complete-data"), `debtors-from-searchkey-${searchKey}-${firstIndex}-to-${lastIndex}-of-${total}.json`);
    await bulkProductDetailsScraper(debtorObjects, pageEvaluatorSingleProduct, detailsEvaluator, "url", 5, sliceIndex, async (allProductObjects) => {
        try{    
            // await jsonFileObject.addData(allProductObjects);
            console.log({total : debtorObjects.length});
            console.log(debtorObjects.filter(item => item.scraped));
            await jsonFileObject.addNewData(debtorObjects.filter(item => item.scraped));

            
        } catch(err)    {
            console.log(err);
        }

    }); 

    // await jsonFileObject.addNewData(debtorObjects);  
    await printCsv(debtorObjects, searchKey, mainDirPath, firstIndex, lastIndex, total);  
    // console.log(debtorObjects);
    

}

async function getProductObjects(mainDirPath, index = 0)  {

    
    // await scrapeStartingPointUrls(mainDirPath);

    let jsonFileObject = jsonFile(path.join(mainDirPath, "json"), "starting-urls.json");

    startingPointUrls = await jsonFileObject.getSavedData();

    console.log(startingPointUrls);

    // we scrape paginated data
    await moderator(startingPointUrls.slice(index), async (slicedArr) => {

        let promises = slicedArr.map(startingPointUrl => {
            return async function() {
                await scrapeDebtorsObject(startingPointUrl, mainDirPath);

            }
        });

        await Promise.all(promises.map(item => item()));

    }, 10);

    

}

function setExcludedFiles(key) {
    excludedFiles = excludedFilesObject[key];
}


module.exports = async function(dirPath)   {
    
    let mainDirPath = await createDirPath(dirPath),
        jsonFileObject = await jsonFile(__dirname, "search-keys.json"),
        searchKeys = await jsonFileObject.getSavedData();

    /* 

        this will just create a json file that contains an array of objects that contains the following:
            searckKey    
            starting point url for each of the search key
            and the url of the last row in the search key - this will help the script determine if it has reached the last page for paginated scraping

    */
    await scrapeStartingPointUrls(mainDirPath, searchKeys);


    /* 

        this is where the script will use the starting point url from the json file it has created
        starting-urls.json located on the main directory path;

        it will go through each of the pages for that search keys and create a json file, where it will scrape all the rows of data that it can get;
        each row will have the url for the full details of the data (judgement liens).

        the scraped data will be saved on a json file (per searchKey) located in the main directoryPath / json / detors-set-[searchKeyLetter].json (sample)

    */
    await getProductObjects(mainDirPath);


    /* 

        this is the part where the script will open each of the links that will show the full details for each of the rows taken from the paginated pages from the previous process.
        this will create a csv file, and a json file where the full details for each object will be shown. 

    */
    await getAllSingleProductData(mainDirPath);


    /* 

        this is just a bonus function that will count all the scraped data from the json files.

    */
    await countAllData(path.join(mainDirPath, "json", "complete-data"));
   

    /* 

        this is just a helper function that will let you choose the json files you want to scrape (from the page that displays the full details for each data) -- first argument, which is an array where you can add as many as you want;
         and the second argument allows you to start at an index... I set the csv files to only have a maximum of 500, so in case the scraper stops at 756, you can just set the argument to 500 (zero-based index), and restart the application. 
    
    */

    // await getAllSingleProductDataByArray(mainDirPath, ["debtors-t.json"], 10000);



}

