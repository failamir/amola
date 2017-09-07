<?php
	////////////////////////////////////////////////////////////////////////////////////////////////////////////
	// CAUTION : THIS FILE IS GENERATED BY spec.amola
	////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
	require_once './common/init.php';


	$bShowError = #SHOW_ERROR#;
	if($bShowError){
		ini_set('display_errors', 1);
		ini_set('display_startup_errors', 1);
		error_reporting(E_ALL);
	}

	$authRequired = #AUTH_REQUIRED#;

	$resp = array();

	try{

		#DB_CONNECT#

		$conn->begin_transaction();
		
		#ASSERT#
		
		#GET_PARAMS#


		#PARAM_VALIDATE_CHECK#

		#PARAM_ESCAPE#


		#PARAM_SET_TYPE#


		$params = array();
		#PARAM_ARRAY#
		if(count($params) == 0)
			throw new Exception("params required");


		$conditionList = array();
		#SET_CONDITION_LIST#		
		if(count($conditionList)>0)
			$conditionQuery = " WHERE ".implode(" AND ", $conditionList);
		else
			throw new Exception("condition params required");

		$selectQuery = "#SELECT_QUERY#".$conditionQuery;
		$originalData = selectOne($conn, $selectQuery);


		$query = "UPDATE `#TABLE#` SET ".implode(",", $params).$conditionQuery;
		$updated = update($conn, $query);

		if($updated > 0){
			#ON_SUCCESS#
		}

		$resp["success"] = true;
		$resp["updated"] = $updated;

		$conn->commit();

	}catch(Exception $e){

		$conn->rollback();

		$resp["success"] = false;
		$resp["error"] = $e->getMessage();

	}
	echo json_encode($resp);

	if(empty($conn) == false)
		closeDb($conn);
?>
