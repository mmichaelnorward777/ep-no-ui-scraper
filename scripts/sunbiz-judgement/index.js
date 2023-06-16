const scraper = require("./scraper.js");

module.exports = async function(dirPath) {

    await scraper(dirPath);

}