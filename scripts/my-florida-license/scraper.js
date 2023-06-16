const path = require("path");
const {spawn} = require("child_process");
const countAllData = require("./count-all-data");
const formObjects = require("./form-objects");
const { waitForMethods, selectOption, printCsv } = require("./api");
const puppeteer = require('puppeteer');
const evaluators = require("./evaluators");
const axios = require("axios");
const cheerio = require("cheerio");

const { mnmScraper, mnmUtilities } = require("mnm7747-scraper");
const { createDirPath, getAllFilesFromDirectory, toUrl, slowDown, getInitials } = mnmUtilities;
const { moderator, csvDataWriter : writeToCsv, bulkProductDetailsScraper, pageEvaluatorProductsListPaginated, pageEvaluatorSingleProduct, jsonFile } = mnmScraper;



let totalDownloadedImageCount = 0,
    totalProcessedProductObjects = 0,
    maxCsvRows = 500,
    numberOfRowsPerPage = "50";

async function prepareFormEvaluators(formObject, page, waitForMethods) {

    /* executing 3 step process to get to the correct page evaluator */
    let {formEvaluator} = evaluators,
        {waitMethods, pageCallbacks} = formEvaluator;

    try {
        await waitForMethods(page, waitMethods);

        await slowDown(1777);
    
        await page.evaluate(pageCallbacks[0], selectOption.toString(), formObject);

    } catch(err)    {
        console.log(err);
    }

    
    try {

        await waitForMethods(page, waitMethods);

        await slowDown(1777);
        
        await page.evaluate(pageCallbacks[1], selectOption.toString(), formObject);

    }catch(err) {
        console.log(err);
    }

    
    try {

        await waitForMethods(page, waitMethods);

        await slowDown(1777);
        
        await page.evaluate(pageCallbacks[2], selectOption.toString(), formObject, numberOfRowsPerPage);

    }catch(err) {
        console.log(err);
    }


    try {

        await waitForMethods(page, [{name : "waitForSelector", args : "form[name='reportForm'] tr > td > font > a"}]);

        await slowDown(1777);
        
        let totalPages = await page.evaluate(pageCallbacks[3]);

        return totalPages;

    }catch(err) {

        return 0;

    }
    

}

async function getProductObjectsPaginated(page, formObject, pageTotal)  {
    let allProductObjects = [],
        {callback, waitMethods} = evaluators.paginatedEvaluator,
        currentPage = 1;
    
    // return totalPages;

    try {
        async function getProductObjectsByPage(page, currentPage)   {
            await waitForMethods(page, waitMethods);
    
            let productObjects = await page.evaluate(callback, formObject);
    
            allProductObjects = [...allProductObjects, ...productObjects];
    
            console.log({productObjects});
            await slowDown(1777);
            if(currentPage < pageTotal) {
                currentPage++;
                await slowDown(1777);
                await page.evaluate((currentPage) => {
                    let pageInput = document.querySelector("input[name='Page']"),
                        searchGoButton = document.querySelector("button[name='SearchGo']");
    
                    pageInput.value = `${currentPage}`;
                    searchGoButton.click();
                }, currentPage);
    
                await slowDown(2777);
                await getProductObjectsByPage(page, currentPage);
            }
        }
    
        await getProductObjectsByPage(page, currentPage);
    
        console.log({allProductObjects, total : allProductObjects.length});
    
    }   catch(err)  {

        console.log(err);

    }

    return allProductObjects;
    
}
    

async function getLinksByFormObject(formObject)   {

    let startingPointUrl = "https://www.myfloridalicense.com/wl11.asp?mode=1&search=LicTyp&SID=&brd=&typ=",
        browser = await puppeteer.launch({headless : false}),
        page = await browser.newPage();
        

    await page.setViewport({height : 900, width : 1440});
    await page.goto(startingPointUrl, {waitUntil : "networkidle0", timeout : 0});

    let totalNumberOfRows = await prepareFormEvaluators(formObject, page, waitForMethods);

    if(!totalNumberOfRows)  {

        await page.close();

        await browser.close();

        return [];

    } else  {
        
        pageTotal = Math.ceil(totalNumberOfRows / numberOfRowsPerPage);
        
        let allProductObjects = await getProductObjectsPaginated(page, formObject, pageTotal);

        await page.close();

        await browser.close();

        return allProductObjects;

    }
        
}


async function getAllProductObjectLinks(mainDirPath, formObjects)   {

    await moderator(formObjects, async (slicedArr) => {

        let promises = slicedArr.map(formObject => {
                return async function() {
                    let targetDirPath = path.join(mainDirPath, "json", "data-set"),
                        {board, licenseType, state, county} = formObject,
                        productObjects = await getLinksByFormObject(formObject),
                        jsonFileObject = jsonFile(targetDirPath, toUrl(`data-set-${getInitials("alcohol beverages and tobacco")}-${getInitials(licenseType.label)}-${county.label}-${state.value}-total-${productObjects.length}`) + ".json");
                    

                    await jsonFileObject.addNewData(productObjects);
                }
            });
        
        await Promise.all(promises.map(item => item()));

    }, 1);

}


