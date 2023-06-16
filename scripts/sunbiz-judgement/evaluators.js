function deleteAllScripts() {
    Array.from(document.querySelectorAll("script")).forEach(item => {
        if(!item.src.includes(window.location.orgin))    {
            item.remove();
        }
    })
}


module.exports = {
    paginatedEvaluator : {
        callback : (searchKey, parentUrl, lastObjectUrl) => {

            let productObjects = Array.from(document.querySelectorAll("tr[onclick^='window.location']")).map(item => {
                    let strFn = item.onclick.toString(),
                        url = window.location.origin + strFn.slice(strFn.indexOf("/scripts"), strFn.lastIndexOf("'"));
                    return {
                        url,
                        searchKey,
                        parentUrl,
                    };
                }),
                newUrl = function(){
                    let link = Array.from(document.querySelectorAll("a")).find(item => item.innerText.trim().toLowerCase().includes("next list")),
                        url = link ? link.href : null;

                    if(lastObjectUrl)   {
                        let foundObject = productObjects.find(item => item.url === lastObjectUrl);

                        if(foundObject) {
                            return null;
                        } else  {
                            return url;   
                        }
                    } else  {
                        return url;
                    }                    
                }();
    
            return {
                productObjects,
                newUrl,
            }
        }, 
        args : ["searchKey", "url", "lastObjectUrl"],
        waitMethods : [
            {
                name : "waitForSelector",
                args : "tr[onclick^='window.location']",
            },
        ],
    },
    detailsEvaluator : {
        callback : (searchKey, parentUrl) => {

            /* 
            
                documentNumber
                status
                caseNumber
                fileDate
                dateOfEntry
                expirationDate
                amount
                interestRage
                Name And Address of Judgment Creditor (Plaintiff)

                Name And Address of Judgment Debtor(s) (Defendant(s))
            */
            let table = document.querySelector("#detailtable > table"),
                summaryDetailsObject = Array.from(table.querySelectorAll("table[summary^='This table contains the filing information'] tr"))
                    .map(tr => {
                        let [description, data] = Array.from(tr.querySelectorAll("td")).map(item => {
                            return item.innerText.trim().replace(/\s\t\s+\n/g, "");
                        })

                        return {[description] : data};
                    }).reduce((a, b) => {

                        for(let key in b)   {
                            if(b[key] && b[key] !== "") {
                                a[key] = b[key]
                            }
                        }

                        return a;
                    }, {}),
                additionalDetailsObject = function(){
                    let objects = [];
                    Array.from(document.querySelectorAll("#detailtable > table > tbody > tr")).forEach((item, index) => {
                        let foundKeyRow = item.querySelector("td span.heading"),
                            foundValRow = item.querySelector("td.data");

                        if(foundKeyRow) {
                            if(foundKeyRow.innerText.trim().toLowerCase().includes("name and address of")) {
                                objects.push({key : foundKeyRow.innerText.trim(), index, value : [], isValid : true});
                            } else  {
                                objects.push({key : null, index, value : [], isValid : false});
                            }
                        } else if(foundValRow)  {
                            if(objects.length) {
                                objects[objects.length - 1].value.push(foundValRow.innerText.trim());
                            }
                        }
                        

                    });

                    return objects.filter(item => item.isValid).reduce((a, b) => {
                        a[b.key] = b.value.join("\n\n");
                        return a;
                    }, {});

                }();

            return {
                searchKey,
                parentUrl,
                ...summaryDetailsObject,
                ...additionalDetailsObject,
            }

        },
        args : ["searchKey", "parentUrl",],
        waitMethods : [
            {
                name : "waitForSelector",
                args : "#detailtable table",
            },
        ]
    }
    
}