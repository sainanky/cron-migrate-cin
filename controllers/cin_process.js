const conn = require("../connection/database_common");
const dbQry = require("../connection/sql_query");
const axios = require("axios");
const mysql = require("mysql2");
const captchaScript = require("./captcha");
const clientLibV3 = require('./client-lib-v3');
const moment = require('moment');
let rocAllData = [];
let rocIndex = 0;

exports.init = async() =>{
    try{
        let query = `select ROC_NAME, ROC_CODE, VALUE AS ROC_VALUE from technowire_finanvo.ROC_CONFIG WHERE IS_COMPLETED = 0 LIMIT 100`;
        let doc = await dbQry(conn, query);
        if(doc.length > 0){
            rocAllData = doc;
            this.main();
        }
        else{
            await this.resetCount();
            this.init();
        }
    }
    catch(err){
        console.log("error in init =", err)
    }
}

exports.main = async() =>{
    try{
        let { ROC_NAME, ROC_CODE, ROC_VALUE} = rocAllData[rocIndex];
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
                rocAllData[rocIndex]['ROC_VALUE'] = ROC_VALUE;
                await this.updateRocCount(ROC_CODE, ROC_VALUE);
                setTimeout(() => {
                    this.main() 
                }, 2000);
            }
            else if(rocResponse && rocResponse.message == 'No results found'){
                console.log(`rocResponse Data = ${rocResponse.message} for roc = ${ROC_NAME}`);
                if(rocIndex == rocAllData.length - 1) {
                    rocIndex = 0;
                    await this.resetCount();
                    setTimeout(() => {
                        this.init();
                    }, 1000 * 60 * 10);
                }
                else {
                    await this.updateRocCount(ROC_CODE, ROC_VALUE, true);
                    rocIndex++;
                    setTimeout(() => {
                        this.init() 
                    }, 2000);
                }
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
    catch(err){
        console.log("error in resadasdasdsdasasd")
        setTimeout(() => {
            this.main() 
        }, 2000);
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

exports.updateRocCount = (rocCode, rocValue, IS_COMPLETED) =>{
    return new Promise(async(resolve, reject) =>{
        try{
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
            let query = `update technowire_finanvo.ROC_CONFIG SET UPDATED_TIME = NOW(),  IS_COMPLETED = 1`;
            console.log("query for update= ", query)
            let doc = await dbQry(conn, query);
            resolve(doc);
        }
        catch(err){
            resolve("");
        }
    })
}