async function getSingleDataObject(dataObjects, mainDirPath, fileName, firstIndex, lastIndex, total, sliceIndex = 0)   {

    // lastIndex = total > lastIndex ? lastIndex : total;
    console.log({dataObjects, mainDirPath, fileName, firstIndex, lastIndex, total});

    let {detailsEvaluator} = evaluators,
        jsonFileObject = jsonFile(path.join(mainDirPath, "json", "complete-data"), `${fileName}-${firstIndex}-to-${lastIndex}-of-${total}.json`);
    await bulkProductDetailsScraper(dataObjects, pageEvaluatorSingleProduct, detailsEvaluator, "url", 5, sliceIndex, async (allProductObjects) => {
        try{    
            // await jsonFileObject.addData(allProductObjects);
            console.log({total : dataObjects.length});
            console.log(dataObjects.filter(item => item.scraped));
            await jsonFileObject.addNewData(dataObjects.filter(item => item.scraped));

            
        } catch(err)    {
            console.log(err);
        }

    }); 

    // await jsonFileObject.addNewData(debtorObjects);  
    await printCsv(dataObjects, mainDirPath, fileName, firstIndex, lastIndex, total);  
    console.log(dataObjects);

}

async function getAllDataObjects(mainDirPath)   {

    let dirPath = path.join(mainDirPath, "json", "data-set"),
        allFiles = await getAllFilesFromDirectory(dirPath, ".json"),
        excludedFilesJson = jsonFile(__dirname, "excluded-files.json"),
        excludedFiles = await excludedFilesJson.getSavedData();


    allFiles = allFiles.filter(item => !excludedFiles.includes(item));

    let allDataObjects = [];

    await moderator(allFiles, async (slicedArr) => {
        let promises = slicedArr.map(fileName => {
            return async function() {
                console.log(fileName)
                let jsonFileObject = jsonFile(dirPath, fileName),
                    dataObjects = await jsonFileObject.getSavedData(),
                    newFileName = fileName.replace("data-set-", "").split("-total-")[0];

                allDataObjects.push({
                    dataObjects,
                    fileName : newFileName,
                    total : dataObjects.length
                });
            }
        });

        await Promise.all(promises.map(item => item()));

    }, allFiles.length);
    
    // sorting all data objects from minimal to the one with most
    allDataObjects.sort((a, b) => {
        return a.total < b.total ? -1 : a.total > b.total ? 1 : 0;
    });

    
    allDataObjects.forEach(item => console.log(item.total));
    
    await moderator(allDataObjects, async (slicedArr) => {

        // console.log({division, debtorObjectsArray, slicedArr});


        let promises = slicedArr.map(dataObject => {
            return async function() {

                let {total, dataObjects, fileName} = dataObject;


                let dataObjectsArray = [],
                    division = Math.ceil(total / maxCsvRows);

                for(let i = 0; i < division; i++)    {

                    let firstIndex = i * maxCsvRows,
                        lastIndex = (i + 1) * maxCsvRows;


                    // console.log({firstIndex, lastIndex, searchKey, firstItemOfCurrent : dataObjects[firstIndex], lastItemOfPrevious : i > 0 ? dataObjects[firstIndex - 1] : "No prev item as we are at 0"});

                    dataObjectsArray.push(dataObjects.slice(firstIndex, lastIndex));
                }


                // console.log({division, total, debtorObjectsArray, searchKey});

                let i = 0;

                await moderator(dataObjectsArray, async (slice) => {

                    let [dataObjectsSlice] = slice,
                        firstIndex = (i * maxCsvRows) + 1,
                        lastIndex = ((i + 1) * maxCsvRows);

                    // console.log({total : dataObjectsSlice.length, fileName, grandTotal : total, firstIndex, lastIndex});

                    // await getSingleProductData(dataObjectsSlice, searchKey, mainDirPath, firstIndex, lastIndex, total);
                    await getSingleDataObject(dataObjectsSlice, mainDirPath, fileName, firstIndex, lastIndex, total);

                    await excludedFilesJson.addNewData([fileName]);

                    i++;

                }, 1);

                // await getSingleProductData(debtorObjects, searchKey, mainDirPath, startingIndex);

            }
        });

        await Promise.all(promises.map(item => item()));

    }, 1);

}


module.exports = async function(dirPath)   {
    
    // need to scrape the data;
    // let mainDirPath = await createDirPath(`H:/My Drive/Enforce Pay/scraped-files-myfloridalicense`); // mainDirPath monster PC;
    let mainDirPath = await createDirPath(dirPath); // testDirPath monster PC;
    // let mainDirPath = await createDirPath(`H:/My Drive/Enforce Pay/scraped-files-myfloridalicense`); // mainDirPath monster PC;

    // await getAllProductObjectLinks(mainDirPath, formObjects.slice(0));

    // await getAllDataObjects(mainDirPath);

    await countAllData(path.join(mainDirPath, "json", "data-set"));
    
}

