const fs = require('fs');
const Helper = require('./helper.js');

var getSetHeaders = [];
var remoteFunctions = [];
var pageHeaders = [];

generateDefaultCallApi = (headers) => {
	headers = {};
	headers["Content-Type"] = '"application/json"';
	// headers = makeHeadersKeyValue(headers);
	let text = 'defaultCallAPI :: forall a b. Encode a => Decode b => RestEndpoint a b => a -> Flow (APIResult b)\ndefaultCallAPI a = do\n\t';
	let keys = Object.keys(headers);
	let headerText = "";
	keys.forEach(key=>{
		if("Content-Type" != key){
			let localKey = Helper.removeAllSpecialCharacters(key);
			text = text+Helper.initLow(localKey)+' <- get'+Helper.initCap(localKey)+'\n\t';
			getSetHeaders.push(localKey);
		}
		headerText = headerText+'Header "'+key+'" '+headers[key]+"\n\t\t,";
	})
	text = text+'callAPI (Headers [';
	if(headerText.length > 0)
		headerText = headerText.slice(0,headerText.length-1);
	text = text+headerText+']) a';
	pageHeaders.push(text);
}

getRunTimeKeys = () => {
	let text = "module Runtime.Keys where\n\n";
	getSetHeaders.forEach(key=>{
		text = text+initLow(key)+'Key :: String\n'+initLow(key)+'Key = "'+key+'"\n\n';
	})
	fs.writeFile("Types/Keys.purs", text, function(err) {
	    if(err)
	        console.log(err);
	});
}

getLocalStorage = () => {
	let text = 'module Utils.LocalStorage where\n\nimport Data.Maybe (Maybe)\nimport Prelude (Unit)\nimport Presto.Core.Types.Language.Flow (Flow, loadS, saveS)\nimport Runtime.Keys\n\n'
	getSetHeaders.forEach(key=>{
		text = text+'get'+Helper.initCap(key)+' :: Flow (Maybe String)\n'+'get'+Helper.initCap(key)+' = loadS '+initLow(key)+'Key\n\n';
		text = text+'set'+Helper.initCap(key)+' :: String -> Flow Unit\n'+'set'+Helper.initCap(key)+' = saveS '+initLow(key)+'Key\n\n';
	})
	fs.writeFile("Types/LocalStorage.purs", text, function(err) {
	    if(err)
	        console.log(err);
	});
}

makeHeadersKeyValue = (headers) => {
	let keys = Object.keys(headers);
	let header = {}
	keys.forEach(key=>{
		key = removeQuotes(key);
		header[key] = '(fromMaybe "" '+Helper.initLow(Helper.removeAllSpecialCharacters(key))+')';
	})
	header["Content-Type"] = '"application/json"';
	return header;
}

generateRemoteFunctions = (possibleApis,contentJson) => {
	let keys = Object.keys(possibleApis);
	keys.forEach(key=>{
		let text;
		let respName = contentJson[key+"Resp"].response;
		if(possibleApis[key]!="GET"){
			text = Helper.initLow(key)+' :: '+key+'Req -> Flow (APIResult ('+respName+'))\n'+Helper.initLow(key)+' payload = withAPIResult unwrapResponse $ defaultCallAPI payload\n\twhere unwrapResponse ('+key+'Resp {response: x}) = x';
		}
		else{
			text = Helper.initLow(key)+' :: Flow (APIResult ('+respName+'))\n'+Helper.initLow(key)+'  = withAPIResult unwrapResponse $ defaultCallAPI '+key+'Req\n\twhere unwrapResponse ('+key+'Resp {response: x}) = x';	
		}
		remoteFunctions.push(text);
	})
}

writeInFile = () => {
	let finalObject = pageHeaders.concat(remoteFunctions);
	let data = finalObject.join('\n\n\n');
	Helper.createFile("Backend.purs",data);
}

executeSequentialFunctions = (headers,possibleApis,contentJson) => {
	getModuleImports();
	generateDefaultCallApi(headers);
	getWithApiResult();
	generateRemoteFunctions(possibleApis,contentJson);
	writeInFile();
	// getRunTimeKeys();
	// getLocalStorage();
}

removeQuotes = (key) => {
	if((key[0]=='"')||(key[0]=="'"))
		return key.slice(1,key.length-1);
	return key;
}

getWithApiResult = () => {
	let text = 'withAPIResult :: forall a b. (a -> b) -> Flow (APIResult a) -> Flow (APIResult b)\nwithAPIResult f flow = flow >>= either (pure <<< Left) (pure <<< Right <<< f)'
	pageHeaders.push(text);
}

getModuleImports = () => {
	let text = 'module Services.Backend where\n\nimport Data.Either (Either(..), either)\nimport Data.Foreign.Class (class Decode, class Encode)\nimport Data.Maybe (Maybe(..), fromMaybe)\nimport Prelude (bind, pure, ($), (<<<), (>>=))\nimport Presto.Core.Types.API (class RestEndpoint, Header(..), Headers(..))\nimport Presto.Core.Types.Language.Flow (Flow, APIResult, callAPI)\nimport Types.API';
	pageHeaders.push(text);
}

module.exports = {
	executeSequentialFunctions:executeSequentialFunctions
}