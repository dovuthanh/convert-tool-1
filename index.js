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

const main = async () => {
	//read xml file from folder files
	console.log('Started....')
	const bar1 = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
	const files = fs.readdirSync('./files');
	const xmlsFiles = files.filter((file) => file.endsWith('.xml'));
	bar1.start(xmlsFiles.length, 0);
	//loop through xml file
	for (let i = 0; i < xmlsFiles.length; i++) {
		const rowList = [];
		const xmlFilName = xmlsFiles[i];
		const xmlJsonContent = JSON.parse(convert.xml2json(fs.readFileSync(`files/${xmlFilName}`, 'utf8'), {compact: true, spaces: 4}));
		for (let j = 0; j <xmlJsonContent.Root.LeadList.Lead.length; j++) {
			const lead = xmlJsonContent.Root.LeadList.Lead[j];
			const fileId = lead._attributes.ID;
			//get html file
			if(fs.existsSync(`./files/${fileId}.htm`)){
				//content
				const htmlFile = fs.readFileSync(`./files/${fileId}.htm`);
				const base64string = zlib.gzipSync(htmlFile);
				//url
				const websiteAddress = fs.readFileSync(`./files/${fileId}.txt`).toString();
				const collectionRecord =  `<?xml version="1.0" encoding="utf-16"?>
				<CollectionRecord xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
					<Uri>${websiteAddress.replaceAll('&','&amp;')}</Uri>
					<TimeStamp>${new Date().toISOString()}</TimeStamp>
					<Base64EncodedGZipCompressedContent>${base64string.toString('base64')}</Base64EncodedGZipCompressedContent>
				</CollectionRecord>`
				const collectionRecordBase64 = zlib.gzipSync(Buffer.from(String(collectionRecord))).toString('base64');
				const rowData = `${fileId}|${moment().format('MM/DD/YYYY HH:mm:ss a').toUpperCase()}|${collectionRecordBase64}`
				rowList.push(rowData);
			}
		}

		//write to file
		//Not sure about this
		if (!fs.existsSync('./output')){
			fs.mkdirSync('./output');
		}
		const fileName = `./output/${xmlFilName.replace('.xml','.out')}`
		if(fs.existsSync(fileName)){
			fs.unlinkSync(fileName);
		}
		const writeStream = fs.createWriteStream(fileName);
		rowList.forEach(value => writeStream.write(`${value}\n`));
		writeStream.end();
		bar1.update(i+1);
	}
	bar1.stop();
	console.log('completed...')
	process.exit();
}

void main();

