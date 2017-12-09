const fs = require('fs');
const readline = require('readline');
const axios = require('axios');
const R = require("ramda");
const apiCode = require('./generateRemoteFunctions.js')
const Helper = require('./helper.js');

var currentProcess;

var instanceObj = [];
var importObj = [];
var typesJson = {};
var availableHeaders = {};
var typesObj = [];
var possibleApiCalls = {};
var repeatedTypes = {};


main = (url,path) => {
	if (fs.existsSync(path)) {
		if(fs.existsSync(url)){
			Helper.setDestinationPath(path);
			Helper.makeAsValidUrl(url,init);
		}
		else{
			console.log("Cannot find File/Directory : "+url);
		}
	}
	else{
		Helper.createDirectories(path);
		main(url,path);
	}
}

init = (json) => {
	if(json.item){
		getImports("API");
		prepareBody(json.item);
		getTypesObj(typesJson);
		let finalObject = (importObj.concat(typesObj)).concat(instanceObj);
		let data = finalObject.join('\n\n\n');
		Helper.createFile("API.purs",data);
		apiCode.executeSequentialFunctions(availableHeaders,possibleApiCalls,typesJson);
	}
	else
		console.log("No Data in collection")
}

getTypesObj = (typeAsJson) => {
	let typesKeys = Object.keys(typeAsJson);
	typesKeys.forEach(key =>{
		let types = 'newtype '+key+' = '+key+'\n\t{';
		getTypesInstance(key);
		let typeJson = typeAsJson[key];
		let jsonKeys = Object.keys(typeJson);
		let constWord = "";
		if(repeatedTypes[key])
			constWord = "NullOrUndefined "
		jsonKeys.forEach(jsonKey =>{
			if(typeJson[jsonKey] != undefined){
				if(typeJson[jsonKey].indexOf(constWord)>=0)
					types = types+'\t'+getTypeKey(jsonKey)+' :: '+typeJson[jsonKey]+'\n\t,';
				else
					types = types+'\t'+getTypeKey(jsonKey)+' :: '+constWord+typeJson[jsonKey]+'\n\t,';
			}
			else
				types = types+'\t'+getTypeKey(jsonKey)+' :: NullOrUndefined String\n\t,';
		})
		types = types.slice(0,(types.length-1));
		types = types+'}';
		typesObj.push(types);
	})
}

getTypeKey = (str) => {
	if(Helper.isInitCap(str))
		return '"'+str+'"';
	return str;
}

prepareBody = (content) => {
	let length = content.length;
	content.forEach(val => {
		if(val.item){
			prepareBody(val.item)
		}
		else{
			let apiInstance  = getApiInstance(val);
		}
	})	
}

loadHeaders = (headers) => {
	if(headers){
		headers.forEach(header=>{
			availableHeaders[header.key] = true;
		})
	}
}

getPath = (apiData) => {
	let path = (R.path(["request","url","path"],apiData))
	if(!path){
		path = (R.path(["request","url"],apiData))
		path = path.split("?")[0].split("}}");
		if(path.length>1){
			path = path[1];
		}
		else{
			path = path[0].split("//");
			if(path.length>1){
				path = [path[1]];
			}
			path = "/"+path[0].split('/').slice(1).join("/");
		}
	}
	else{
		path = "/"+path.join("/")
	}
	return path;
}

getApiInstance = (apiData) => {
	loadHeaders(R.path(["request","header"],apiData));
	let name = apiData.name;
	let method = R.path(["request","method"],apiData);
	let path = getPath(apiData);
	// let query = getQuery(apiData);
	if(name.length > 0)
		name = Helper.initCap(name);
	name = Helper.removeAllSpecialCharacters(name);
	if(possibleApiCalls[name]){
		console.log("Duplicate Api Call Name :",name,"....\n\n","Only One Api Call is consider among those duplicate calls");
		return;
	}
	possibleApiCalls[name] = method;
	let instance = 'instance make'+name+'Req :: RestEndpoint '+name+'Req '+name+'Resp where \n\tmakeRequest reqBody headers = defaultMakeRequest '+method+' (getBaseUrl <> "'+path+'") headers reqBody\n\tdecodeResponse body = defaultDecodeResponse body';
	instanceObj.push(instance);
	getResponseObj(name,apiData.response);
	if(method != "GET"){
		let reqBody = JSON.parse(R.path(["request","body","raw"],apiData));
		getApiTypes(name+"Req",reqBody);
	}
	else{
		let reqName = name+"Req";
		let getReqInstance = 'data '+reqName+' = '+reqName;
		typesObj.push(getReqInstance);
		getTypesInstance(reqName);
	}
}

