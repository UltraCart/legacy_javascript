<?php

$server_get_url = "https://api.ultracart.com/cgi-bin/UCCheckoutAPIJSON";
$post_data = file_get_contents('php://input');

$proxy_version = "1.337";

// Set this variable to true if you want to troubleshoot output in the PHP error_log location
// The location of this log file is dependant on your php.ini file.  Check the location with the phpinfo function.
$proxyDebug = false;

if ($proxyDebug) error_log("$_SERVER[REQUEST_URI]");

function http_parse_headers($header)
{
    $retVal = array();
    $fields = explode("\r\n", preg_replace('/\x0D\x0A[\x09\x20]+/', ' ', $header));
    foreach ($fields as $field) {
        if (preg_match('/([^:]+): (.+)/m', $field, $match)) {
            $match[1] = preg_replace('/(?<=^|[\x09\x20\x2D])./e', 'strtoupper("\0")', strtolower(trim($match[1])));
            if (isset($retVal[$match[1]])) {
                $retVal[$match[1]] = array($retVal[$match[1]], $match[2]);
            } else {
                $retVal[$match[1]] = trim($match[2]);
            }
        }
    }
    return $retVal;
}


foreach ($_SERVER as $i => $val) {
    if (strpos($i, 'HTTP_') === 0) {
        if ($i == 'HTTP_X_UC_MERCHANT_ID') {
            $header[] = "X-UC-Merchant-Id: $val";
        } else if ($i == 'HTTP_X_UC_SHOPPING_CART_ID') {
            $header[] = "X-UC-Shopping-Cart-Id: $val";
        } else {
            $name = str_replace(array('HTTP_', '_'), array('', '-'), $i);
            $header[] = "$name: $val";
        }
    }
}

if (isset($_SERVER['CONTENT_TYPE'])) {
    $content_type = $_SERVER['CONTENT_TYPE'];
} else {
    $content_type = 'application/json';
}

$header[] = "Content-Type: " . $content_type;
$header[] = "Content-Length: " . strlen($post_data);
$header[] = "X-UC-Forwarded-For: " . $_SERVER['REMOTE_ADDR'];
$header[] = "X-UC-Proxy-Version: " . $proxy_version;
// Force curl to send an empty Expect header on the request to prevent it form sending an Expect 100 (StackOverflow FTW)
$header[] = "Expect: ";

if($proxyDebug){
    error_log("headers to server follow:");
    foreach($header as $hdr){
        error_log($hdr);
    }
}

$ch = curl_init($server_get_url);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $_SERVER['REQUEST_METHOD']);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_TIMEOUT, 100);
curl_setopt($ch, CURLOPT_HTTPHEADER, $header);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, FALSE);
curl_setopt($ch, CURLOPT_VERBOSE, 1);
curl_setopt($ch, CURLOPT_HEADER, 1);
curl_setopt($ch, CURLOPT_ENCODING, 1);


if (strlen($post_data) > 0) {
    curl_setopt($ch, CURLOPT_POSTFIELDS, $post_data);
}

$response = curl_exec($ch);

if ($proxyDebug) error_log("start response ===========================================");
if ($proxyDebug) error_log("start raw response ===============");
if ($proxyDebug) error_log($response);
if ($proxyDebug) error_log("end raw response ===============");


// Trim off HTTP 100 response headers if they exist
$delimiter = "\r\n\r\n"; // HTTP header delimiter
while (preg_match('#^HTTP/[0-9\\.]+\s+100\s+Continue#i', $response)) {
    $tmp = explode($delimiter, $response, 2); // grab the 100 Continue header
    $response = $tmp[1]; // update the response, purging the most recent 100 Continue header
} // repeat

// now we just have the normal header and the body
$parts = explode($delimiter, $response, 2);
$header = $parts[0];
$body = $parts[1];

// grab the status code and set the proxy request result to that.
$first_line = '';
if (strlen($response) > 0) {
    $first_line = substr($response, 0, strpos($response, "\n") - 1);
    $first_line = trim($first_line);

    if ($proxyDebug) error_log('$first_line:[' . $first_line . ']');
    header($first_line);
}


if (curl_errno($ch)) {
    print curl_error($ch);
    curl_close($ch);
} else {
    // We're through with curl at this point.  Close it out as soon as possible
    curl_close($ch);

    // Send the rest of the headers that we are interested in
    $response_headers = http_parse_headers($header);
    foreach ($response_headers as $header_key => $header_value) {
        if ($header_key != 'Content-Encoding' && $header_key != 'Vary' && $header_key != 'Connection' && $header_key != 'Transfer-Encoding' && $header_key != 'User-Agent') {
            if ($header_key == 'Content-Length' && $header_value == "0") {
                /* ignore this, it's from an HTTP 1.1 100 Continue and will destroy the result if passed along. */
            } else if ($header_key == 'Content-Length') {
                // Skip sending the content length header because the upstream response could have been gziped
                if ($proxyDebug) error_log("Skip sending client header - $header_key: $header_value");
            } else {
                if (is_array($header_value)) {
                    foreach ($header_value as $val) {
                        if ($proxyDebug) error_log("$header_key: $val");
                        header("$header_key: $val", false);
                    }
                } else {
                    if ($proxyDebug) error_log("$header_key: $header_value");
                    header("$header_key: $header_value", false);
                }

            }
        } else {
            if ($proxyDebug) error_log("Skip sending client header - $header_key: $header_value");
        }
    }
    if ($proxyDebug) error_log("Outputting body");
    if ($proxyDebug) error_log(strlen($body));
    // Send the body
    echo $body;
}
if ($proxyDebug) error_log("end response ===========================================");

?>