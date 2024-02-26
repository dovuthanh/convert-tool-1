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
const puppeteer = require('puppeteer');
const child_process = require('child_process');
// const url = require("url");
const xmlPath = './xmls/FLAGLER/';
const main = async () => {
	//read xml file from folder files
	console.log('Started....')
	const bar1 = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
	const files = fs.readdirSync(xmlPath);
	const xmlsFiles = files.filter((file) => file.endsWith('.xml'));
	const listCollection = fs.existsSync('list_collection.json')? JSON.parse(fs.readFileSync('list_collection.json')): [];
	let browser = null;
	try {
		browser = await puppeteer.connect({
			browserWSEndpoint: 'ws://127.0.0.1:9222/devtools/browser/3bfb10a8-9e0c-4e1e-8171-3f5aad2eda45',
			ignoreHTTPSErrors: true
			// headless: false,
			// args: ['--enable-gpu'],
		});
	}catch (e){
		//not found chrome then start it
		// const runGoogle = "/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222 --no-first-run --no-default-browser-check --user-data-dir=$(mktemp -d -t 'chrome-remote_data_dir')";
		// const child = child_process.execSync(runGoogle,null, {
		// 	shell: true
		// });
		// console.log('fdsfasd')
		// console.log("stdout: ",child);
	}
	// browser = await puppeteer.launch({
	// 	// executablePath: executablePath(),
	// 	headless: false,
	// 	args: [
	// 		'--disable-web-security',
	// 		'--disable-features=IsolateOrigins,site-per-process'
	// 	]
	// })
	try {
		for (let i = 0; i < xmlsFiles.length; i++) {
			const rowList = [];
			const xmlFilName = xmlsFiles[i];
			const xmlJsonContent = JSON.parse(convert.xml2json(fs.readFileSync(`${xmlPath}${xmlFilName}`, 'utf8'), {
				compact: true,
				spaces: 4
			}));

			const rootURL = xmlJsonContent.Root.Navigation.InitialNavigation.Page._attributes.SourceUri;

			//loop case to take html content
			bar1.start(xmlJsonContent.Root.LeadList.Lead.length, 0);
			const max = 2;//xmlJsonContent.Root.LeadList.Lead.length;
			for (let j = 0; j < max; j++) {
				const lead = xmlJsonContent.Root.LeadList.Lead[j];
				const caseSearch = lead._attributes.CaseKey.trim();
				const fileId = lead._attributes.ID;
				const findItemProcessed = listCollection.find((item) => item.fileId === fileId);
				if(findItemProcessed){
					bar1.update(j);
					continue;
				}
				// When the browser launches, it should have one about:blank tab open.
				let page = (await browser.pages())[0];
				console.log(rootURL);
				await page.setViewport({ width: 1800, height: 768});
				await page.goto(rootURL, {waitUntil: 'networkidle0', timeout: 10000000});

				try {
					const radio = await page.waitForSelector('[searchtype="CaseNumber"]');
					await radio.click();
					const caseNumber = await page.waitForSelector('[id="caseNumber"]');
					await caseNumber.type(caseSearch);
					const btnSearch = await page.waitForSelector('[id="searchButton"]');
					await btnSearch.click();
					await page.waitForNavigation();
					const htmlContent = await page.content();
					//take curren page
					const collection = {
						url: page.url(),
						content: zlib.gzipSync(Buffer.from(String(htmlContent))).toString('base64'),
						timestamp: new Date().toISOString(),
						fileId: fileId,
					}
					await page.waitForTimeout(2000);
					const result = await page.$eval('#gridParties', e => ({
						url: e.querySelector("a").href
					}));
					console.log(result);
					await page.goto(result['url'], {waitUntil: 'networkidle0', timeout: 10000000});
					await page.waitForSelector('[id="mainTableContent"]');
					const htmlContentChild = await page.content();
					collection.children = {
						url: page.url(),
						content: zlib.gzipSync(Buffer.from(String(htmlContentChild))).toString('base64'),
						timestamp: new Date().toISOString(),
						fileId: fileId,
					}
					listCollection.push(collection);
					try {
						//take child form
					}catch (e){
						console.log(e);
						console.log('not found checkbox or autocomplete')
						return;
					}
				}catch (ex){
					console.log(ex)
					console.log('not found continue button')
					return;
				}
				fs.writeFileSync('list_collection.json', JSON.stringify(listCollection));
				bar1.update(j);
			}

			for (let j = 0; j < listCollection.length; j++) {
				const item = listCollection[j];
				const collectionRecord = `
<?xml version="1.0" encoding="utf-16"?>
<CollectionRecord xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
<Uri>${item.url.replace('&', '&amp;')}</Uri>
<TimeStamp>${item.timestamp}</TimeStamp>
<Base64EncodedGZipCompressedContent>${item.content}</Base64EncodedGZipCompressedContent>
<Children>
<CollectionRecord>
<Uri>${item.children.url}Uri>
<TimeStamp>${item.children.timestamp}</TimeStamp>
<Base64EncodedGZipCompressedContent>${item.children.content}</Base64EncodedGZipCompressedContent>
</CollectionRecord>
</Children>
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
		console.log('completed successfully')
	}catch (e) {
		console.log('fdasfdsf');
		console.log(e.message);
	}
	process.exit(0);
}

void main();

