const fs = require('fs');
const path = require("path");
const convert = require('xml-js');
const { encode, decode } = require('base64-compressor');
const { encodeBinary, decodeBinary } = require('base64-compressor');
const { gunzip } = require("node:zlib");
const zlib = require("node:zlib");
const moment = require("moment");
const cliProgress = require('cli-progress');
const process = require("process");
// const puppeteer = require('puppeteer');
const puppeteer = require('puppeteer-extra');
const Stealth = require('puppeteer-extra-plugin-stealth');
const baseUrl = 'https://micourt.courts.michigan.gov/case-search/court/D29/search?firstName=&middleName=&lastName=PRUN&birthYear=0&caseNumber=&caseYear=0&caseType=&caseStatus=adjudicated&caseStatus=disposed&caseStatus=closed&caseTypeSubCategory=1&filedDateFrom=2023-02-01T17:00:00.000Z&filedDateTo=2024-02-01T17:00:00.000Z&page=1'
puppeteer.use(Stealth())
const main = async () => {
	//read xml file from folder files
	console.log('Started....')
	const bar1 = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
	const files = fs.readdirSync('./xmls');
	const xmlsFiles = files.filter((file) => file.endsWith('.xml'));
	const listCollection = fs.existsSync('list_collection.json')? JSON.parse(fs.readFileSync('list_collection.json')): [];
	//loop through xml file
	const browser = await puppeteer.launch({
		headless: false,
		args: ['--enable-gpu'],
	});
	try {
		for (let i = 0; i < xmlsFiles.length; i++) {
			const rowList = [];
			const xmlFilName = xmlsFiles[i];
			const xmlJsonContent = JSON.parse(convert.xml2json(fs.readFileSync(`xmls/${xmlFilName}`, 'utf8'), {
				compact: true,
				spaces: 4
			}));
			//loop case to take html content
			bar1.start(xmlJsonContent.Root.LeadList.Lead.length, 0);
			for (let j = 0; j < xmlJsonContent.Root.LeadList.Lead.length; j++) {
				const lead = xmlJsonContent.Root.LeadList.Lead[j];
				const lastName = lead.InputValue[0]._text;
				const fileId = lead._attributes.ID;

				const findItemProcessed = listCollection.find((item) => item.fileId === fileId);
				if(findItemProcessed){
					bar1.update(i);
					continue;
				}

				const url = generateUrlByLastName(lastName);
				// When the browser launches, it should have one about:blank tab open.
				const page = await browser.newPage();
				await page.setViewport({ width: 1800, height: 768});
				await page.goto(url, {waitUntil: 'networkidle0'});
				const element = await page.waitForSelector('#continue-button-id');
				await element.click();
				const searchResult = await page.waitForSelector('#total-count-id');
				const htmlContent = await page.content();
				const collection = {
					url: url,
					content: Buffer.from(htmlContent).toString('base64'),
					timestamp: new Date().toISOString(),
					fileId: fileId
				}
				listCollection.push(collection);
				fs.writeFileSync('list_collection.json', JSON.stringify(listCollection));
				bar1.update(i);
			}

			for (let j = 0; j < listCollection.length; j++) {
				const item = listCollection[j];
				const collectionRecord = `<?xml version="1.0" encoding="utf-16"?>
					<CollectionRecord xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
						<Uri>${item.url('&', '&amp;')}</Uri>
						<TimeStamp>${item.timestamp}</TimeStamp>
						<Base64EncodedGZipCompressedContent>${item.content}</Base64EncodedGZipCompressedContent>
					</CollectionRecord>`
				const collectionRecordBase64 = zlib.gzipSync(Buffer.from(String(collectionRecord))).toString('base64');
				const rowData = `${item.fileId}|${moment().format('M/D/YYYY H:mm:ss a').toUpperCase()}|${collectionRecordBase64}`
				rowList.push(rowData);
			}

			//write to file
			//Not sure about this
			if (!fs.existsSync('./output')) {
				fs.mkdirSync('./output');
			}
			const fileName = `./output/${xmlFilName.replace('.xml', '_content.txt')}`
			console.log(fileName);
			if (fs.existsSync(fileName)) {
				fs.unlinkSync(fileName);
			}
			fs.writeFileSync(fileName, rowList.join('\n'));
		}
	}catch (e) {
		console.log('fdasfdsf');
		console.log(e.message);
	}
}

const generateUrlByLastName = (newLastName) => {
	const arr = baseUrl.split('&');
	for (let i = 0 ; i < arr.length ; i++) {
		if(arr[i] && arr[i].includes('lastName')){
			arr[i] = `lastName=${newLastName.trim()} `
		}
	}
	return arr.join('&');
}

void main();

