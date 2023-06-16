function deleteAllScripts() {
    Array.from(document.querySelectorAll("script")).forEach(item => {
        if(!item.src.includes(window.location.orgin))    {
            item.remove();
        }
    })
}



module.exports = {
    formEvaluator : {
        pageCallbacks : [
            (selectOption, formObject) => {

                selectOption = eval(`(${selectOption})`);

                let {board} = formObject,
                    boardSelect = document.querySelector("select[name='Board']");

                console.log(formObject, selectOption);
    
                selectOption(boardSelect, board.value);

                window.DDChange();
    
            },
            (selectOption, formObject) => {

                selectOption = eval(`(${selectOption})`);

                let {licenseType} = formObject,

                    licenseTypeSelect = document.querySelector("select[name='LicenseType']");

                console.log(formObject, selectOption);
    
                selectOption(licenseTypeSelect, licenseType.value);

                window.DDChange();
    
            },
            (selectOption, formObject, numberOfRowsPerPage) => {

                selectOption = eval(`(${selectOption})`);

                let {state, county} = formObject,
                    stateSelect = document.querySelector("select[name='State']"),
                    countySelect = document.querySelector("select[name='County']"),
                    recsPerPageSelect = document.querySelector("select[name='RecsPerPage']"),
                    searchButton = document.querySelector("button[name='Search1']")


                console.log(formObject, selectOption);
    
                selectOption(stateSelect, state.value);
                selectOption(countySelect, county.value);
                selectOption(recsPerPageSelect, numberOfRowsPerPage);

                // window.DDChange();

                searchButton.click();
    
            },
            () => {

                let resultsContainer = Array.from(document.querySelectorAll(`strong`)).find(item => item.innerText.trim().includes("Search Results")),
                    totalNumberOfRows = function(){
                        return parseInt(resultsContainer.innerText.split("-").map(item => item.trim()).pop())
                    }();

                return totalNumberOfRows;

            }

        ],
        waitMethods : [
            {
                name : "waitForSelector",
                args : "select[name='Board']"
            },
            {
                name : "waitForSelector",
                args : "select[name='LicenseType']"
            },
            {
                name : "waitForSelector",
                args : "select[name='State']"
            },
            {
                name : "waitForSelector",
                args : "select[name='County']"
            },
        ],
    },

    paginatedEvaluator : {
        callback : (formObject) => {

            let {board, licenseType, state, county} = formObject,
                productObjects = Array.from(document.querySelectorAll("form tr > td > font > a")).map(item => {
                return {
                    board : board.label,
                    licenseType : licenseType.label,
                    state : state.label,
                    county : county.label,
                    url : item.href
                }
            })
    
            return productObjects;
        }, 
        waitMethods : [
            {
                name : "waitForSelector",
                args : "form tr > td > font > a",
            },
        ],
    },
    detailsEvaluator : {
        callback : (board, licenseType, county, state, url) => {

            // let { board, licenseType, county, state, url } = dataInfo;

            function moveToSpecifiedParentElement(el, tagName)  {

                if(el.parentElement.tagName !== tagName)    {

                    return moveToSpecifiedParentElement(el.parentElement, tagName)

                } else  {

                    return el.parentElement;

                }

            }

            function getStackedTablesKeyValPair(key) {
                let font = Array.from(document.querySelectorAll("table tr td font")).find(item => item.innerText.includes(key));

                if(font)    {
                    let keysTable = moveToSpecifiedParentElement(font, "TABLE"),
                        valuesTable = keysTable.nextElementSibling,
                        keys = Array.from(keysTable.querySelectorAll("tbody tr > td")).map(item => item.innerText.trim()),
                        values = Array.from(valuesTable.querySelectorAll("tbody tr > td")).slice(1).map(item => item.innerText.trim()),
                        additionalPropsObject = {};

                    for(let i = 0; i < keys.length; i++)    {
                        additionalPropsObject[keys[i]] = values[i];
                    }
                    
                    return additionalPropsObject;
                    
                } else  {
                    return null;
                }
            }

            function getHorizontalKeyValuePairFromTable(key)   {
                let font = Array.from(document.querySelectorAll("table tr td font")).find(item => item.innerText.includes(key));


                if(font)    {
                    let additionalPropsObject = {},
                        siblingTable = moveToSpecifiedParentElement(font, "TABLE"),
                        specifiedTable = siblingTable.nextElementSibling;

                    Array.from(specifiedTable.querySelectorAll("tbody tr")).forEach(row => {
                        let [key, value] = Array.from(row.querySelectorAll("td")).slice(1).map(cell => {
                            return cell.innerText.trim().replace(":", "");
                        });

                        additionalPropsObject[key] = value;
                    });
                    
                    return additionalPropsObject;
                    
                } else  {
                    return null;
                }

            }


            let licenseeInfoObject = getHorizontalKeyValuePairFromTable("Licensee Information"),
                licenseInfoObject = getHorizontalKeyValuePairFromTable("License Information"),
                specialQualificationsObject = getStackedTablesKeyValPair("Special Qualifications"),
                alternateNamesObject = getStackedTablesKeyValPair("Alternate Names");
            

            return {
                board, 
                licenseType, 
                ...licenseeInfoObject,
                ...licenseInfoObject,
                ...specialQualificationsObject,
                ...alternateNamesObject,
                county, 
                state,
                url
            }

        },
        args : ["board", "licenseType", "county", "state", "url"],
        waitMethods : [
            {
                name : "waitForSelector",
                args : "table tr td font",
            },
        ]
    }
    
}