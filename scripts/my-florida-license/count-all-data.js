const { mnmScraper, mnmUtilities } = require("mnm7747-scraper");
const { getAllFilesFromDirectory } = mnmUtilities;
const { moderator, jsonFile } = mnmScraper;

module.exports = async function countAllData(targetPath)    {

    let allFiles = await getAllFilesFromDirectory(targetPath, ".json"),
        total = 0;

    await moderator(allFiles, async (slicedArr) => {
        let [file] = slicedArr,
            jsonFileObject = jsonFile(targetPath, file),
            objects = await jsonFileObject.getSavedData();

        total += objects.length;

        console.log({total : objects.length, fileName : file, grandTotal : total});
    }, 1);

    return total;

}