<?php

$server_get_url = "https://api.ultracart.com/cgi-bin/UCCheckoutAPIJSON";
$post_data = file_get_contents('php://input');

foreach($_SERVER as $i=>$val) {
//    error_log($i);
//    error_log($val);
    if (strpos($i, 'HTTP_') === 0) {
        $name = str_replace(array('HTTP_', '_'), array('', '-'), $i);
        $header[$name] = $val;
    }
}

$header[] = "Content-Length: ". strlen($post_data);
$header[] = "X-UC-Forwarded-For: " . $_SERVER['REMOTE_ADDR'];

$ch = curl_init( $server_get_url );
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_TIMEOUT, 100);
curl_setopt($ch, CURLOPT_HTTPHEADER, $header);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, FALSE);

if ( strlen($post_data)>0 ){
    curl_setopt($ch, CURLOPT_POSTFIELDS, $post_data);
}

$response = curl_exec($ch);
error_log($response);

if (curl_errno($ch)) {
    print curl_error($ch);
} else {
    curl_close($ch);
    print $response;
}
?>
