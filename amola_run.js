//amola_run.js
module.exports = function( targetPath ) {

	var os = require('os');
	var fse = require('fs-extra');
	const path = require('path');

	//Load config file.
	if(!!targetPath)
		targetPath = path.resolve(targetPath);
	else
		targetPath = path.resolve(".");

	var configFile = path.resolve(targetPath, ".amola");
	var config = JSON.parse(fse.readFileSync(configFile));
	
	var outputPath = path.resolve(targetPath, config.output);
	var templatesPath = path.resolve(targetPath, config.template);
	var specificationPath = path.resolve(targetPath, config.spec);
	var intermediateFilePath = path.resolve(targetPath, config.intermediate);
	
	console.log( "config file:", configFile);
	console.log( "output path:", outputPath);
	console.log( "template file path:", templatesPath);
	console.log( "specification path:", specificationPath);
	console.log( "intermediate file path:", intermediateFilePath);
	
	var contents = fse.readFileSync(specificationPath).toString();

	var templates = {};
	templates["init"] = fse.readFileSync(path.resolve(templatesPath, 'init.php')).toString();
	templates["c"] = fse.readFileSync(path.resolve(templatesPath, 'c.php')).toString();
	templates["r"] = fse.readFileSync(path.resolve(templatesPath, 'r.php')).toString();
	templates["u"] = fse.readFileSync(path.resolve(templatesPath, 'u.php')).toString();
	templates["d"] = fse.readFileSync(path.resolve(templatesPath, 'd.php')).toString();


	var lines = contents.split(os.EOL);

	var curTable = "";
	var dbConnectCode = "";
	var auth = "false";
	var showError = "false";
	var onSuccess = "";
	var comment = "";
	var assert = "";
	var extraField = '';
	var groupBy = '';

	lines = lines.map(function(e)
	{ 

		if(e.indexOf("#") == 0)
		{	
			comment = e.replace("#", "");
			return null;
		}
		if(e.indexOf("table:") != -1)
		{		
			curTable = e.split(":")[1];
			return null;
		}
		if(e.indexOf("auth:") != -1)
		{		
			auth = e.split(":")[1];
			return null;
		}
		if(e.indexOf('extraField:') != -1)
		{
			extraField = e.split(":")[1];
			return;
		}
		if(e.indexOf('groupBy:') != -1)
		{
			groupBy = e.split(":")[1];
			return;
		}
		if(e.indexOf("showError:") != -1)
		{		
			showError = e.split(":")[1];
			return null;
		}
		
		if(e.indexOf("onSuccess:") != -1)
		{
			onSuccess = e.split(":")[1];
			return null;
		}
		if(e.indexOf("assert:") != -1)
		{
			assert = e.split(":")[1];
			return null;
		}
		if(e.indexOf("connect:") != -1)
		{	
			dbConnectCode = e.split(":")[1];
			return null;
		}
		else 
		{
			var tokens = e.split("?");


			if(!tokens[0])
				return null;

			
			return {
				dbConnectCode:dbConnectCode,
				table:curTable,
				auth:auth,
				extraField:extraField,
				groupBy:groupBy,
				showError:showError,
				onSuccess:onSuccess,
				assert:assert,
				phpFileName:tokens[0],
				paramStr:tokens[1],
				comment:comment
			};	
		}
	})

	//console.log("File loaded");

	lines = lines.filter(function(e){
		return e != null;
	})

	lines = lines.map(function(e){ 
		var tokens = e.phpFileName.split(".");
		e.apiName = tokens[0];
		e.ext = tokens[1];
		return e;
	})

	lines = lines.map(function(e){ 
		var tokens = e.apiName.split("_");
		switch(tokens[0]) {
			case "get": e.crudType = 'r'; break;
			case "update": e.crudType = 'u'; break;
			case "remove": e.crudType = 'd'; break;
			case "add": e.crudType = 'c'; break;
			default:
				throw new Error("invalid CRUD type. : " + JSON.stringify(e));
			return;
		}
		return e;
	});

	//console.log("API type read complete.");



	lines = lines.map(function(e){

		//console.log(e);
		//console.log("e.paramStr >>>", e.paramStr);
		if(!!e.paramStr){
			e.params = e.paramStr.split("&");
			e.params = e.params.map(function(param) {
				var tokens = param.split("=");
				var name = tokens[0];
				var type = tokens[1];
				//console.log(tokens);



				var required = type.indexOf("*") != -1;
				type = type.replace("*", "");

				var isCondition = type.indexOf("@") != -1;
				type = type.replace("@", "");			

				var isSessionVar = type.indexOf("$") != -1;
				if(!!isSessionVar) {
					var subParam = type.match(/\$:([a-zA-Z0-9]+)/);
					if(!!subParam){
						isSessionVar=subParam[1];
						type=type.replace(subParam[0],"");
					}
					else{
						isSessionVar=name;
						type = type.replace("$", "");
					}
				}

				var isConstant = false;
				var constV = 0;
				if(type.indexOf("const") != -1){
					isConstant = true;
					constV = type.replace("<","").replace(">","").trim().split(":")[1];
					type = "<const>";
				}
				//console.log(e.phpFileName, type, type.indexOf("const"), isConstant);

				return { name : name, type: type, required:required, isCondition:isCondition, isSessionVar:isSessionVar, isConstant:isConstant, constV:constV }
			})
		}else{
			e.params = null;
		}

		return e;
	}); //End of getting parameter information.
	
	fse.writeFileSync(intermediateFilePath, JSON.stringify(lines, null, 4));

	for(var k in lines){

		var info = lines[k];

		var paramGetContext = "";
		var paramCheckContext ="";
		var paramSetTypeContext = "";
		var realEscapeStringTypeContext = "";

		if(!!info.params){
			
			paramGetContext = info.params.filter(function(e){ return !e.isConstant }).map(function(paramInfo){
				if(!paramInfo.isSessionVar)
					return "if(array_key_exists('"+paramInfo.name+"',$_REQUEST))	$"+paramInfo.name+" = $_REQUEST[\""+paramInfo.name+"\"];";
				else
					return "if(array_key_exists('"+paramInfo.isSessionVar+"', $_admin))	$"+paramInfo.name+" = $_REQUEST[\""+paramInfo.name+"\"]" + " = $_admin[\""+paramInfo.isSessionVar+"\"];";
			}).join("\n\t\t");

			paramCheckContext = info.params.filter(function(e){ return e.required && !e.isConstant; }).map(function(paramInfo){
				var name = paramInfo.name;		
				return "if(isset($"+name+")==false) throw new Exception('invalid param <"+name+">', ERROR_INVALID_PARAM);";
			}).join("\n\t\t");

			realEscapeStringTypeContext = info.params.filter(function(e){ return !e.isConstant }).map(function(paramInfo){
				var name = paramInfo.name;
				return "if(isset($"+name+")) $"+name+" = $conn->real_escape_string($"+name+");";
			}).join("\n\t\t");

			paramSetTypeContext = info.params.filter(function(e){ return !e.isConstant }).map(function(paramInfo){
				var name = paramInfo.name;
				if(paramInfo.type == "<int>")
					return "if(isset($"+name+")) settype( $"+name+" , 'integer' );";
				else if(paramInfo.type == "<datetime>")
					return "if(isset($"+name+")) settype( $"+name+" , 'string' );";
				else if(paramInfo.type == "<boolean>")
					return "if(isset($"+name+")) $"+name+" = (($"+name+"==='true')?1:0);";
				else
					return "if(isset($"+name+")) settype( $"+name+" , 'string' );";
			}).join("\n\t\t");

		}
		
		var crudType = info.crudType;
		var text = templates[info.crudType];
		//console.log(info);
		text = text.replace("#DB_CONNECT#", info.dbConnectCode);
		text = text.replace("#GET_PARAMS#", paramGetContext);
		text = text.replace("#PARAM_VALIDATE_CHECK#", paramCheckContext);
		text = text.replace("#PARAM_ESCAPE#", realEscapeStringTypeContext);
		text = text.replace("#PARAM_SET_TYPE#", paramSetTypeContext);
		text = text.replace("#ON_SUCCESS#", (!!info.onSuccess?info.onSuccess:"//NONE ON_SUCCESS"));
		text = text.replace("#ASSERT#", (!!info.assert?info.assert:"//NONE ASSERT"));
		text = text.replace("#AUTH_REQUIRED#", info.auth);
		text = text.replace("#SHOW_ERROR#", showError);
		text = text.replace(/#TABLE#/g, info.table);
		
		var conds = [];
		if(!!info.params){
			conds = info.params.filter(function(e){ return e.isCondition }).map(function(e){ 
				var paramType = e.type.replace("<","").replace(">","")
				if(e.isConstant){
					//console.log(e.phpFileName, e.name);
					return "$conditionList[]=\""+e.name+"='"+e.constV+"'\";";
				}
				return "if(isset($"+e.name+"))\t$conditionList[]=getConditionString( '"+e.name+"', '"+paramType+"'  );";
			});	
		}
		var setCondtionListStr = conds.join(os.EOL+"\t\t");

		switch(crudType){
			case "c":
				var names_and_value = info.params.map(function(e){ 
					if(e.type =="<int>")
						return "if(isset($"+e.name+")){ $names[]=\"`"+e.name+"`\"; $values[]=\"$"+e.name+"\"; }";
					else if(e.type =="<datetime>")
						return "if(isset($"+e.name+")){ $names[]=\"`"+e.name+"`\"; $values[]=\"TIMESTAMP('$"+e.name+"')\"; }";
					else if(e.type =="<password>")
						return "if(isset($"+e.name+")){ $names[]=\"`"+e.name+"`\"; $values[]=\"PASSWORD('$"+e.name+"')\"; }";
					else if(e.type =="<now>")
						return "$names[]=\"`"+e.name+"`\"; $values[]=\"NOW()\"; ";
					else if(e.isConstant)
						return "$names[]=\"`"+e.name+"`\"; $values[]=\"'"+e.constV+"'\"; ";
					else
						return "if(isset($"+e.name+")){ $names[]=\"`"+e.name+"`\"; $values[]=\"'$"+e.name+"'\"; }";

				});			
				
				text = text.replace("#SET_VALUE_NAME_AND_VALUE_ARRAY#", names_and_value.join("\n\t\t"));
			break;

			case "r":
				var selectQuery = "SELECT SQL_CALC_FOUND_ROWS * ";
				
				if(info.extraField != "")
					selectQuery += ", " + info.extraField;

				selectQuery += " FROM `"+info.table+"`";

				var groupByQuery ="";
				if(info.groupBy != "")
					groupByQuery = " GROUP BY "+info.groupBy;

				var totalCountQuery = "SELECT FOUND_ROWS() as num;";
				
				text = text.replace("#TOTAL_COUNT_QUERY#", totalCountQuery);
				text = text.replace(/#SELECT_QUERY#/g, selectQuery);
				text = text.replace(/#GROUP_BY#/g, groupByQuery);
				text = text.replace("#SET_CONDITION_LIST#", setCondtionListStr);
			break;

			case "u":
				var selectQuery = "SELECT * FROM `"+info.table+"`";

				var param_array = info.params.filter(function(e){ return !e.isCondition }).map(function(e){ 
					var paramType = e.type.replace("<","").replace(">","");
					if(e.isConstant)
						return "if(isset($"+e.name+") )\n\t\t\t$params[] = \"`"+e.name+"`="+e.constV+"\";"; 				
					else
						return "if(isset($"+e.name+") || isset($_REQUEST[\""+e.name+"__op\"]) )\n\t\t\t$params[] = getUpdateString(\""+e.name+"\", \""+paramType+"\");"; 				
				});

				text = text.replace(/#SELECT_QUERY#/g, selectQuery);
				text = text.replace("#TABLE#", info.table);
				text = text.replace("#PARAM_ARRAY#", param_array.join("\n\t\t"));
				text = text.replace("#SET_CONDITION_LIST#", setCondtionListStr);

			break;
			case "d":
				var selectQuery = "SELECT * FROM `"+info.table+"`";
				var deleteQuery = "DELETE FROM `"+info.table+"`";
				text = text.replace("#SELECT_QUERY#", selectQuery);
				text = text.replace("#DELETE_QUERY#", deleteQuery);
				text = text.replace("#SET_CONDITION_LIST#", setCondtionListStr);			
			break;
		}

		var generatedFilePath = path.resolve(outputPath, info.phpFileName);
		console.log("Generate: ", generatedFilePath);
		fse.writeFileSync(generatedFilePath, text);
	}

	var generatedFilePath2 = path.resolve(outputPath, "init.php");
	console.log("copy init.php: ", generatedFilePath2);
	fse.writeFileSync(generatedFilePath2, templates["init"]);

	console.log("successfully done");
}
