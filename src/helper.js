const fs = require('fs');
var destinationPath = "";

setDestinationPath = (path) =>{
	destinationPath = path;
}

createDirectories = (dirPath) => {
	let paths = dirPath.split('/');
	let path = "";
	for(let i=0;i<paths.length;i++){
		if(paths[i].length>0){
			path = path+"/"+paths[i];
			repeatUntilSync(path);
		}
	}
}

repeatUntilSync = (path) => {
	if(!fs.existsSync(path)){
		fs.mkdirSync(path);
		repeatUntilSync(path);
	}
}

makeAsValidUrl = (filePath,callback) => {
	let res = filePath.split('.');
	if(res[res.length-1]==="json"){
		callback(require(filePath));
	}
	else{
		let newFilePath = filePath+'.json';
		fs.rename(filePath, newFilePath, function(err) {
		    if ( err )
		    	console.log('ERROR: ' + err);
		    else
		    	callback(require(newFilePath));
		});
	}
}

initLow = (str) => {
	return str[0].toLowerCase()+str.slice(1)
}

initCap = (str) => {
	return str[0].toUpperCase()+str.slice(1)
}

removeAllSpecialCharacters = (str) => {
	return str.replace(/[^a-zA-Z ]/g, " ").replace(/\s+/g,' ').trim().split(' ').join('');
}

isInitCap = str =>{
	return str[0]===str[0].toUpperCase()
}

createFile = (filename,data) => {
	fs.writeFile(destinationPath+"/"+filename, data, function(err) {
	    if(err)
	        console.log(err);
	    else
	    	console.log("File created successfully : ",destinationPath+"/"+filename);
	});
}

module.exports = {	initLow : initLow
				,	initCap : initCap
				,	removeAllSpecialCharacters: removeAllSpecialCharacters
				,	isInitCap : isInitCap
				,	createFile : createFile
				,	setDestinationPath : setDestinationPath
				,	makeAsValidUrl : makeAsValidUrl
				,	createDirectories : createDirectories
				}