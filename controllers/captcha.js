const axios = require('axios');
const FormData = require('form-data');
const Tesseract = require('tesseract.js');
const fs = require('fs');
const sharp = require('sharp');
const clientLibV3 = require('./client-lib-v3');
const path = require('path');

exports.fetchCaptchaImage = () => {
  return new Promise(async(resolve, reject)=>{
    try {
      const response = await axios.get('https://www.mca.gov.in/bin/mca/generateCaptchaWithHMAC', {
        headers: {
          'accept': '*/*',
          'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
          'cookie': 'cookiesession1=678B2869DA96B3CF972EA92F94308888; __UUID-HASH=6d706c517dbcc56bfe12f66089597405$; JSESSIONID=0000YGfo-LT44Ks04KCrdJzcXJS:1bp6oqb3d',
          'referer': 'https://www.mca.gov.in/content/mca/global/en/mca/fo-llp-services/findCinFinalSingleCom.html',
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
          'x-requested-with': 'XMLHttpRequest'
        },
        responseType: 'arraybuffer' // fetch image as binary data
      });
      const captchaImage = Buffer.from(response.data, 'binary');
      const captchaFolderPath = path.join(__dirname, '../captcha-images');
      let captchaImagePath = path.join(captchaFolderPath, 'captcha_1.jpg');
      let captchaImageOutputPath = path.join(captchaFolderPath, 'captcha_2.jpg');
      fs.writeFileSync(captchaImagePath, captchaImage);
      await preprocessImage(captchaImagePath, captchaImageOutputPath);
      let captchaSolution = await solveCaptchaWithOCR(captchaImageOutputPath);
      console.log("captchaSolution =", captchaSolution)
      let pre_CT = response.headers['pre_ct'];
      let splitCaptchaSolution = captchaSolution.split('+');
      console.log("captchaSolution =", splitCaptchaSolution)
      // let isValidCaptcha = false;
      let solution = "";
      if(splitCaptchaSolution.length == 2){
        solution = Number(splitCaptchaSolution[0].trim()) + Number(splitCaptchaSolution[1].trim());
        console.log("solution ==", solution)
      }
      else{
        splitCaptchaSolution = captchaSolution.split('.');
        console.log("captchaSolution =", splitCaptchaSolution)
        if(splitCaptchaSolution.length == 2){
          solution = Number(splitCaptchaSolution[0].trim()) + Number(splitCaptchaSolution[1].trim());
          console.log("solution ==", solution)
        }
        else console.log("invalid captcha");
      }

      if(solution && typeof(solution) == 'number'){
        let pre_CT_new = await submitCaptchaSolution(solution, pre_CT);
        resolve({solution, pre_CT : pre_CT_new, message : "success"});
      }
      resolve({solution, pre_CT : "", message : "retry"});

    } catch (error) {
      console.error('Error fetching captcha image:', error);
      reject(error);
    }
  })
}

async function preprocessImage(inputPath, outputPath) {
  try {
    await sharp(inputPath)
      .grayscale() // Convert to grayscale
      .threshold(150) // Apply thresholding to make text clearer
      .toFile(outputPath);
    console.log("Image preprocessing complete.");
  } catch (error) {
    console.error("Error during image preprocessing:", error);
  }
}

async function solveCaptchaWithOCR(imagePath) {
  try {
    const { data: { text } } = await Tesseract.recognize(imagePath, 'eng', {
      logger: (m) => console.log(m), // Log OCR progress
    });
    const solution = text.trim();
    // console.log("Captcha Solution:", solution);
    return solution;
  } catch (error) {
    console.error('Error solving captcha with OCR:', error);
  }
}

function submitCaptchaSolution(solution, pre_CT) {
  return new Promise(async(resolve, reject)=>{
    try {
      const formData = new FormData();
      formData.append('data', solution);
  
      let data = `userInput=${solution}&pre_CT=${pre_CT}`
      // let encData = await encryptData(data);
      // encData = encData.doc_id;
      let encData = "data=" + clientLibV3.encrypt(data);
      //let data = 'data=uFacwkFqWmpG1EYSBDjonO9pzj9ZN62uGNoIJPp9rHeciiNgPLENTVQBC%2BoPC%2BGgt6H9cIrsm0qmfduBje2MIrmjI1kOBpStORr4xkvDyQV4PxL%2BmUlb0qr0%2BT7XjyttN6wmzDZNK3ksl0unce8Hd8BzeB5uw3dxOdFTKkFSC2Y%3D';
  
      let config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://www.mca.gov.in/bin/mca/HmacCaptchaValidationServlet',
        headers: { 
          'accept': 'application/json, text/javascript, */*; q=0.01', 
          'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8', 
          'content-type': 'application/x-www-form-urlencoded; charset=UTF-8', 
          'cookie': 'cookiesession1=678B2869DA96B3CF972EA92F94308888; __UUID-HASH=6d706c517dbcc56bfe12f66089597405$; JSESSIONID=0000YGfo-LT44Ks04KCrdJzcXJS:1bp6oqb3d; cookiesession1=678B286942921B11FF28F36B48AA4476', 
          'origin': 'https://www.mca.gov.in', 
          'priority': 'u=0, i', 
          'referer': 'https://www.mca.gov.in/content/mca/global/en/mca/fo-llp-services/findCinFinalSingleCom.html', 
          'sec-ch-ua': '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"', 
          'sec-ch-ua-mobile': '?0', 
          'sec-ch-ua-platform': '"macOS"', 
          'sec-fetch-dest': 'empty', 
          'sec-fetch-mode': 'cors', 
          'sec-fetch-site': 'same-origin', 
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36', 
          'x-requested-with': 'XMLHttpRequest'
        },
        data : encData
      };
  
      let response = await axios.request(config);
      let pre_CT_new = response.headers['pre_ct']
      resolve(pre_CT_new)
      // getMcaData(solution, pre_CT_new)
    } catch (error) {
      console.error('Error submitting captcha solution:', error);
      reject(error);
    }
  })
}

