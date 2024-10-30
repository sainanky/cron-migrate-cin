require('dotenv').config();
require('../connection/database_common');
const conn = require("../connection/database_common");
const dbQry = require("../connection/sql_query");
const axios = require("axios");
const captchaScript = require("./captcha");
const clientLibV3 = require('./client-lib-v3');
exports.main = async()=>{
    try{
        let query = `SELECT max(CIN) AS CIN FROM master_data.CIN where LENGTH(CIN) = 8 AND CIN LIKE '%-%'`;
        let doc = await dbQry(conn, query);
        if(doc.length > 0){
            let { CIN } = doc[0];
            let newCin = incrementCustomCode(CIN);
            let response = await captchaScript.fetchCaptchaImage();
            let { solution, pre_CT, message } = response;
            if(message == 'success'){
                let rocResponse = await this.getMcaData(newCin, solution, pre_CT);
                console.log("data coming from rocResponse =", rocResponse);
                if(rocResponse && rocResponse.message == 'Data fetched Successfully'){
                    let cinData = rocResponse.data.result;
                    console.log("rocResponse Data =", cinData);
                    await this.saveCin(cinData);
                }
                else if(rocResponse && rocResponse.message == 'No results found'){
                    console.log(`rocResponse Data = ${rocResponse.message} for cin = ${newCin}`);
                    setTimeout(() => {
                        this.main() 
                    }, 1000 * 60 * 10);
                }
            }
            else if(message == 'retry'){
                setTimeout(() => {
                    this.main() 
                }, 2000);
            }
        }
        else{
            setTimeout(() => {
                this.main();
            }, 1000 * 60 * 10);
        }
    }
    catch(err){
        console.log("error in llp")
        setTimeout(() => {
            this.main() 
        }, 5000);
    }
}

exports.getMcaData = (CIN, solution, pre_CT) =>{
    return new Promise(async(resolve, reject) =>{
        try{
            let csrfToken = clientLibV3.encrypt('9d106418-fc02-43eb-843b-6758c09059fa');
            let reqData = `module=MDS&searchKeyWord=${CIN}&searchType=autosuggest&mdsSearchType=searchedName&mdsSearchType=company&userInput=${solution}&pre_CT=${pre_CT}`;
            // data = clientLibV3.encrypt(data);

            let data = "data=" + clientLibV3.encrypt(reqData) + "&csrfToken=" + clientLibV3.encrypt(csrfToken)
            let config = {
                method: 'post',
                maxBodyLength: Infinity,
                url: 'https://www.mca.gov.in/bin/mca/mds/commonSearch',
                headers: { 
                    'accept': 'application/json, text/javascript, */*; q=0.01', 
                    'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8', 
                    'content-type': 'application/x-www-form-urlencoded; charset=UTF-8', 
                    'cookie': 'cookiesession1=678B2869DA96B3CF972EA92F94308888; __UUID-HASH=6d706c517dbcc56bfe12f66089597405$; JSESSIONID=0000YGfo-LT44Ks04KCrdJzcXJS:1bp6oqb3d; _csrf=9d106418-fc02-43eb-843b-6758c09059fa; cookiesession1=678B286942921B11FF28F36B48AA4476', 
                    'origin': 'https://www.mca.gov.in', 
                    'priority': 'u=1, i', 
                    'referer': 'https://www.mca.gov.in/content/mca/global/en/mca/master-data/MDS.html', 
                    'sec-ch-ua': '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"', 
                    'sec-ch-ua-mobile': '?0', 
                    'sec-ch-ua-platform': '"macOS"', 
                    'sec-fetch-dest': 'empty', 
                    'sec-fetch-mode': 'cors', 
                    'sec-fetch-site': 'same-origin', 
                    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36', 
                    'x-requested-with': 'XMLHttpRequest'
                },
                data : data
            };

            let response = await axios.request(config);
            resolve(response.data);
        }
        catch(err){
            reject(err);
        }
    })
}

function incrementCustomCode(code) {
    const [prefix, numPart] = code.split('-');
    let num = parseInt(numPart, 10);
    num += 1;
    if (num > 9999) {
        num = 1;
        const newPrefix = incrementPrefix(prefix);
        return `${newPrefix}-0001`;
    }
    const formattedNum = num.toString().padStart(4, '0');
    return `${prefix}-${formattedNum}`;
}

function incrementPrefix(prefix) {
    const lastChar = prefix[prefix.length - 1];
    let newPrefix = prefix.slice(0, -1);

    if (lastChar === 'Z') {
        newPrefix = incrementPrefix(newPrefix) + 'A'; 
    } else {
        newPrefix += String.fromCharCode(lastChar.charCodeAt(0) + 1);
    }

    return newPrefix;
}

exports.saveCin = (cinData) =>{
    return new Promise(async (resolve, reject)=>{
        try{
            let query = `INSERT IGNORE INTO master_data.CIN (CIN, COMPANY_NAME, COUNTRY_INC, DATE_OF_REGISTRATION, ROC, TYPE_OF_COMPANY, STATE, STATUS, COMPANY_STATUS, UPDATED_1, PRIORITY) VALUES`;
            let subQry = '';
            for(let i = 0; i < cinData.length; i++){
                let v = cinData[i];
                let dateOfIncorporation = moment(v.dateOfIncorporation, 'YYYY-MM-DD').format('MM/DD/YYYY')
                subQry = `(${mysql.escape(v.cnNmbr)}, ${mysql.escape(v.cmpnyNm)}, ${mysql.escape(v.cmpnyOrgn)}, 
                ${mysql.escape(dateOfIncorporation)}, ${mysql.escape(v.rocCode)}, ${mysql.escape(v.acntType)},
                ${mysql.escape(v.state)}, ${mysql.escape(v.cmpnySts)}, ${mysql.escape(v.cmpnySts)}, NOW(), 30)`;
                if(i < cinData.length - 1) subQry += ',';
            }
            let doc = await dbQry(conn, query + subQry);
            console.log("data saved into cin");
            resolve(doc);
        }
        catch(err){
            console.log(err);
            reject(err);
        }
    })
}


setTimeout(() => {
    this.main();
}, 2000);

