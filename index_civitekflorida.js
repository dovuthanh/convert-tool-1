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
// const puppeteer = require('puppeteer-core');
const puppeteer = require('puppeteer-extra');
const Stealth = require('puppeteer-extra-plugin-stealth');
puppeteer.use(Stealth())
// const {executablePath} = require('puppeteer')
const antibotbrowser = require("antibotbrowser");
const {timeout} = require("puppeteer-core");
const child_process = require('child_process');
const xmlPath = './xmls/civiteflorida/';
const stateIDs =new Map( [
	['BAKER', '02'],
	['BRADFORD', '04'],
	['CALHOUN', '07'],
	['COLUMBIA', '12'],
	['DESOTO', '14'],
	['DIXIE', '15'],
	['FRANKLIN', '19'],
	['GILCHRIST', '21'],
	['GLADES', '22'],
	['GULF', '23'],
	['HAMILTON', '24'],
	['HARDEE', '25'],
	['HENDRY', '26'],
	['HERNANDO', '27'],
	['HIGHLANDS', '28'],
	['HOLMES', '30'],
	['JACKSON', '32'],
	['JEFFERSON', '33'],
	['LAFAYETTE', '34'],
	['LEVY', '38'],
	['LIBERTY', '39'],
	['MADISON', '40'],
	['MARION', '42'],
	['NASSAU', '45'],
	['OKEECHOBEE', '47'],
	['PASCO', '51'],
	['PUTNAM', '54'],
	['SANTA', '57'],
	['SUMTER', '60'],
	['UNION', '63'],
	['WAKULLA', '65'],
	['WALTON', '66'],
	['WASHINGTON', '67'],
]);
const main = async () => {
	//read xml file from folder files
	console.log('Started....')
	const bar1 = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
	const files = fs.readdirSync(xmlPath);
	const xmlsFiles = files.filter((file) => file.endsWith('.xml'));
	const listCollection = fs.existsSync('list_collection.json')? JSON.parse(fs.readFileSync('list_collection.json')): [];
	//loop through xml file
	// const antibrowser = await antibotbrowser.startbrowser();
	// const browser = await puppeteer.connect({browserWSEndpoint: antibrowser.websokcet});
	let browser = null;
	try {
		browser = await puppeteer.connect({
			browserWSEndpoint: 'ws://127.0.0.1:9222/devtools/browser/78be4fd4-441f-4779-9568-db6c06b3f2f3',
			ignoreHTTPSErrors: true
			// headless: false,
			// args: ['--enable-gpu'],
		});
	}catch (e){
		//not found chrome then start it
		const runGoogle = "/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222 --no-first-run --no-default-browser-check --user-data-dir=$(mktemp -d -t 'chrome-remote_data_dir')";
		const child = child_process.execSync(runGoogle,null, {
			shell: true
		});
		console.log('fdsfasd')
		console.log("stdout: ",child);
	}
	console.log('fdsfasd1212')
	return;
	// const browser = await puppeteer.launch({
	// 	// executablePath: executablePath(),
	// 	headless: false,
	// 	args: ['--auto-open-devtools-for-tabs']
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
			console.log(rootURL);

			//loop case to take html content
			bar1.start(xmlJsonContent.Root.LeadList.Lead.length, 0);
			for (let j = 0; j < xmlJsonContent.Root.LeadList.Lead.length; j++) {
				const lead = xmlJsonContent.Root.LeadList.Lead[j];
				const stateKey = lead.InputValue[0]._text.trim();
				const yearKey = lead.InputValue[1]._text.trim();
				const sequenceKey = lead.InputValue[3]._text.trim();
				const fileId = lead._attributes.ID;
				const stateID = stateIDs.get(stateKey);
				const url = `${rootURL}ocrs/county/${stateID}`;
				const findItemProcessed = listCollection.find((item) => item.fileId === fileId);
				if(findItemProcessed){
					bar1.update(j);
					continue;
				}
				// When the browser launches, it should have one about:blank tab open.
				let page = (await browser.pages())[0];
				await page.setViewport({ width: 1800, height: 768});
				await page.goto(url, {waitUntil: 'networkidle0', timeout: 10000000});
				try {
					const element1 = await page.waitForSelector('button');
					await element1.click();
					await page.waitForNavigation();
					const element2 = await page.waitForSelector('button');
					await element2.click();
					await page.waitForNavigation();
					const lis = await page.$$("form li", {timeout: 300000});
					await lis[1].click();


					const yearType = await page.waitForSelector( '[id="form:search_tab:year"]');
					await yearType.type(yearKey);
					const courtType = await page.waitForSelector( '[id="form:search_tab:cs_court1_input"]');
					await courtType.type('TR');
					const courtLabelType = await page.waitForSelector( '[id="form:search_tab:cs_court1_label"]');
					await courtLabelType.evaluate(element => element.innerText = 'Traffic Infraction (TR)');
					const courtFocusType = await page.waitForSelector( '[id="form:search_tab:cs_court1_focus"]');
					await courtFocusType.evaluate(e => e.setAttribute("aria-activedescendant", "form:search_tab:cs_court1_14"));
					await courtFocusType.evaluate(e => e.setAttribute("aria-describedby", "form:search_tab:cs_court1_14"));
					const sequenceType = await page.waitForSelector( '[id="form:search_tab:seq"]');
					await sequenceType.type(sequenceKey);

					try {
						//cloudflare checkbox
						//try to find checkbox
						const clouflare = await page.waitForSelector('[id="challenge-stage"]', {timeout: 20000});
						const input = await clouflare.waitForSelector('input');
						input.click();
					}catch (e){
						console.log('not found checkbox or autocomplete')
					}
					//wait cloudflare check completed
					const clouflareSuccess = await page.waitForSelector('[id="success-circle"]');
					const searchButton = await page.waitForSelector( '[id="form:j_idt3380"]');
					await searchButton.click();
					await page.waitForNavigation();
					const expandAll = await page.waitForSelector( '[id="form:expand"]');
					await expandAll.click();
					const imageDropdown = await page.waitForSelector( '[id="openCharges"]');
					await imageDropdown.click();
					await page.waitForSelector('[id="form:docketpanel_content"]', {visible: true});
					await page.waitForSelector('[id="form:chargeDetailsTable:0:j_idt7733"]', {visible: true});
				}catch (ex){
					console.log(ex)
					console.log('not found continue button')
					return;
				}
				const htmlContent = await page.content();
				const collection = {
					url: url,
					content: zlib.gzipSync(Buffer.from(String(htmlContent))).toString('base64'),
					timestamp: new Date().toISOString(),
					fileId: fileId
				}
				listCollection.push(collection);
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

