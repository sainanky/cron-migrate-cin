require('dotenv').config();
require('../connection/database_common');
const conn = require("../connection/database_common");
const dbQry = require("../connection/sql_query");
const axios = require("axios");
const mysql = require("mysql2");
const captchaScript = require("./captcha");
const clientLibV3 = require('./client-lib-v3');
const moment = require('moment');

exports.main = async() =>{
    try{
        let query = `select ROC_NAME, ROC_CODE, VALUE AS ROC_VALUE from technowire_finanvo.ROC_CONFIG WHERE IS_COMPLETED = 0 LIMIT 1`;
        let doc = await dbQry(conn, query);
        if(doc.length > 0){
            let { ROC_NAME, ROC_CODE, ROC_VALUE} = doc[0];
            console.log(`Curr Roc Name = ${ROC_NAME}, Curr Roc value = ${ROC_VALUE}`)
            let response = await captchaScript.fetchCaptchaImage();
            console.log(response)
            let { solution, pre_CT, message } = response;
            ROC_VALUE = Number(ROC_VALUE) || 0;
            if(message == 'success'){
                let rocResponse = await this.getMcaRocData(ROC_NAME, ROC_VALUE, solution, pre_CT);
                console.log("data coming from rocResponse");
                if(rocResponse && rocResponse.message == 'Data fetched Successfully'){
                    let cinData = rocResponse.data.result;
                    console.log("rocResponse Data =", cinData);
                    await this.saveCin(cinData);
                    ROC_VALUE++;
                    await this.updateRocCount(ROC_CODE, ROC_VALUE);
                    setTimeout(() => {
                        this.main() 
                    }, 2000);
                }
                else if(rocResponse && rocResponse.message == 'No results found'){
                    console.log(`rocResponse Data = ${rocResponse.message} for roc = ${ROC_NAME}`);
                    await this.updateRocCount(ROC_CODE, ROC_VALUE, true);
                    setTimeout(() => {
                        this.main() 
                    }, 2000);
                }
                else{
                    console.log("rocResponse Data =", rocResponse);
                }
            }
            else if(message == 'retry'){
                setTimeout(() => {
                    this.main() 
                }, 2000);
            }
        }
        else{
            await this.resetCount();
            setTimeout(() => {
                this.main();
            }, 1000 * 60 * 10);
        }
    }
    catch(err){
        console.log("error in main =", err);
        setTimeout(() => {
            this.main();
        }, 1000 * 5);
    }
}


exports.getMcaRocData = (ROC_NAME, ROC_VAL, solution, pre_CT)=>{
    return new Promise(async(resolve, reject) =>{
        try{
            let data = JSON.stringify({
                "searchKeyword": "",
                "limit": 500,
                "offset": 0,
                "compRegNo": ROC_VAL,
                "roc": ROC_NAME,
                "userInput": solution,
                "pre_CT": pre_CT
            });
            data = clientLibV3.encrypt(data);
            let config = {
                method: 'get',
                maxBodyLength: Infinity,
                url: `https://www.mca.gov.in/bin/mca/foservicefindcindataforroc?data=${data}`,
                headers: { 
                    'accept': '*/*', 
                    'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8', 
                    'cookie': 'cookiesession1=678B2869DA96B3CF972EA92F94308888; __UUID-HASH=6d706c517dbcc56bfe12f66089597405$; JSESSIONID=0000YGfo-LT44Ks04KCrdJzcXJS:1bp6oqb3d; _csrf=9d106418-fc02-43eb-843b-6758c09059fa; cookiesession1=678B286942921B11FF28F36B48AA4476', 
                    'priority': 'u=1, i', 
                    'referer': 'https://www.mca.gov.in/content/mca/global/en/mca/fo-llp-services/findCinFinalSingleCom.html', 
                    'sec-ch-ua': '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"', 
                    'sec-ch-ua-mobile': '?0', 
                    'sec-ch-ua-platform': '"macOS"', 
                    'sec-fetch-dest': 'empty', 
                    'sec-fetch-mode': 'cors', 
                    'sec-fetch-site': 'same-origin', 
                    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36', 
                    'x-requested-with': 'XMLHttpRequest'
                }
            };
        
            let response = await axios.request(config);
            resolve(response.data);
        }
        catch(err){
            reject(err);
        }
    })
}

exports.updateRocCount = (rocCode, rocValue, IS_COMPLETED) =>{
    return new Promise(async(resolve, reject) =>{
        try{
            rocValue = formatNumber(rocValue);
            let query = `update technowire_finanvo.ROC_CONFIG SET VALUE = '${rocValue}', UPDATED_TIME = NOW() WHERE ROC_CODE = '${rocCode}'`;
            if(IS_COMPLETED){
                query = `update technowire_finanvo.ROC_CONFIG SET VALUE = '${rocValue}', UPDATED_TIME = NOW(), IS_COMPLETED = 1 WHERE ROC_CODE = '${rocCode}'`;
            }
            console.log("query for update= ", query)
            let doc = await dbQry(conn, query);
            resolve(doc);
        }
        catch(err){
            resolve("");
        }
    })
}

exports.resetCount = () =>{
    return new Promise(async(resolve, reject) =>{
        try{
            let query = `update technowire_finanvo.ROC_CONFIG SET UPDATED_TIME = NOW(),  IS_COMPLETED = 0`;
            console.log("query for update= ", query)
            let doc = await dbQry(conn, query);
            resolve(doc);
        }
        catch(err){
            resolve("");
        }
    })
}

function formatNumber(num) {
    return num.toString().padStart(6, '0');
}

setTimeout(() => {
    this.main();
}, 2000);