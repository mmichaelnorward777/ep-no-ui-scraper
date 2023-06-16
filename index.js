const sunbizJudgement = require("./scripts/sunbiz-judgement");
const mflScraper = require("./scripts/my-florida-license");



(async function(){

    /* 
        `H:/My Drive/Enforce Pay/scraped-files-sunbiz`

        Just put the directory path to where you would like to save the data;
        make sure that the drive letter path is existing;

            - "D:/Users/[your-pc-user-name]/Documents";

        this also accepts non-existing sub-folder/sub-directories and will automatically create that for you;
        you just have to make sure that the drive letter path exists.

            - "D:/Users/[your-pc-user-name]/Documents/some-subfolder/another-subfolder";
        

    */
    await sunbizJudgement("D:/Users/cools/Documents/Enforce Pay/sunbiz-scraped-data");


    /* 
        
        different scraper for a different website; 

    */
    // await mflScraper("D:/Users/cools/Documents/Enforce Pay/sunbiz-scraped-data"); 

}())