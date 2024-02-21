const fs = require('fs');
const zlib = require("node:zlib");
const cliProgress = require('cli-progress');
const process = require("process");
const os = require('os');

const main = async () => {
	//read xml file from folder files
	console.log('Started....')
	const bar1 = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
	const files = fs.readdirSync('./decode');
	const contentFiles = files.filter((file) => file.indexOf('_content.txt'));
	bar1.start(contentFiles.length, 0);
	//loop through xml file
	try {
		if (!fs.existsSync('./output_decode')) {
			fs.mkdirSync('./output_decode');
		}
		for (let i = 0; i < contentFiles.length; i++) {
			const contentFile = contentFiles[i];
			const content = fs.readFileSync(`./decode/${contentFile}`,{encoding: 'base64'}).toString('utf8');
			const array = content.split('|');
			//create folder files
			const folderPath = `./output_decode/${contentFile.split('_')[0]}`;
			if (!fs.existsSync(folderPath)) {
				fs.mkdirSync(folderPath);
			}
			// console.log('fdafdsf',array)
			let nameOfColection = null;
			for (let j = 0; j < array.length; j++) {
				const row = array[j];
				if(row.includes('HEADER ROW') || row.includes(' ')){
					continue;
				}
				if(row.includes('-')){
					nameOfColection = row;
					continue;
				}
				const fileName = `${folderPath}/${nameOfColection}.txt`;
				const collectionRecordBase64 = row;
				const collectionRecord = zlib.gunzipSync(Buffer.from(String(collectionRecordBase64))).toString('base64');
				fs.writeFileSync(fileName, collectionRecord);
			}
			bar1.update(i + 1);
		}
	}catch (e) {
		console.log(e.message);
	};
	bar1.stop();
	console.log('completed...')
	process.exit();
}

void main();

