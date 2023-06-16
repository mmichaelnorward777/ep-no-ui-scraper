const writeToCsv = require("../../core/csv-data-writer");
const moderator = require("../../core/template/bulk-moderator");
const jsonFile = require("../../core/template/json-file");
const { toUrl } = require("../../utilities/string");

async function printCsv(data, searchKey, resultsDirPath, firstIndex, lastIndex, total)   {

    lastIndex = total > lastIndex ? lastIndex : total;

    await writeToCsv(resultsDirPath, toUrl(`debtors-from-searchkey-${searchKey}-${firstIndex}-to-${lastIndex}-of-${total}`), data, [], true);
    console.log("Done printing csv");

}

module.exports = async function(fileName, fileDirPath, resultsDirPath)  {

    let jsonFileObject = jsonFile(fileDirPath, fileName),
        objects = await jsonFileObject.getSavedData(),
        total = objects.length,
        searchKey = fileName.replace("debtors-from-searchkey-", "").split("-")[0];
        maxCsvRows = 500,
        i = 0;
        
    console.log(searchKey);
    await moderator(objects, async (slicedObjectsArr) => {

        let firstIndex = (i * maxCsvRows) + 1,
            lastIndex = (i + 1) * maxCsvRows;

        await printCsv(slicedObjectsArr, searchKey, resultsDirPath, firstIndex, lastIndex, total);
        
        i++;

    }, maxCsvRows);

}