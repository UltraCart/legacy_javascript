<?php

$server_get_url = "https://api.ultracart.com/cgi-bin/UCCheckoutAPIJSON";
$post_data = file_get_contents('php://input');

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



$ch = curl_init( $server_get_url );
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $_SERVER['REQUEST_METHOD']);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_TIMEOUT, 100);
curl_setopt($ch, CURLOPT_HTTPHEADER, $header);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, FALSE);
curl_setopt($ch, CURLOPT_VERBOSE, 1);
curl_setopt($ch, CURLOPT_HEADER, 1);
curl_setopt($ch, CURLOPT_ENCODING, 1);


if ( strlen($post_data)>0 ){
    curl_setopt($ch, CURLOPT_POSTFIELDS, $post_data);
}

$response = curl_exec($ch);
error_log($response);


// grab the status code and set the proxy request result to that.
$first_line = '';
$beginning_of_real_http_status = 0; // a index marker for the second http status if the server returns 100 Continue (PUTS/POSTS)
if (strlen($response) > 0) {
    $first_line = substr($response, 0, strpos($response, "\n") - 1);
    $first_line = trim($first_line);

    // Is the first line an HTTP/1.1 100 Continue?
    // If so, search for the next empty line and begin there.
    preg_match("/100\s+Continue/i", $first_line, $output_array);
    if (count($output_array) > 0) {
        // we have an HTTP Continue.  Skip down to the next status code.

        if (preg_match('#^\s*$#m', $response, $matches, PREG_OFFSET_CAPTURE)) {
            $beginning_of_real_http_status = $matches[0][1] + 2;
        }

        $real_headers = explode("\n", substr($response, $beginning_of_real_http_status));
        $first_line = $real_headers[0];
//        $first_line = substr($response, $beginning_of_real_http_status, strpos($response, "\n", $beginning_of_real_http_status) - 1);
        $first_line = trim($first_line);
    }

    //error_log('$first_line:[' . $first_line . ']');
    header($first_line);
}


//error_log('$beginning_of_real_http_status:' . $beginning_of_real_http_status);

if (curl_errno($ch)) {
    print curl_error($ch);
} else {
    $header_size = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $header = substr($response, $beginning_of_real_http_status, $header_size - $beginning_of_real_http_status);
    $response_headers = http_parse_headers($header);
    foreach ($response_headers as $header_key => $header_value) {
        if ($header_key != 'Content-Encoding' && $header_key != 'Vary' && $header_key != 'Connection' && $header_key != 'Transfer-Encoding' && $header_key != 'User-Agent') {
            if ($header_key == 'Content-Length' && $header_value == "0") {
                /* ignore this, it's from an HTTP 1.1 100 Continue and will destroy the result if passed along. */
            } else {
                if (is_array($header_value)) {
                    foreach ($header_value as $val) {
                        //error_log("$header_key: $val");
                        header("$header_key: $val", false);
                    }
                } else {
                    //error_log("$header_key: $header_value");
                    header("$header_key: $header_value", false);
                }

            }
        }
    }
    $body = substr($response, $header_size);
    echo $body;
    curl_close($ch);
}

?>