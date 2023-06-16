const { mnmScraper, mnmUtilities } = require("mnm7747-scraper");
const { toUrl } = mnmUtilities;
const { csvDataWriter : writeToCsv } = mnmScraper;

async function printCsv(data, resultsDirPath, fileName, firstIndex, lastIndex, total)   {

    lastIndex = total > lastIndex ? lastIndex : total;

    await writeToCsv(resultsDirPath, toUrl(`${fileName}-${firstIndex}-to-${lastIndex}-of-${total}`), data, [], true);
    console.log("Done printing csv");

}

async function waitForMethods(page, waitMethods)  {
    for(let waitMethod of waitMethods)  {

        await page[waitMethod.name](waitMethod.args);

    }
}

async function selectOption(selectEl, value)   {
    let selectedOption = Array.from(selectEl.querySelectorAll("option")).find(item => item.value === value);

    selectedOption.selected = true;

    console.log(selectEl.value);

    let event = new Event("change");

    selectedOption.dispatchEvent(event);
}

module.exports = {
    selectOption,
    printCsv,
    waitForMethods,
}