getResponseObj = (parentName,response) => {
	if(!response)
		response = []
	let name ;
	let isSuccess = false;
	if(response.length>0){
		response.forEach(resp => {
			let name = "";
			if(resp.code=== 200){
				name = parentName+"Resp";
				isSuccess = true;
			}
			else{
				name = parentName+"RespFailure";
			}
			let respObject = {
				status : resp.status,
				code : resp.code ,
				response : JSON.parse(resp.body)
			}
			currentProcess = name;
			getApiTypes(name,respObject);
		})
	}
	if(!isSuccess){
		name = parentName;
		let respObject = {
			status : "Success",
			code : 200,
			response : []
		}
		currentProcess = name;
		getApiTypes(name+"Resp",respObject);
	}
}

initCap = (str) => {
	return str[0].toUpperCase()+str.slice(1)
}

getApiTypes = (name,body) => {
	name = Helper.removeAllSpecialCharacters(name);
	let objectTypes = {"string":"String","number":"Int"}
	let keys = Object.keys(body);
	let types = {};
	if(typesJson[name]){
		types = typesJson[name]
		repeatedTypes[name] = true;
	}
	keys.forEach(key=>{
		if(body[key] != null){
			if((typeof body[key]) === "object"){
				if(body[key].constructor === Array){
					if(body[key].length > 0){
						if((typeof body[key][0]) === "object"){
							if(key === "response"){
								types[key] =currentProcess+'Data'
								getApiTypes(currentProcess+'Data',body[key][0]);
							}
							else{
								types[key] = 'Array '+Helper.initCap(key);
								getApiTypes(Helper.initCap(key),body[key][0]);
							}
						}
						else{
							if(key === "response")
								types[key] = 'Array '+currentProcess+'Data';
							else
								types[key] = 'Array '+objectTypes[typeof body[key][0]];
						}
					}
					else{
						// Todo : Handle for Empty array ... as of now handled as String
						types[key] = 'Array String';
					}
				}
				else if(Object.keys(body[key]).length > 0){
					if(key === "response"){
						types[key] = currentProcess+'Data';
						getApiTypes(currentProcess+'Data',body[key]);
					}
					else{
						types[key] = Helper.initCap(key);
						getApiTypes(Helper.initCap(key),body[key]);
					}
				}
				else{
					// Todo : Handle for empty Objects
					types[key] = 'Array String';
				}
			}
			else{
				if(key === "response")
					types[key] = currentProcess+'Data';
				else
					types[key] = objectTypes[typeof body[key]];
			}
		}
		else{
			if(key === "response")
				types[key] = currentProcess+'Data';
			else
				types[key] = 'NullOrUndefined String';
		}
	})
	typesJson[name] = types;
}

getImports = (moduleName) =>{
	let imports = 'module Types.'+moduleName+' where\n\nimport Prelude\n\nimport Config (getBaseUrl)\nimport Data.Foreign.Class (class Decode, class Encode)\nimport Data.Foreign.NullOrUndefined (NullOrUndefined)\nimport Data.Generic.Rep (class Generic)\nimport Data.Newtype (class Newtype)\nimport Presto.Core.Types.API (class RestEndpoint, Method(POST,GET), defaultDecodeResponse, defaultMakeRequest)\nimport Presto.Core.Utils.Encoding (defaultDecode, defaultEncode)'
	importObj.push(imports);
}

getTypesInstance = (name) => {
	let typesInstance = 'derive instance generic'+name+' :: Generic '+name+' _\ninstance decode'+name+' :: Decode '+name+' where decode = defaultDecode\ninstance encode'+name+' :: Encode '+name+' where encode = defaultEncode';
	instanceObj.push(typesInstance)
}

module.exports = {main : main}