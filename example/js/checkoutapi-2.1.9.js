// Change log
// 2.1.9 Added method to remove an item at an index instead of by item id.  This will
// prevent the removal of other items by the same item id.  Also, the add items will
// now compare the existing items and if the items match based on item id *AND* options,
// then the quantity is incremented instead of creating a separate line item.
//
// 2.1.8 This change came direct from Capital Media.  Here's their change log:
//We've modified version 2.1.7 of the API so that field IDs are no longer
//hard-coded. This meant modifying the ucPopulateFieldElements function so
//that it would accept the config variable as a parameter. This change should
//be backwards compatible, and would makes sense to incorporate in version
//2.1.8 of the API. Here are the changes:
//
//*Line 639:*
//Passing *config* as a parameter to ucPopulateFieldElements
//
//*Line 718:*
//Updated ucPopulateFieldElements to accept *config* as a parameter
//
//*Line 727:*
//Using config.cartFieldMapping, rather than a hard coded string in
//getElementById
//
//*Line 740:*
//Using config.cartFieldMapping, rather than a hard coded string in
//getElementById
//
//*Line 750:*
//Using config.cartFieldMapping, rather than a hard coded string in
//getElementById
//
//*Line 758:*
//Using config.cartFieldMapping, rather than a hard coded string in
//getElementById
//
// 2.1.7 Added header caching statement to ajax call to prevent iPad from caching getCart calls.
// 2.1.6 fixed incorrect field name on lastShippingEstimate.  (Thanks Capital Media!)
// 2.1.5 replaced jQuery-json plugin with Crockford's json2.js implementation.  The new implementation should be faster given the
// native use if available.
// 2.1.4 Fix for applyGiftCertificate().  It was not updating the internal cart variable with the return value
// 2.1.3 Added an override to the return parameter used in checkout(). If there are errors, we were just redirecting back
//       to document.URL.  But, if the page uses query parameters to add product on the initial load, we don't want that url
//       to be redisplayed, adding more product.
// Example Usage: ultraCart.init({thisPageUrl: location.protocol + '//' + location.hostname + location.pathname}); // there would normally be other config parameters here...
// 2.1.2 Added a config option to disable shipping calls for those carts that are virtual only.  The config option is 'disableShippingCalls'
// 2.1.1 Added a check in ucPopulateFieldElements to see if the credit card types is a select box or not.  some recent
// sites are getting fancy with the card types and don't use a drop down.  If that's the case, the card type logic is
// skipped over.
// 2.1.0
// Bug fixes.  Most importantly, updateCart now precedes the call to estimateShipping in
// ucUpdateShippingMethodsForAddressChange()
// Also, set flag doNotNotify during the cart update after saving off the email.  Before, saving off the email was
// firing a cart change which was making a useless call to estimateShipping
//
// 2.0.12
// added setAffiliateId(cart, affiliateId, subId) the API
// added the array prototypes needed to shove countries to the top of the list so US or Canada can appear at the top of an otherwise alphabetical listing.
// getParameter() and getParameterValue() are now case-insensitive
// 2.0.11
// added config section 'parameter mapping' to allow query parameters to map to cart objects.  useful for affiliate tracking.
// 2.0.10
// added config.useCheapestShipping to select the first shipping method in the list (allows for hiding of shipping choices altogether
// 2.0.9
// Removed cache prevention on the installation check.  wasn't needed.
// 2.0.8
// saveFieldElements: changed the checkbox behavior to avoid getting 'undefined' as a value.
// added check for correct configuration in the case of null carts.


// Add String helper method to the string object to make life easier.
if (typeof String.prototype.trim === 'undefined') {
  String.prototype.trim = function () {
    return this.replace(/^\s+|\s+$/g, '');
  };
}
if (typeof String.prototype.startsWith === 'undefined') {
  String.prototype.startsWith = function (str) {
    return (this.indexOf(str) === 0);
  };
}
if (typeof String.prototype.endsWith === 'undefined') {
  String.prototype.endsWith = function (str) {
    return (this.length - str.length) == this.lastIndexOf(str);
  }
}

if (typeof Array.prototype.findIndex === 'undefined') {
  Array.prototype.findIndex = function (value) {
    var ctr = "";
    for (var i = 0; i < this.length; i++) {
// use === to check for Matches. ie., identical (===), ;
      if (this[i] == value) {
        return i;
      }
    }
    return ctr;
  };
}


if (typeof Array.prototype.move === 'undefined') {
  Array.prototype.move = function (pos1, pos2) {
    // local variables
    var i, tmp;
    // cast input parameters to integers
    pos1 = parseInt(pos1, 10);
    pos2 = parseInt(pos2, 10);
    // if positions are different and inside array
    if (pos1 !== pos2 && 0 <= pos1 && pos1 <= this.length && 0 <= pos2 && pos2 <= this.length) {
      // save element from position 1
      tmp = this[pos1];
      // move element down and shift other elements up
      if (pos1 < pos2) {
        for (i = pos1; i < pos2; i++) {
          this[i] = this[i + 1];
        }
      }
      // move element up and shift other elements down
      else {
        for (i = pos1; i > pos2; i--) {
          this[i] = this[i - 1];
        }
      }
      // put element from position 1 to destination
      this[pos2] = tmp;
    }
  }
}


var ultraCart;
ultraCart = (function () {

  var ULTRACART_SITE = "secure.ultracart.com";
  var ULTRACART_ERROR_PARAM = 'ucError';
  var SHIPPING_ADDRESS_IS_PRIORITY = 'shipping';
  var BILLING_ADDRESS_IS_PRIORITY = 'billing';

  var checkoutSite = ULTRACART_SITE;
  var thisPageUrl = document.URL; // default.
  var merchantId = "";
  var version = "1.1";  //server side, not client.  this might not match version number in this file's name.
  var remoteApiUrl = "https://" + ULTRACART_SITE + "/cgi-bin/UCCheckoutAPIJSON";
  var debugMode = false;  // if you have trouble reading some of the logging, copy the json log output and visit jsbeautifier.org to pretty it up.
  var verboseAjax = false;
  var updateShippingOnAddressChange = false;
  var screenBrandingThemeCode = null;
  var shippingCountries = null;
  var billingCountries = null;
  var noBillingFieldsOnPage = false;
  var isCheckoutPage = false;
  var disableShippingCalls = false;

  var addressPriority = SHIPPING_ADDRESS_IS_PRIORITY;


  // Global cart variable
  var cart = null;

  // Shipping methods variable
  var shippingMethods = null; // an array of the current shipping methods available and their price
  var shippingChoice = null;  // the shipping choice currently selected. this is a transient variable and not stored anywhere
  var lastShippingEstimate = {
    shipToAddress1: null,
    shipToAddress2: null,
    shipToCity: null,
    shipToState: null,
    shipToPostalCode: null,
    shipToCountry: null
  };
  var cartFieldMap = {
    shipToAddress1: null, shipToAddress2: null, shipToCity: null, shipToCompany: null, shipToCountry: null, shipToEveningPhone: null, shipToFirstName: null,
    shipToLastName: null, shipToPhone: null, shipToPostalCode: null, shipToResidential: null, shipToState: null, shipToTitle: null, email: null,

    billToAddress1: null, billToAddress2: null, billToCity: null, billToCompany: null, billToCountry: null, billToDayPhone: null, billToEveningPhone: null,
    billToFirstName: null, billToLastName: null, billToPostalCode: null, billToState: null, billToTitle: null,

    creditCardExpirationMonth: null,
    creditCardExpirationYear: null,
    creditCardNumber: null,
    creditCardType: null,
    creditCardVerificationNumber: null,
    purchaseOrderNumber: null,
    mailingListOptIn: null,

    customField1: null, customField2: null, customField3: null, customField4: null, customField5: null, customField6: null, customField7: null
  };

  // Background timer
  var updateCartTimer;

  function getCart() {
    return cart;
  }


  // Static data used by the getStateProvinces() and getStateProvinceCodes()
  var ucStateProvinces = [
    {
      'country': 'United States',
      'stateProvinces': ["Alabama", "Alaska", "American Samoa", "Arizona", "Arkansas", "Armed Forces Africa", "Armed Forces Americas", "Armed Forces Canada", "Armed Forces Europe", "Armed Forces Middle East", "Armed Forces Pacific", "California", "Colorado", "Connecticut", "Delaware", "District of Columbia", "Federated States of Micronesia", "Florida", "Georgia", "Guam", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Marshall Islands", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Northern Mariana Islands", "Ohio", "Oklahoma", "Oregon", "Palau", "Pennsylvania", "Puerto Rico", "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virgin Islands", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming"],
      'codes': ["AL", "AK", "AS", "AZ", "AR", "AE", "AA", "AE", "AE", "AE", "AP", "CA", "CO", "CT", "DE", "DC", "FM", "FL", "GA", "GU", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MH", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "MP", "OH", "OK", "OR", "PW", "PA", "PR", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VI", "VA", "WA", "WV", "WI", "WY"]
    },
    {
      'country': 'Canada',
      'stateProvinces': ["Alberta", "British Columbia", "Manitoba", "New Brunswick", "Newfoundland", "Northwest Territories", "Nova Scotia", "Nunavut", "Ontario", "Prince Edward Island", "Quebec", "Saskatchewan", "Yukon Territory"],
      'codes': ["AB", "BC", "MB", "NB", "NF", "NT", "NS", "NU", "ON", "PE", "QC", "SK", "YT"]
    }
  ];

  /**
   * This method makes the actual call to the remote server.
   * @param functionName name of the remote function to execute
   * @param params remote function parameters
   * @param opts optional ucRemoteCall options
   *  OPTIONS:
   *  async=true/false => if true, method is executed async
   *  onComplete=callback => if true, this callback will be run on completion.
   *  (the next two are mostly used internal to make sure the cart varaible is kept up to date.  I doubt whoever reads this will need to make use of them.)
   *  cartChange=true/false => if true, before onComplete runs, a cart will be checked for in result and internal variable set if possible
   *  resultIsCart => if true, the cart assignment will be cart = result instead of cart = result.cart.  (inconsistent legacy API...)
   */
  function ucRemoteCall(functionName, params, opts) {
    var result = null;

    if (debugMode && verboseAjax) {
      ucLogInfo('ucRemoteCall functionName:' + functionName);
      for (var p in params) {
        if (params.hasOwnProperty(p)) {
          ucLogDebug('ucRemoteCall param[' + p + "]=" + params[p]);
        }
      }
    }


    // jsonify all the parameters.  if we don't, jquery will take our cart object and create numerous parameters for each property.  not desired.
    // won't need to do this with the upcoming REST API
    for (var prop in params) {
      if (params.hasOwnProperty(prop)) {
        params[prop] = JSON.stringify(params[prop]);
      }
    }

    // add the function name and meta data to the params for remote execution
    params['functionName'] = functionName;
    params['merchantId'] = merchantId;
    params['version'] = version;

    // Do we want async?
    var async = false;
    var onComplete;
    var cartChange = false;
    var resultIsCart = false;

    if (opts != undefined && opts.async != undefined) {
      if (debugMode && verboseAjax) {
        ucLogDebug("ucRemoteCall: executing async");
      }
      async = opts.async;
    }
    if (opts && opts.onComplete) {
      onComplete = opts.onComplete;
      ucLogDebug("ucRemoteCall: onComplete method provided.");
    }
    cartChange = (opts && opts.cartChange);
    resultIsCart = (opts && opts.resultIsCart);

    jQuery.ajax(
            {
              url: remoteApiUrl,
              async: async,
              cache: false,
              headers: { "cache-control": "no-cache" },
              dataType: 'json',
              global: true,
              data: params,
              type: 'POST',
              success: function (jsonResult) {
                // Store the result into our variable.
                if (debugMode && verboseAjax) {
                  ucLogDebug("ucRemoteCall: success");
                }
                result = jsonResult;

                // Call their function
                if (async) {
                  if (cartChange && result != null) {
                    // there are two ways a cart can come back.  need to check for the expected result and handle.
                    if (resultIsCart) {
                      ucSetCart(result, opts && opts.doNotNotify);
                    } else if (result.cart != null) {
                      ucSetCart(result.cart);
                    }
                  }
                  if (onComplete != undefined) {
                    ucLogDebug("ucRemoteCall: calling onComplete now.");
                    onComplete(result);
                  }
                }
              },
              error: function (xhr, textStatus, errorThrown) {
                if (debugMode && verboseAjax) {
                  var errMsg = '';
                  if (textStatus) {
                    errMsg += textStatus;
                  }
                  if (errorThrown) {
                    errMsg += '[errorThrown=' + errorThrown + "]";
                  }
                  ucLogError("ajax call failed:" + errMsg);
                }
              }
            });

    return result;
  }

  /**
   * This method makes a request to the remote server and sends to arguments, expecting a ping message back.
   * @return true if connection was made, false if otherwise.
   */
  function pingRemoteServer() {
    var result = false;

    if (debugMode && verboseAjax) {
      ucLogInfo('Begin Connection Test');
    }

    var async = false;

    jQuery.ajax(
            {
              url: remoteApiUrl,
              async: async,
//          cache: false,
              dataType: 'json',
              global: true,
              type: 'GET',
              success: function (jsonResult) {
                // Store the result into our variable.
                if (debugMode && verboseAjax) {
                  ucLogDebug("ucRemoteCall: success");
                }

                if (jsonResult) {
                  result = (jsonResult && jsonResult.result);
                  if (debugMode) {
                    ucLogInfo("The Remote Server Connection Test returned the following:");
                    ucLogInfo(jsonResult.welcomeMessage);
                    ucLogInfo(jsonResult.helpMessage);
                    ucLogInfo(jsonResult.additionalInformation);
                  }
                }
              },
              error: function (xhr, textStatus, errorThrown) {
                if (debugMode && verboseAjax) {
                  var errMsg = '';
                  if (textStatus) {
                    errMsg += textStatus;
                  }
                  if (errorThrown) {
                    errMsg += '[errorThrown=' + errorThrown + "]";
                  }
                  ucLogError("ajax call failed:" + errMsg);
                }

                result = false;
              }
            });

    if (debugMode && verboseAjax) {
      ucLogInfo('End Connection Test');
    }

    return result;
  }


  /**
   * retrieves a shopping cart object from the remote server
   * @param opts optional ucRemoteCall options(async=true/false,onComplete=callback)
   * @return cart object
   */
  function ucCreateCart(opts) {
    return ucRemoteCall('createCart', {}, opts);
  }


  /**
   * retrieves a shopping cart object from the remote server using a cartId from cookie
   * @param cartId string, cart id for current customer
   * @param opts optional ucRemoteCall options(async=true/false,onComplete=callback)
   * @return cart object
   */
  function ucGetCart(cartId, opts) {
    return ucRemoteCall('getCart', { 'parameter1': cartId}, opts);
  }

  /**
   * updates the local cart instance with a server version.  many api calls affect the cart and
   * the updated cart is the return value.  Those api calls will call ucSetCart() to synchronize the
   * local cart object with the server.
   * @param updatedCart
   */
  function ucSetCart(updatedCart, doNotNotify) {
    // Let's make sure we have a valid cart object.
    if (updatedCart == null || updatedCart.cartId == null) {
      return;
    }
    cart = updatedCart;
    if (!doNotNotify) {
      cartTarget.fire(EVENT_CART_CHANGE);
    }
  }


  /**
   * some credit card information can lose type during the json process. This method fixes that.
   */
  function ucSanitizeDataTypes() {
    try {
      // Make sure the integer fields are actually set as a number of serialization purposes
      if (cart && cart.creditCardExpirationMonth !== 'undefined' && typeof cart.creditCardExpirationMonth === 'string') {
        cart.creditCardExpirationMonth = isNaN(cart.creditCardExpirationMonth) ? 0 : parseInt(cart.creditCardExpirationMonth);
      }

      if (cart && cart.creditCardExpirationYear !== 'undefined' && typeof cart.creditCardExpirationYear === 'string') {
        cart.creditCardExpirationYear = isNaN(cart.creditCardExpirationYear) ? 0 : parseInt(cart.creditCardExpirationYear);
      }
    } catch (e) {
    }
  }


  /**
   * pushes changes from the local cart up to the server.
   * @param opts optional ucRemoteCall options(async=true/false,onComplete=callback)
   */
  function updateCart(opts) {
    ucLogDebug("updateCart()");
    backgroundTimer(false);

    ucSanitizeDataTypes();
    if (opts && opts.async) {
      opts.cartChange = true;
      opts.resultIsCart = true;
    }

    // if async, be sure to set the cart.
    var result = ucRemoteCall('updateCart', { 'parameter1': cart}, opts);
    if (result != null) {
      ucSetCart(result, opts && opts.doNotNotify);
    }

    return cart;
  }


  /**
   * used to save any user input changes to the server.  This method uses the local cart to
   * update the server, but does not touch the local cart to avoid stomping on anything since
   * this method is called via a timer.
   * @param opts optional ucRemoteCall options(async=true/false,onComplete=callback)
   */
  function ucBackgroundUpdateCart(opts) {
    ucSanitizeDataTypes();
    ucRemoteCall('backgroundUpdateCart', { 'parameter1': cart}, opts);
  }


  /**
   * turns the background update on and off
   * @param status true starts the timer, false turns it off.
   */
  function backgroundTimer(status) {
    ucLogDebug("backgroundTime(" + status + ")");
    if (status) {
      window.clearTimeout(updateCartTimer);
      try {
        updateCartTimer = window.setTimeout("ucBackgroundUpdateCart({'async': true})", 2500);
      } catch (e) {
      }
    } else {
      try {
        window.clearTimeout(updateCartTimer);
      } catch (e) {
      }
    }
  }


  /**
   * this method should be called first, every time.  It sets up the cart configuration and creates a local
   * copy of the cart.
   * @param config (debugMode, verboseAjax, checkoutSite, remoteApiUrl )
   */
  function init(config) {
    if (config.debugMode) {
      debugMode = true;
      ucInitConsole();
      ucLogInfo("init: debugMode->" + config.debugMode);
    }

    if (config.verboseAjax) {
      verboseAjax = true;
      ucLogInfo("init: verboseAjax->" + config.verboseAjax);
    }

    if (config.merchantId) {
      merchantId = config.merchantId;
    } else {
      ucLogError("Fatal Condition: config.merchantId is a required config value to init is was not found.  Nothing further will work.");
    }

    if (config.screenBrandingThemeCode) {
      screenBrandingThemeCode = config.screenBrandingThemeCode;
    } else {
      ucLogInfo("No screen branding theme provided.  This is only a warning.");
    }

    if (config.checkoutSite) {
      checkoutSite = config.checkoutSite;
      ucLogInfo("init: checkoutSite->" + config.checkoutSite);
    } else {
      ucLogInfo("init: checkoutSite-> using default value [" + checkoutSite + "]");
    }

    if (config.remoteApiUrl) {
      remoteApiUrl = config.remoteApiUrl;
    } else {
      remoteApiUrl = "https://" + ULTRACART_SITE + "/cgi-bin/UCCheckoutAPIJSON";
    }
    ucLogInfo("init: remoteApiUrl->" + remoteApiUrl);

    if (config.thisPageUrl) {
      thisPageUrl = config.thisPageUrl;
      ucLogInfo("overriding this page's url from " + document.URL + " => " + thisPageUrl);
    }


    var successfulConnection = true;
    var testRemoteConnection = !config.doNotTestRemoteConnection; // double negative so if config is absent, it's tested.
    if (testRemoteConnection) {
      var pingResult = pingRemoteServer();
      if (!pingResult) {
        successfulConnection = false;
        ucLogError("COULD NOT CONNECT TO REMOTE SERVER!  PLEASE VERIFY merchantCartConfig.remoteApiUrl is configured correctly.");
        ucLogError("You should expect to see additional errors below.");
      }
    }


    if (config.numberFormatConfig) {
      numberFormat.init(config.numberFormatConfig);
    }

    cartTarget.clear(); // needed in case of re-initialization

    // window dressing for a checkout page. ignore if this is a lightweight page like an item display page.
    if (config.isCheckoutPage) {
      isCheckoutPage = true;
    }

    if (config.disableShippingCalls) {
      disableShippingCalls = true;
    }


    if (isCheckoutPage) {

      if (config.updateShippingOnAddressChange) {
        updateShippingOnAddressChange = true;
      }

      if (config.noBillingFieldsOnPage) {
        noBillingFieldsOnPage = true;
      }

      if (config.addressPriority) {
        if (config.addressPriority != SHIPPING_ADDRESS_IS_PRIORITY && config.addressPriority != BILLING_ADDRESS_IS_PRIORITY) {
          ucLogError('invalid addressPriority (' + config.addressPriority + '), only "shipping" and "billing" are valid values.');
        } else {
          addressPriority = config.addressPriority;
        }
      }


      if (config.listeners) {
        for (var evt in config.listeners) {
          if (config.listeners.hasOwnProperty(evt)) {
            if (evt == EVENT_CART_CHANGE || evt == EVENT_SHIPPING_CHANGE || evt == EVENT_ADDRESS_CHANGE || evt == EVENT_SHIPPING_METHODS_CHANGE || evt == EVENT_CART_READY || evt == EVENT_PROFILE_CHANGE) {
              var funcs = config.listeners[evt];
              for (var i = 0; i < funcs.length; i++) {
                cartTarget.addListener(evt, funcs[i]);
              }
            } else {
              ucLogError('unknown ultracart event: ' + evt);
            }
          }
        }
      }


      // this is for re-initialization. clean up no matter what so a cart can go from having events to not cleanly.
      for (var f in cartFieldMap) {
        if (cartFieldMap.hasOwnProperty(f)) {
          if (cartFieldMap[f] != null) {
            ucLogDebug("unbinding all events for " + f);
            jQuery(cartFieldMap[f]).unbind('.ultraCart');
            cartFieldMap[f] = null;
          }
        }
      }

      if (config.cartFieldMapping) {
        for (var fld in config.cartFieldMapping) {
          if (config.cartFieldMapping.hasOwnProperty(fld)) {
            if (!config.cartFieldMapping[fld]) {
              continue;
              /* ignore null values and such */
            }

            var el = document.getElementById(config.cartFieldMapping[fld]);
            if (el == null) {
              ucLogError('config.cartFieldMapping[' + fld + '] is pointing to element.id=' + config.cartFieldMapping[fld] + ', but there is no html element with that id.  cannot map cart field.');
              continue;
            }

            cartFieldMap[fld] = el; // need this later for the field>cart procedure.

            // bind cart handles element->cart mappings
            // bind shipping creates triggers to update shipping when specific values change
            ucBindCartField(fld, el);
            if (lastShippingEstimate.hasOwnProperty(fld)) {
              ucBindShippingField(fld, el);
            }
          } else {
            ucLogError('unknown ultracart field mapping (' + fld + ')');
          }
        }
      }

      if (updateShippingOnAddressChange && !disableShippingCalls) {
        cartTarget.addListener(EVENT_ADDRESS_CHANGE, ucUpdateShippingMethodsForAddressChange, true);
      }

      ucInitCartInstance();


      if (config.shippingCountries) {
        shippingCountries = config.shippingCountries;
      } else {
        shippingCountries = getAllowedCountries();
      }


      if (config.billingCountries) {
        billingCountries = config.billingCountries
      } else {
        billingCountries = shippingCountries;
      }

      if (cart.shippingMethod) {
        shippingChoice = cart.shippingMethod;
      }

      if (screenBrandingThemeCode && cart && screenBrandingThemeCode != cart.screenBrandingThemeCode) {
        cart.screenBrandingThemeCode = screenBrandingThemeCode;  // if this isn't set already, then shipping isn't set either. it'll get updated together.
      }

      ucPopulateFieldElements(config);

      if (config.cartParameterMapping) {
        for (fld in config.cartParameterMapping) {
          if (config.cartParameterMapping.hasOwnProperty(fld)) {
            ucLogDebug('cart parameter mapping request (' + fld + "=>" + config.cartParameterMapping[fld] + ")");
            if (cartFieldMap.hasOwnProperty(fld)) {
              if (!config.cartParameterMapping[fld]) {
                continue;
                /* ignore null values and such */
              }

              var val = getParameterValue(config.cartParameterMapping[fld]);
              if (val) {
                ucLogDebug('setting cart field ' + fld + " to parameter " + config.cartParameterMapping[fld] + ", value was " + val);
                cart[fld] = val;
              } else {
                ucLogDebug('no value found in parameters for ' + fld + "=>" + config.cartParameterMapping[fld] + " parameter mapping");
              }
            } else {
              ucLogError('unknown ultracart field mapping (' + fld + ')');
            }
          }
        }
      }

      if (!disableShippingCalls) {
        ucUpdateShippingMethodsAsync({async: true, onComplete: function () {
          if (shippingChoice && shippingChoice != cart.shippingMethod) {
            cart.shippingMethod = shippingChoice;
            updateCart({async: true});
          } else if (config.useCheapestShipping) {
            if (shippingMethods && shippingMethods.length > 0) {
              shippingChoice = shippingMethods[0].name;
              cart.shippingMethod = shippingChoice;
              updateCart({async: true});
            }
          }

          cartTarget.fire(EVENT_SHIPPING_CHANGE); // fire regardless to update the summary with the proper shipping amount initially.
          cartTarget.addListener(EVENT_CART_CHANGE, ucUpdateShippingMethodsAsync, true);  // register only now to avoid forever-loop.
        }});
      }

    } else { // just initialize the cart.
      ucInitCartInstance();
    } //end-if isCheckoutPage==true/false


    // lastly (to avoid lagging anything)
    if (config.unifiedAffiliateTracking) {
      ucLogDebug("tracking affiliates");
      ucTrackAffiliates();
    }

    ucLogDebug("init finished. (async calls may still finish)");
    cartTarget.fire(EVENT_CART_READY);

    if (!successfulConnection) {
      ucLogError("There was a problem communicating with the UltraCart remote server.  This is almost *always* a configuration error.  Please scroll up and see additional messages.");
    }

  }


  function addOptionToSelect(select, text, value) {
    // good grief.  I hate MSIE.
    var opt = document.createElement("option");
    var opt_txt = document.createTextNode(text);
    opt.appendChild(opt_txt);
    opt.setAttribute("value", value);
    select.appendChild(opt);
  }


  function deleteOptions(select) {
    while (select.childNodes.length > 0) {
      select.removeChild(select.childNodes[0]);
    }
  }

  function ucPopulateFieldElements(config) {
    if (cart == null || !config || !config.cartFieldMapping) {
      return;
    }


    // populate the credit card types select box.
    if (cart != null) {
      var cardTypes = cart.creditCardTypes;
      var ccType = document.getElementById(config.cartFieldMapping['creditCardType']);
      if (ccType && cardTypes && ccType.tagName.toLowerCase() == 'select') {
        deleteOptions(ccType);
        addOptionToSelect(ccType, "Select Type", "");
        for (var j = 0; j < cardTypes.length; j++) {
          addOptionToSelect(ccType, cardTypes[j], cardTypes[j]);
        }
      }
    }

    // populate the credit card expiration year select box. 25 years.
    var currentDate = new Date();
    var currentYear = currentDate.getFullYear();
    var ccExpYear = document.getElementById(config.cartFieldMapping['creditCardExpirationYear']);
    if (ccExpYear && ccExpYear.tagName.toLowerCase() == 'select') {
      deleteOptions(ccExpYear);
      addOptionToSelect(ccExpYear, "Year", "");
      for (var i = 0; i < 25; i++) {
        addOptionToSelect(ccExpYear, (currentYear + i), (currentYear + i));
      }
    }

    // hard code countries to just US for this cart.
    var scSelect = document.getElementById(config.cartFieldMapping['shipToCountry']);
    if (scSelect && scSelect.tagName.toLowerCase() == 'select') {
      deleteOptions(scSelect);
      for (var b = 0; b < shippingCountries.length; b++) {
        addOptionToSelect(scSelect, shippingCountries[b], shippingCountries[b]);
      }
    }

    var bcSelect = document.getElementById(config.cartFieldMapping['billToCountry']);
    if (bcSelect && bcSelect.tagName.toLowerCase() == 'select') {
      deleteOptions(bcSelect);
      for (var c = 0; c < billingCountries.length; c++) {
        addOptionToSelect(bcSelect, billingCountries[c], billingCountries[c]);
      }
    }

    ucLogDebug("populating field elements with cart values");
    for (var fieldName in cartFieldMap) {
      if (cartFieldMap.hasOwnProperty(fieldName)) {
        if (!cart.hasOwnProperty(fieldName)) {
          continue;
          /* should never happen, but safety check */
        }

        var el = cartFieldMap[fieldName];
        if (!el) {
          ucLogDebug("[cart>elements]: no mapping for " + fieldName);
          continue;
        }

        if (!cart[fieldName]) {
          ucLogDebug("[cart>elements]: cart has no value for " + fieldName);
          continue;
        }

        var fld = jQuery(el);
        if (!fld) {
          ucLogDebug("[cart>elements]: jQuery could not wrap element for field " + fieldName);
          continue;
        }

        ucLogDebug("[cart>elements]: " + fieldName + "=>" + cart[fieldName]);
        if (fld.is('input:checkbox')) {
          fld.attr("checked", cart[fieldName] || false);
        } else if (fld.is('input')) {
          fld.val(cart[fieldName]);
        } else if (fld.is('select')) {
          // try to set value first, then text.
          fld.val(cart[fieldName]);
          // if nothing was set, try the text value.
          if (!fld.val()) {
            jQuery('option', fld).each(function () {
              this.selected = (this.text == cart[fieldName]);
            });
          }
        }
      }

    }
  }

  /**
   * uses the map to transfer all the field values to the cart, calls updateCart async,
   * and then runs the callback handler, if provided.  This will allow the merchant to
   * chain the async update with another function - probably a handoff call.
   * @param callback
   */
  function saveFieldElements(callback) {
    if (cart == null) {
      return;
    }

    ucLogDebug("populating cart values with field elements");
    for (var fieldName in cartFieldMap) {
      if (cartFieldMap.hasOwnProperty(fieldName)) {
        if (!cart.hasOwnProperty(fieldName)) {
          continue;
          /* should never happen, but safety check */
        }

        var el = cartFieldMap[fieldName];
        if (!el) {
          ucLogDebug("[cart>elements]: no mapping for " + fieldName);
          continue;
        }

        var fld = jQuery(el);
        if (!fld) {
          ucLogDebug("[cart>elements]: jQuery could not wrap the field element for " + fieldName);
          continue;
        }

        if (fld.is('input:checkbox')) {
          cart[fieldName] = fld.attr('checked') ? true : false;
        } else if (fld.is('input')) {
          cart[fieldName] = fld.val() || '';
        } else if (fld.is('select')) {
          cart[fieldName] = fld.val() || '';
        }
      }
    }

    // copy shipping to billing where missing
    if (addressPriority == SHIPPING_ADDRESS_IS_PRIORITY) {
      if (!cart.billToAddress1 || noBillingFieldsOnPage) {
        cart.billToAddress1 = cart.shipToAddress1;
      }
      if (!cart.billToAddress2 || noBillingFieldsOnPage) {
        cart.billToAddress2 = cart.shipToAddress2;
      }
      if (!cart.billToCity || noBillingFieldsOnPage) {
        cart.billToCity = cart.shipToCity;
      }
      if (!cart.billToState || noBillingFieldsOnPage) {
        cart.billToState = cart.shipToState;
      }
      if (!cart.billToCountry || noBillingFieldsOnPage) {
        cart.billToCountry = cart.shipToCountry;
      }
      if (!cart.billToPostalCode || noBillingFieldsOnPage) {
        cart.billToPostalCode = cart.shipToPostalCode;
      }
      if (!cart.billToFirstName || noBillingFieldsOnPage) {
        cart.billToFirstName = cart.shipToFirstName;
      }
      if (!cart.billToLastName || noBillingFieldsOnPage) {
        cart.billToLastName = cart.shipToLastName;
      }
      if (!cart.billToPhone || noBillingFieldsOnPage) {
        cart.billToDayPhone = cart.shipToPhone;
      }
      if (!cart.billToCompany || noBillingFieldsOnPage) {
        cart.billToCompany = cart.shipToCompany;
      }
    } else {
      if (!cart.shipToAddress1) {
        cart.shipToAddress1 = cart.billToAddress1;
      }
      if (!cart.shipToAddress2) {
        cart.shipToAddress2 = cart.billToAddress2;
      }
      if (!cart.shipToCity) {
        cart.shipToCity = cart.billToCity;
      }
      if (!cart.shipToState) {
        cart.shipToState = cart.billToState;
      }
      if (!cart.shipToCountry) {
        cart.shipToCountry = cart.billToCountry;
      }
      if (!cart.shipToPostalCode) {
        cart.shipToPostalCode = cart.billToPostalCode;
      }
      if (!cart.shipToFirstName) {
        cart.shipToFirstName = cart.billToFirstName;
      }
      if (!cart.shipToLastName) {
        cart.shipToLastName = cart.billToLastName;
      }

      if (!cart.shipToPhone) {
        cart.shipToPhone = cart.billToDayPhone;
      }

      if (!cart.shipToCompany) {
        cart.shipToCompany = cart.billToCompany;
      }
    }

    updateCart({async: true, onComplete: callback});
  }


  /**
   * searches a catalog for items based on 'search' criteria
   * @param catalogHost see https://secure.ultracart.com/merchant/catalog/chooseHostLoad.do
   * @param search search string
   * @param itemsPerPage limits the number of items returned, used for chunking result sets
   * @param currentPage page offset (currentPage * itemsPerPage = starting item returned, etc...)
   * @param opts optional ucRemoteCall options(async=true/false,onComplete=callback)
   * @returns a json object, an object with the following properties: currentPage:int, totalPages:int, totalResults:int, items:array of item objects
   */
  function search(catalogHost, search, itemsPerPage, currentPage, opts) {
    return ucRemoteCall('search', { 'parameter1': catalogHost, 'parameter2': search, 'parameter3': itemsPerPage, 'parameter4': currentPage}, opts);
  }


  /**
   * It's best to call addItems synchronously since the shipping is reset when items are added.
   * @param items
   * @param opts
   */
  function addItems(items, opts) {

    // try to consolidate with existing items (then update) first.  If that doesn't
    // work, then do an update.
    if (cart != null && cart.items && cart.items.length > 0 && items && items.length) {

      // create a copy of the items array so that if we reach a failure at any point we haven't corrupted the actual cart items.
      var itemsCopy = [];
      for (var k = 0; k < cart.items.length; k++) {
        itemsCopy.push(jQuery.extend(true, {}, cart.items[k]));
      }

      // loop through each item in the items parameter and see if a match can be found for both item id and all options.
      var doUpdate = true;
      for (var m = 0; m < items.length; m++) {
        var foundMatch = false;
        for (var n = 0; n < itemsCopy.length; n++) {
          if (itemIdAndOptionsMatch(items[m], itemsCopy[n])) {
            foundMatch = true;
            itemsCopy[n].quantity = parseInt(itemsCopy[n].quantity) + parseInt(items[m].quantity);
            break;
          }
        } //end-for each item in cart

        if (!foundMatch) {
          doUpdate = false;
          break;
        }
      } // end-for each new item
    } //end-if cart has items

    if (doUpdate) {
      return updateItems(itemsCopy, opts);
    }


    // an empty cart has no shipping methods. so check for an empty cart first.
    // if the cart goes from empty->items, estimateShipping needs to be called.
    var cartWasEmpty = true;
    if (cart != null && cart.items && cart.items.length > 0) {
      cartWasEmpty = false;
    }

    ucSanitizeDataTypes();
    if (opts && opts.async) {
      opts.cartChange = true;
    } // if async, be sure to set the cart.
    var result = ucRemoteCall('addItems', { 'parameter1': cart, 'parameter2': items}, opts);

    if (result != null && result.cart != null) {
      ucSetCart(result.cart, true);

      if (cartWasEmpty && cart != null && cart.items && cart.items.length > 0) {
        cartTarget.fire(EVENT_CART_CHANGE); // notify here, and we'll do it again later
        // I hate to double notify, but estimateShipping can be slow 'cause it has to talk to UPS, FedEx, etc...

        if (isCheckoutPage && !disableShippingCalls) {
          ucUpdateShippingMethodsAsync({
            async: true,
            onComplete: function () {

              // we just got back from updating the cart and now we're going back?
              // because the shipping methods weren't there before on an empty cart
              // we want to be sure to set the method again if needed.
              if (shippingChoice && shippingChoice != cart.shippingMethod) {
                ucLogDebug("shippingChoice != cart.shippingMethod.  fixing up.");
                cart.shippingMethod = shippingChoice;

                // it's important to update the cart before calling this to ensure all fields are properly saved
                // off.  failure to do so could lead to inaccurate shipping information
                updateCart(
                        {
                          async: true, onComplete: function () {
                          cartTarget.fire(EVENT_CART_CHANGE);

                        }
                        });
              } else { // nothing done, just send out the notification
                cartTarget.fire(EVENT_CART_CHANGE);
              }


            }});
        }
      } else { // cart was not empty prior to this add
        cartTarget.fire(EVENT_CART_CHANGE);
      }
    }
    if (result == null) {
      return ["addItems result was null"];
    }
    return result.errors;

  }


  function itemIdAndOptionsMatch(item1, item2) {
    if (!item1 || !item2) {
      return false;
    }

    if (item1.itemId.toLowerCase() != item2.itemId.toLowerCase()) {
      return false;
    }

    // short circuit here.  if there are no options and the item ids already match, return true.
    if ((!item1.options || item1.options.length ==0) && (!item2.options || item2.options.length == 0)) {
      return true;
    }

    // if one has options and the other one doesn't, return false
    if ((item1.options && !item2.options) || (!item1.options && item2.options)) {
      return false;
    }

    if (item1.options.length != item2.options.length) {
      return false;
    }

    // make sure all the options match.  the other might differ, so I'm just comparing the first for a match somewhere in the second.
    for (var i = 0; i < item1.options.length; i++) {
      var matchFound = false;
      for (var j = 0; j < item2.options.length; j++) {
        if (item1.options[i].name == item2.options[j].name && item1.options[i].selectedValue == item2.options[j].selectedValue) {
          matchFound = true;
          break;
        }
      }

      if (!matchFound) {
        return false;
      }
    }

    return true;
  }


  function removeItems(itemIds, opts) {
    ucSanitizeDataTypes();
    if (opts && opts.async) {
      opts.cartChange = true;
    } // if async, be sure to set the cart.
    var result = ucRemoteCall('removeItems', { 'parameter1': cart, 'parameter2': itemIds}, opts);
    if (result != null && result.cart != null) {
      ucSetCart(result.cart);
    }
    if (result == null) {
      return ["removeItems result was null"];
    }
    return result.errors;
  }

  function removeItem(itemId, opts) {
    ucSanitizeDataTypes();
    if (opts && opts.async) {
      opts.cartChange = true;
    } // if async, be sure to set the cart.
    var result = ucRemoteCall('removeItem', { 'parameter1': cart, 'parameter2': itemId}, opts);
    if (result != null && result.cart != null) {
      ucSetCart(result.cart);
    }
    if (result == null) {
      return ["removeItem result was null"];
    }
    return result.errors;
  }


  function removeItemAtIndex(index, opts) {

    // get the items and remove the single item at the specified index.  then pass the items to updateItems instead.
    var items = cart.items;
    if (items && items.length && items.length > index) {
      items.splice(index, 1);
      return updateItems(items, opts);
    } else {
      return null;
    }
  }


  function clearItems(opts) {
    ucSanitizeDataTypes();
    if (opts && opts.async) {
      opts.cartChange = true;
    } // if async, be sure to set the cart.
    var result = ucRemoteCall('clearItems', {'parameter1': cart}, opts);
    if (result != null && result.cart != null) {
      ucSetCart(result.cart);
    }
    if (result == null) {
      return ["clearItems result was null"];
    }
    return result.errors;
  }


  function updateItems(items, opts) {

    // an empty cart has no shipping methods. so check for an empty cart first.
    // if the cart goes from empty->items, estimateShipping needs to be called.
    var cartWasEmpty = true;
    if (cart != null && cart.items && cart.items.length > 0) {
      cartWasEmpty = false;
    }

    ucSanitizeDataTypes();
    if (opts && opts.async) {
      opts.cartChange = true;
    } // if async, be sure to set the cart.
    var result = ucRemoteCall('updateItems', {parameter1: cart, parameter2: items}, opts);
    if (result != null && result.cart != null) {
      ucSetCart(result.cart, true); // don't notify yet, but set the cart for use below.

      if (cartWasEmpty && cart != null && cart.items && cart.items.length > 0) {
        cartTarget.fire(EVENT_CART_CHANGE); // notify here, and we'll do it again later
        // I hate to double notify, but estimateShipping can be slow 'cause it has to talk to UPS, FedEx, etc...

        if (isCheckoutPage && !disableShippingCalls) {
          ucUpdateShippingMethodsAsync({
            async: true,
            onComplete: function () {

              // we just got back from updating the cart and now we're going back?
              // because the shipping methods weren't there before on an empty cart
              // we want to be sure to set the method again if needed.
              if (shippingChoice && shippingChoice != cart.shippingMethod) {
                ucLogDebug("shippingChoice != cart.shippingMethod.  fixing up.");
                cart.shippingMethod = shippingChoice;
                updateCart(
                        {
                          async: true, onComplete: function () {
                          cartTarget.fire(EVENT_CART_CHANGE);

                        }
                        });
              } else { // nothing done, just send out the notification
                cartTarget.fire(EVENT_CART_CHANGE);
              }


            }});
        }
      } else { // cart was not empty prior to this add
        cartTarget.fire(EVENT_CART_CHANGE);
      }
    }

    if (result == null) {
      return ["updateItems result was null"];
    }
    return result.errors;
  }


  function establishCustomerProfile(email, password, opts) {

    ucSanitizeDataTypes();
    if (opts && opts.async) {
      opts.cartChange = true;
    } // if async, be sure to set the cart.
    var result = ucRemoteCall('establishCustomerProfile', {'parameter1': cart, 'parameter2': email, 'parameter3': password}, opts);
    if (result != null && result.cart != null) {
      ucSetCart(result.cart);
    }
    if (result == null) {
      return ["establishCustomerProfile result was null"];
    }
    return result.errors;
  }

  function establishCustomerProfileImmediately(email, password, opts) {

    ucSanitizeDataTypes();
    if (opts && opts.async) {
      opts.cartChange = true;
    } // if async, be sure to set the cart.
    var result = ucRemoteCall('establishCustomerProfileImmediately', {'parameter1': cart, 'parameter2': email, 'parameter3': password}, opts);
    if (result != null && result.cart != null) {
      ucSetCart(result.cart);
      cartTarget.fire(EVENT_PROFILE_CHANGE);
    }
    if (result == null) {
      return ["establishCustomerProfileImmediately result was null"];
    }
    return result.errors;
  }

  function getAdvertisingSources(opts) {
    ucSanitizeDataTypes();
    return ucRemoteCall('getAdvertisingSources', {'parameter1': cart}, opts);
  }


  function getReturnPolicy(opts) {
    return ucRemoteCall('getReturnPolicy', {'parameter1': cart}, opts);
  }

  function getCheckoutTerms(opts) {
    return ucRemoteCall('getCheckoutTerms', {'parameter1': cart}, opts);
  }

  function getAllowedCountries(opts) {
    return ucRemoteCall('getAllowedCountries', {}, opts);
  }

  function ucLogDebug(msg) {
    if (typeof window.console === 'undefined') {
      return;
    }
    if (debugMode) {
      if (console.debug) {
        console.debug("[DEBUG] " + msg);
      } else if (console.log) {
        console.log("[DEBUG] " + msg);
      }
    }
  }

  function ucLogInfo(msg) {
    if (typeof window.console === 'undefined') {
      return;
    }
    if (debugMode) {
      if (console.info) {
        console.info("[INFO] " + msg);
      } else if (console.log) {
        console.log("[INFO] " + msg);
      }
    }
  }

  //noinspection JSUnusedLocalSymbols
  function ucLogWarn(msg) {
    if (typeof window.console === 'undefined') {
      return;
    }
    if (debugMode) {
      if (console.warn) {
        console.warn("[WARN] " + msg);
      } else if (console.log) {
        console.log("[WARN] " + msg);
      }
    }
  }

  //noinspection JSUnusedLocalSymbols
  function ucLogError(msg) {
    if (typeof window.console === 'undefined') {
      return;
    }
    if (debugMode) {
      if (console.error) {
        console.error("[ERROR] " + msg);
      } else if (console.log) {
        console.log("[ERROR] " + msg);
      }
      ucStackTrace();
    }
  }

  function ucInitConsole() {
    if (!window['console']) {
      // Enable console
      if (window['loadFirebugConsole']) {
        window.loadFirebugConsole();
      } else {
        // No console, use Firebug Lite
        var firebugLite = function (F, i, r, e, b, u, g, L, I, T, E) {
          if (F.getElementById(b)) {
            return;
          }
          E = F[i + 'NS'] && F.documentElement.namespaceURI;
          E = E ? F[i + 'NS'](E, 'script') : F[i]('script');
          E[r]('id', b);
          E[r]('src', I + g + T);
          E[r](b, u);
          (F[e]('head')[0] || F[e]('body')[0]).appendChild(E);
          E = new Image;
          E[r]('src', I + L);
        };
        firebugLite(document, 'createElement', 'setAttribute', 'getElementsByTagName', 'FirebugLite', '4', 'firebug-lite.js', 'releases/lite/latest/skin/xp/sprite.png', 'https://getfirebug.com/', '#startOpened');
      }
    } else {
      // console is already available, no action needed.
    }
  }

  function ucStackTrace() {
    if (typeof window.console === 'undefined') {
      return;
    }
    if (debugMode && console.trace) {
      console.trace();
    }
  }


  function isDiff(o1, o2) {
    if (o1 == null && o2 == null) {
      return false;
    }
    if (o1 == null && o2 != null) {
      return true;
    }
    if (o1 != null && o2 == null) {
      return true;
    }
    return o1 == o2;
  }

  /**
   * legacy api call. don't recommend using it.  there are more elegant solutions.
   * @param opts async and onComplete properties.
   */
  function estimateShipping(opts) {
    if (opts && opts.async) {
      ucUpdateShippingMethodsForAddressChange();
      return null;
    } else {
      ucGetShippingMethods();
      return shippingMethods;
    }
  }


  function getShippingMethods() {
    return shippingMethods;
  }

  function ucGetShippingMethods(opts) {
    ucSanitizeDataTypes();
    var result = ucRemoteCall('estimateShipping', {'parameter1': cart}, opts);
    if (result != null) {
      shippingMethods = result;
    }

  }

  function ucUpdateShippingMethodsForAddressChange() {

    ucLogDebug("checking to see if shipping needs updating...");

    if (cart && lastShippingEstimate && (
            isDiff(lastShippingEstimate.shipToAddress1, cart.shipToAddress1) ||
                    isDiff(lastShippingEstimate.shipToAddress2, cart.shipToAddress2) ||
                    isDiff(lastShippingEstimate.shipToCity, cart.shipToCity) ||
                    isDiff(lastShippingEstimate.shipToState, cart.shipToState) ||
                    isDiff(lastShippingEstimate.shipToPostalCode, cart.shipToPostalCode) ||
                    isDiff(lastShippingEstimate.shipToCountry, cart.shipToCountry)
            )) {

      ucLogDebug("...it does.  updating shipping (if I have enough fields).");
      if (cart.shipToCity && cart.shipToState && cart.shipToPostalCode) {
        updateCart(
                {
                  async: true,
                  onComplete: function (result) {
                    ucSetCart(result, true);
                    ucUpdateShippingMethodsAsync();
                  }
                });

      } else {
        ucLogDebug("not enough fields to update shipping estimates");
      }

    } else {
      ucLogDebug("...it does NOT.  Not updating.");
    }
  }


  /**
   * this is crazy.  :)
   * 1. get the shipping methods async.
   * 2. when done, update shippingchoice
   * 3. optionally execute any other code passed in as opts
   * @param opts
   */
  function ucUpdateShippingMethodsAsync(opts) {

    ucLogDebug("updating shipping methods async");

    ucGetShippingMethods({
      async: true,
      onComplete: function (result) {
        shippingMethods = result;
        ucSyncShippingChoice();

        cartTarget.fire(EVENT_SHIPPING_METHODS_CHANGE);
        lastShippingEstimate.shipToAddress1 = cart.shipToAddress1;
        lastShippingEstimate.shipToAddress2 = cart.shipToAddress2;
        lastShippingEstimate.shipToCity = cart.shipToCity;
        lastShippingEstimate.shipToState = cart.shipToState;
        lastShippingEstimate.shipToPostalCode = cart.shipToPostalCode;
        lastShippingEstimate.shipToCountry = cart.shipToCountry;

        if (opts && opts.async && opts.onComplete) {
          opts.onComplete();
        }

      }
    });
  }


  /**
   * compares the shipping choice to the cart and available shipping methods.
   * adjust them if 1) no shipping choice has been made or 2) current choice is no longer available
   */
  function ucSyncShippingChoice() {

    if (!shippingMethods || !shippingMethods.length || shippingMethods.length == 0) {
      return;
    }

    // situation: customer has 2 items in cart, and selected cheapest method.
    // customer then adds 30 more items.  package is now too big for cheapest method.
    // check to see if there's a shipping choice and ensure it's a valid choice, if not,
    // select the cheapest one and fire off that it's changed.
    var shippingChoiceIsInvalid = true;
    if (shippingChoice && shippingMethods) {
      for (var z = 0; z < shippingMethods.length; z++) {
        if (shippingMethods[z].name == shippingChoice) {
          shippingChoiceIsInvalid = false;
        }
      }
    }

    if (shippingChoiceIsInvalid) {
      shippingChoice = ''; // reset it.
      if (shippingMethods && shippingMethods.length) {
        for (var w = 0; w < shippingMethods.length; w++) {
          if (shippingMethods[w].defaultMethod) {
            shippingChoice = shippingMethods[w].name;
            shippingChoiceIsInvalid = false;
          }
        }
      }
    }

    // if the shippingChoice is still invalid, it means the default method is not available.
    // in that case, choose the cheapest method.  it'll be the first one.
    if (shippingChoiceIsInvalid && shippingMethods && shippingMethods.length && shippingMethods.length > 0) {
      shippingChoice = shippingMethods[0].name;
    }

  }


  /**
   * passes the zip to the server and retrieves a state and city.  The object returned is a CityStateZip Object.
   * @see http://docs.ultracart.com/display/ucdoc/CityStateZip+-+Checkout+API
   * @see http://docs.ultracart.com/display/ucdoc/getCityState+-+Checkout+API+Method
   * @param zip zip code
   * @param opts standard optional arguments for async call:  async:true, onComplete:function(){}
   */
  function getCityState(zip, opts) {
    return ucRemoteCall('getCityState', { parameter1: cart, parameter2: zip}, opts);
  }

  function getRelatedItems(opts) {
    ucSanitizeDataTypes();
    return ucRemoteCall('getRelatedItems', {'parameter1': cart}, opts);
  }

  function getGiftSettings(opts) {
    ucSanitizeDataTypes();
    return ucRemoteCall('getGiftSettings', {'parameter1': cart}, opts);
  }

  function getHostLink(customSslSecureHostName) {
    ucRemoteCall('getHostLink', {'parameter1': cart, 'parameter2': customSslSecureHostName}, {async: true,
      onComplete: function (result) {
        if (result) {
          var script = document.createElement('script');
          script.type = 'text/javascript';
          script.src = result;
          var head = document.getElementsByTagName("head")[0];
          head.appendChild(script);
        }
      }
    });
  }

  function getItems(itemIds, opts) {
    return ucRemoteCall('getItems', {'parameter1': itemIds, 'parameter2': cart}, opts);
  }

  function getItem(itemId, opts) {
    return ucRemoteCall('getItem', {'parameter1': itemId, 'parameter2': cart}, opts);
  }

  function getItemsForCatalogGroup(catalogUrl, includeCaseItemMap, opts) {
    if (includeCaseItemMap) {
      return ucRemoteCall('getItemsForCatalogGroup', {'parameter1': cart, 'parameter2': catalogUrl, parameter3: includeCaseItemMap}, opts);
    } else {
      return ucRemoteCall('getItemsForCatalogGroup', {'parameter1': cart, 'parameter2': catalogUrl}, opts);
    }
  }

  function validate(checks, opts) {
    backgroundTimer(false);
    ucSanitizeDataTypes();
    return ucRemoteCall('validate', {'parameter1': cart, 'parameter2': checks}, opts);
  }

  function validateAll(opts) {
    ucSanitizeDataTypes();
    return ucRemoteCall('validate', {'parameter1': cart}, opts);
  }

  function getTaxCounties(opts) {
    ucSanitizeDataTypes();
    return ucRemoteCall('getTaxCounties', {'parameter1': cart}, opts);
  }

  function loginCustomerProfile(email, password, opts) {
    ucSanitizeDataTypes();
    return ucRemoteCall('loginCustomerProfile', {'parameter1': cart, 'parameter2': email, 'parameter3': password}, opts);
  }

  function resetCustomerProfilePassword(email, opts) {
    ucSanitizeDataTypes();
    return ucRemoteCall('resetCustomerProfilePassword', {'parameter1': email}, opts);
  }

  function getCustomerProfile(opts) {
    ucSanitizeDataTypes();
    return ucRemoteCall('getCustomerProfile', {'parameter1': cart}, opts);
  }

  function updateCustomerProfile(customerProfile, opts) {
    ucSanitizeDataTypes();
    return ucRemoteCall('updateCustomerProfile', {'parameter1': cart, 'parameter2': customerProfile}, opts);
  }

  function logoutCustomerProfile(opts) {

    ucSanitizeDataTypes();
    var result = ucRemoteCall('logoutCustomerProfile', {'parameter1': cart}, opts);
    if (result != null && result.cart != null) {
      ucSetCart(result.cart);
    }
    if (result == null) {
      return ["logoutCustomerProfile result was null"];
    }
    return result.errors;
  }


  /**
   * logs in a customer and updates the cart.  if result of remote call is null, login failed
   * @param email credentials
   * @param password credentials
   * @param opts  standard async and onComplete.  if this is executed async, the customer change event will not fire.
   * @returns true if login was successful, false otherwise.  this is meaningless if remote call is async
   */
  function loginCustomer(email, password, opts) {
    ucSanitizeDataTypes();
    //return ucRemoteCall('loginCustomer', {'parameter1': cart, 'parameter2': email, 'parameter3': password}, opts);
    if (opts && opts.async) {
      opts.cartChange = true;
      opts.resultIsCart = true;
    } // if async, be sure to set the cart.
    var result = ucRemoteCall('loginCustomer', {'parameter1': cart, 'parameter2': email, 'parameter3': password}, opts);
    if (result != null) {  // result should be an updated cart.
      ucSetCart(result);
      cartTarget.fire(EVENT_PROFILE_CHANGE);
    }
    return result != null;
  }


  /**
   * logs out a customer and updates the cart
   * @param opts  standard async and onComplete.  if this is executed async, the customer change event will not fire.
   * @returns true if logout was success, false otherwise
   */
  function logoutCustomer(opts) {

    ucSanitizeDataTypes();
    if (opts && opts.async) {
      opts.cartChange = true;
      opts.resultIsCart = true;
    } // if async, be sure to set the cart.
    var result = ucRemoteCall('logoutCustomer', {'parameter1': cart}, opts);
    if (result != null) {
      ucSetCart(result);
      cartTarget.fire(EVENT_PROFILE_CHANGE);
    }
    return result != null;
  }


  /**
   * associates an affiliate to a cart
   * @param affiliateId the affiliate id
   * @param subId the sub id for the affiliate
   * @param opts  standard async and onComplete.
   * @returns true if operation was successful, false otherwise.  this is meaningless if remote call is async
   */
  function setAffiliate(affiliateId, subId, opts) {
    ucSanitizeDataTypes();
    if (opts && opts.async) {
      opts.cartChange = true;
      opts.resultIsCart = true;
    } // if async, be sure to set the cart.
    var result = ucRemoteCall('setAffiliateId', {'parameter1': cart, 'parameter2': affiliateId, 'parameter3': subId}, opts);
    if (result != null) {  // result should be an updated cart.
      ucSetCart(result);
      //don't think this should fire.
      //cartTarget.fire(EVENT_CART_CHANGE);
    }
    return result != null;
  }


  function setFinalizeAfter(minutes, opts) {
    ucSanitizeDataTypes();
    return ucRemoteCall('setFinalizeAfter', {'parameter1': cart, 'parameter2': minutes}, opts);
  }

  function clearFinalizeAfter(opts) {
    ucSanitizeDataTypes();
    return ucRemoteCall('clearFinalizeAfter', {'parameter1': cart}, opts);
  }

  function checkout(checkoutMethod, opts) {

    ucSanitizeDataTypes();

    var methodName = 'checkoutHandoff'; // default, also what CHECKOUT_ULTRACART points to
    if (checkoutMethod) {
      if (checkoutMethod == CHECKOUT_GOOGLE) {
        ucLogInfo("[CHECKOUT] executing google checkout");
        methodName = 'googleCheckoutHandoff';
      } else if (checkoutMethod == CHECKOUT_PAYPAL) {
        ucLogInfo("[CHECKOUT] executing paypal checkout");
        methodName = 'paypalHandoff';
      } else if (checkoutMethod == CHECKOUT_ULTRACART) {
        ucLogInfo("[CHECKOUT] executing standard checkout");
      }
    } else {
      ucLogInfo("[CHECKOUT] no checkoutMethod provided, executing standard checkout");
    }


    var customUrl = (checkoutSite != ULTRACART_SITE);
    if (customUrl) {
      return ucRemoteCall(methodName, {'parameter1': cart, 'parameter2': checkoutSite, 'parameter3': thisPageUrl, 'parameter4': ULTRACART_ERROR_PARAM}, opts);
    } else {
      return ucRemoteCall(methodName, {'parameter1': cart, 'parameter2': thisPageUrl, 'parameter3': ULTRACART_ERROR_PARAM}, opts);
    }
  }


  function validateGiftCertificate(giftCertificateCode, opts) {
    return ucRemoteCall('validateGiftCertificate', {'parameter1': giftCertificateCode, 'parameter2': cart}, opts);
  }

  function applyGiftCertificate(giftCertificateCode, opts) {
    ucSanitizeDataTypes();
    if (opts && opts.async) {
      opts.cartChange = true
    } // if async, be sure to set the cart.
    var result = ucRemoteCall('applyGiftCertificate', {'parameter1': cart, 'parameter2': giftCertificateCode}, opts);
    if (result != null) {
      ucSetCart(result);
    }
    if (result == null) {
      return ["applyGiftCertificate result was null"];
    }
    return result.errors;
  }

  function removeGiftCertificate(opts) {
    ucSanitizeDataTypes();
    if (opts && opts.async) {
      opts.cartChange = true;
    } // if async, be sure to set the cart.
    var result = ucRemoteCall('removeGiftCertificate', {'parameter1': cart}, opts);
    if (result != null && result.cart != null) {
      ucSetCart(result.cart);
    }
    if (result == null) {
      return ["removeGiftCertificate result was null"];
    }
    return result.errors;
  }

  function applyCoupon(couponCode, opts) {

    ucSanitizeDataTypes();
    if (opts && opts.async) {
      opts.cartChange = true;
    } // if async, be sure to set the cart.
    var result = ucRemoteCall('applyCoupon', {'parameter1': cart, 'parameter2': couponCode}, opts);
    if (result != null && result.cart != null) {
      ucSetCart(result.cart);
    }
    if (result == null) {
      return ["applyCoupon result was null"];
    }
    return result.errors;
  }

  function applyCoupons(couponCodes, opts) {

    ucSanitizeDataTypes();
    if (opts && opts.async) {
      opts.cartChange = true;
    } // if async, be sure to set the cart.
    var result = ucRemoteCall('applyCoupons', {'parameter1': cart, 'parameter2': couponCodes}, opts);
    if (result != null && result.cart != null) {
      ucSetCart(result.cart);
    }
    if (result == null) {
      return ["applyCoupons result was null"];
    }
    return result.errors;
  }

  function removeCoupon(couponCode, opts) {

    ucSanitizeDataTypes();
    if (opts && opts.async) {
      opts.cartChange = true;
    } // if async, be sure to set the cart.
    var result = ucRemoteCall('removeCoupon', {'parameter1': cart, 'parameter2': couponCode}, opts);
    // for this method, the result IS the cart object.
    if (result != null) {
      ucSetCart(result);
    }
    if (result == null) {
      return ["removeCoupon result was null"];
    }
    return result.errors;
  }

  function getCartItemMultimediaThumbnail(cartItem, cartItemMultimedia, width, height, opts) {
    return ucRemoteCall('getCartItemMultimediaThumbnail', {'parameter1': cartItem, 'parameter2': cartItemMultimedia, 'parameter3': width, 'parameter4': height}, opts);
  }

  function getItemMultimediaThumbnail(item, itemMultimedia, width, height, opts) {
    return ucRemoteCall('getItemMultimediaThumbnail', {'parameter1': item, 'parameter2': itemMultimedia, 'parameter3': width, 'parameter4': height}, opts);
  }


  /**
   * checkout site should be set before this is called.  makes a remote call returning javascript that writes out
   * more script which does cookie tracking for affiliates
   */
  function ucTrackAffiliates() {
    ucRemoteCall('getUnifiedAffiliateCookieScript', {parameter1: checkoutSite}, {async: true,
      onComplete: function (result) {
        if (result) {
          var script = document.createElement('script');
          script.type = 'text/javascript';
          script.src = result;
          var head = document.getElementsByTagName("head")[0];
          head.appendChild(script);
        }
      }
    });
  }

  function getStateProvinces(country, opts) {
    // They really shouldn't use the async call since the local call is instanteous, but for constantly sake we'll support it
    if (opts != null) {
      return ucRemoteCall('getStateProvinces', {'parameter1': country}, opts);
    }

    var i;
    for (i = 0; i < ucStateProvinces.length; i++) {
      if (ucStateProvinces[i].country == country) {
        return ucStateProvinces[i].stateProvinces;
      }
    }

    return [];
  }


  function unabbreviateStateProvinceCode(country, code) {
    var i;
    var j;

    for (i = 0; i < ucStateProvinces.length; i++) {
      if (ucStateProvinces[i].country == country) {
        for (j = 0; j < ucStateProvinces[i].codes.length; j++) {
          if (ucStateProvinces[i].codes[j] == code) {
            return ucStateProvinces[i].stateProvinces[j];
          }
        }
      }
    }

    return code;
  }

  function getStateProvinceCodes(country, opts) {
    // They really shouldn't use the async call since the local call is instantaneous, but for constantly sake we'll support it
    if (opts != null) {
      return ucRemoteCall('getStateProvinceCodes', {'parameter1': country}, opts);
    }

    var i;
    for (i = 0; i < ucStateProvinces.length; i++) {
      if (ucStateProvinces[i].country == country) {
        return ucStateProvinces[i].codes;
      }
    }

    return [];
  }

  function getIpAddress(opts) {
    var result = null;

    // Do we want async?
    var async = false;
    var onComplete;

    if (opts != undefined && opts.async != undefined) {
      async = opts.async;
    }
    if (opts != undefined && opts.onComplete != undefined) {
      onComplete = opts.onComplete;
    }

    // Send the request
    jQuery.ajax({url: remoteApiUrl, async: async, cache: false, dataType: 'text', global: false,
      data: {'functionName': 'getIpAddress', 'merchantId': merchantId, 'version': version},
      type: 'POST', success: function (responseText) {
        // Store the result into our variable.
        result = responseText;

        // Call their function
        if (async && onComplete != undefined) {
          onComplete(responseText);
        }

      }});

    return result;
  }

  // Create, or get cart instance
  function ucInitCartInstance() {
    // Return the cart we already have
    if (cart != null) {
      return;
    }

    if (readCookie('UltraCartShoppingCartID')) {
      cart = ucGetCart(readCookie('UltraCartShoppingCartID'));
      if (cart == null) {
        eraseCookie('UltraCartShoppingCartID');
        cart = ucCreateCart();
        if (cart && cart.cartId) {
          createCookie('UltraCartShoppingCartID', cart.cartId, 0);
        }
      }
    }
    else {
      cart = ucCreateCart();
      createCookie('UltraCartShoppingCartID', cart.cartId, 0);
    }
  }


  /**
   * sets the shipping choice.
   * fires EVENT_SHIPPING_CHANGE and EVENT_CART_READY (indirectly via ucSetCart)
   * @param choice string, name of shipping method
   */
  function setShippingChoice(choice) {
    ucLogDebug("setShippingChoice('" + choice + "')");
    shippingChoice = choice;
    cart.shippingMethod = choice;

    cartTarget.fire(EVENT_SHIPPING_CHANGE);

    updateCart(
            {
              async: true,
              onComplete: function (result) {
                ucSetCart(result, true);
              }
            });
  }

  function getShippingChoice() {
    if (!shippingChoice || !shippingMethods) {
      return null;
    }
    for (var i = 0; i < shippingMethods.length; i++) {
      if (shippingChoice == shippingMethods[i].name) {
        return shippingMethods[i];
      }
    }
    return null;
  }


  function ucMakeBindShippingField(field, element) {
    function checkForChange() {
      var lastValue = lastShippingEstimate[field];
      var currentValue = null;
      var el = jQuery(element);
      if (el.is('input')) {
        currentValue = el.val();
      } else if (el.is('select')) {
        currentValue = el.val() || el.text();
      }

      if (currentValue) {
        currentValue = currentValue.trim();
      }
      if (lastValue == null) {
        ucLogDebug("updating lastShippingEstimate[" + field + "], was null, now => " + currentValue);
        lastShippingEstimate[field] = currentValue;
        cartTarget.fire(EVENT_ADDRESS_CHANGE);
      } else if (lastValue != currentValue) {
        ucLogDebug("updating lastShippingEstimate[" + field + "] " + lastShippingEstimate[field] + " => " + currentValue);
        lastShippingEstimate[field] = currentValue;
        cartTarget.fire(EVENT_ADDRESS_CHANGE);
      } else {
        ucLogDebug("blur called, but no change for lastShippingEstimate[" + field + "]");
      }
    }

    return checkForChange;
  }

  function ucBindShippingField(field, element) {
    ucLogDebug("binding " + field + " to element " + element.id);
    jQuery(element).bind('blur.ultraCart', ucMakeBindShippingField(field, element));
  }


  function ucMakeBindCartField(field, element) {
    function checkForChange() {
      var currentValue = null;
      var el = jQuery(element);
      if (el.is('input:checkbox')) {
        currentValue = el.attr('checked');
      } else if (el.is('input')) {
        currentValue = el.val();
      } else if (el.is('select')) {
        currentValue = el.val();
      }

      if (cart) {
        ucLogDebug("updating cart." + field + " " + cart[field] + " => " + currentValue);
        cart[field] = currentValue;

        // save off the email immediately., don't notify since this action doesn't change gui.
        if (field == 'email') {
          updateCart({async: true, doNotNotify: true});
        }

      }
    }

    return checkForChange;
  }

  function ucBindCartField(field, element) {
    ucLogDebug("[cart] binding " + field + " to element " + element.id);
    jQuery(element).bind('blur.ultraCart', ucMakeBindCartField(field, element));
  }


  /**
   * takes a url, constructs a form with parameters, and then posts it
   * @param getUrl a full url suitable for location.href
   */
  function postGet(getUrl) {

    var url = document.createElement('a');
    url.href = getUrl;
    if (url.search != null) {
      var paramMap = getParameterMap(url.search.substring(1)); // substring removes question mark
    }

    var action = url.href.replace(url.search, '');

    var form = document.createElement('form');
    form.method = 'post';
    form.action = action;

    for (var param in paramMap) {
      if (paramMap.hasOwnProperty(param)) {
        var values = paramMap[param];
        for (var i = 0; i < values.length; i++) {
          var fld = document.createElement('input');
          fld.type = 'hidden';
          fld.name = param;
          fld.value = values[i];
          form.appendChild(fld);
        }
      }
    }

    document.body.appendChild(form);
    form.submit();
  }


  function getParameterValues(parameterName) {
    var upperCaseParamName = parameterName.toUpperCase();
    var result = [];

    // Make sure there is a query parameter
    if (window.location.search == null) {
      return result;
    }

    // Get everything after the ?
    var query = window.location.search.substring(1);

    // Split into name/value pairs
    var vars = query.split("&");
    for (var i = 0; i < vars.length; i++) {

      // Split into name and value array
      var pair = vars[i].split("=");

      // Does the name match our errorParameterName?
      if (pair[0].toUpperCase() == upperCaseParamName) {

        // Add it to the result, but properly decode it.
        result[result.length] = javaUrlDecode(pair[1]);
      }
    }

    return result;
  }


  /**
   * returns a hashmap of all parameter values by name.  Each name is a property
   * and contains an array of values, even if there's only one.
   * @param queryString should be everything after the ? symbol, excluding the ? symbol
   */
  function getParameterMap(queryString) {
    var result = {};

    // Make sure there is a query parameter
    if (queryString == null) {
      return result;
    }

    // Split into name/value pairs
    var vars = queryString.split("&");
    for (var i = 0; i < vars.length; i++) {

      // Split into name and value array
      var pair = vars[i].split("=");

      if (!result.hasOwnProperty(pair[0])) {
        result[pair[0]] = [];
      }
      result[pair[0]].push(javaUrlDecode(pair[1]))

    }

    return result;
  }

  function getParameterValue(parameterName) {
    var upperCaseParamName = parameterName.toUpperCase();

    // Make sure there is a query parameter
    if (window.location.search == null) {
      return null;
    }

    // Get everything after the ?
    var query = window.location.search.substring(1);

    // Split into name/value pairs
    var vars = query.split("&");
    for (var i = 0; i < vars.length; i++) {

      // Split into name and value array
      var pair = vars[i].split("=");

      // Does the name match our errorParameterName?
      if (pair[0].toUpperCase() == upperCaseParamName) {

        return javaUrlDecode(pair[1]);
      }
    }

    return null;
  }

  // Helper method for getErrorsFromQueryString
  function javaUrlDecode(s) {
    return _utf8_decode(unescape(s)).replace(/\+/g, ' ');
  }

  // Private helper method for javaUrlDecode
  function _utf8_decode(utftext) {
    var s = "";
    var i = 0;
    var c = c1 = c2 = 0;

    while (i < utftext.length) {
      c = utftext.charCodeAt(i);

      if (c < 128) {
        s += String.fromCharCode(c);
        i++;
      }
      else if ((c > 191) && (c < 224)) {
        c2 = utftext.charCodeAt(i + 1);
        s += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
        i += 2;
      }
      else {
        c2 = utftext.charCodeAt(i + 1);
        c3 = utftext.charCodeAt(i + 2);
        s += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
        i += 3;
      }
    }

    return s;
  }

  // Methods to help work with JSON serialized dates like shipOnDate and deliveryDate

  function ucMonthNumberToAbbrev(m) {
    if (m == 0) {
      return "Jan";
    }
    if (m == 1) {
      return "Feb";
    }
    if (m == 2) {
      return "Mar";
    }
    if (m == 3) {
      return "Apr";
    }
    if (m == 4) {
      return "May";
    }
    if (m == 5) {
      return "Jun";
    }
    if (m == 6) {
      return "Jul";
    }
    if (m == 7) {
      return "Aug";
    }
    if (m == 8) {
      return "Sep";
    }
    if (m == 9) {
      return "Oct";
    }
    if (m == 10) {
      return "Nov";
    }
    if (m == 11) {
      return "Dec";
    }
    return "Dec";
  }

  function ucGetHoursAMPM(h) {
    if (h >= 12) {
      h = h - 12;
    }
    if (h == 0) {
      return 12;
    }
    return h;
  }

  function ucGetAMPM(h) {
    if (h < 12) {
      return "AM";
    }
    return "PM";
  }

  function ucPadTwo(v) {
    var s = "" + v;
    if (s.length == 1) {
      s = "0" + s;
    }
    return s;
  }

  //noinspection JSUnusedLocalSymbols
  function ucJsonStringToDate(s) {
    if (s == null) {
      return null;
    }
    return new Date(s);
  }

  //noinspection JSUnusedLocalSymbols
  function ucDateToJsonString(d) {
    if (d == null) {
      return null;
    }
    return ucMonthNumberToAbbrev(d.getMonth()) + " " + d.getDate() + ", " + d.getFullYear() + " " + ucGetHoursAMPM(d.getHours()) + ":" + ucPadTwo(d.getMinutes()) + ":" + ucPadTwo(d.getSeconds()) + " " + ucGetAMPM(d.getHours());
  }

  function createCookie(name, value, days) {
    var expires = "";
    if (days) {
      var date = new Date();
      date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
      expires = "; expires=" + date.toGMTString();
    }
    document.cookie = name + "=" + value + expires + "; domain=." + document.domain + "; path=/";
  }

  function readCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
      var c = ca[i];
      while (c.charAt(0) == ' ') {
        c = c.substring(1, c.length);
      }
      if (c.indexOf(nameEQ) == 0) {
        return c.substring(nameEQ.length, c.length);
      }
    }

    return null;
  }

  function eraseCookie(name) {
    createCookie(name, "", -1);
  }

  // Validation Options
  var OPTION_ITEM_QUANTITY_VALID = "Item Quantity Valid";
  var OPTION_BILLING_ADDRESS_PROVIDED = "Billing Address Provided";
  var OPTION_BILLING_STATE_ABBREVIATION_VALID = "Billing State Abbreviation Valid";
  var OPTION_BILLING_BILLING_PHONE_NUMBERS_PROVIDED = "Billing Phone Numbers Provided";
  var OPTION_EMAIL_PROVIDED_IF_REQUIRED = "Email provided if required";
  var OPTION_BILLING_VALIDATE_CITY_STATE_ZIP = "Billing Validate City State Zip";
  var OPTION_TAX_COUNTY_SPECIFIED = "Tax County Specified";
  var OPTION_SHIPPING_METHOD_PROVIDED = "Shipping Method Provided";
  var OPTION_ADVERTISING_SOURCE_PROVIDED = "Advertising Source Provided";
  var OPTION_REFERRAL_CODE_PROVIDED = "Referral Code Provided";
  var OPTION_SHIPPING_ADDRESS_PROVIDED = "Shipping Address Provided";
  var OPTION_SHIPPING_STATE_ABBREVIATION_VALID = "Shipping State Abbreviation Valid";
  var OPTION_GIFT_MESSAGE_LENGTH = "Gift Message Length";
  var OPTION_SHIPPING_VALIDATE_CITY_STATE_ZIP = "Shipping Validate City State Zip";
  var OPTION_SHIPPING_DESTINATION_RESTRICTION = "Shipping Destination Restriction";
  var OPTION_ONE_PER_CUSTOMER_VIOLATIONS = "One per customer violations";
  var OPTION_PAYMENT_METHOD_SHIPPING_METHOD_CONFLICT = "Credit Card Shipping Method Conflict";
  var OPTION_PAYMENT_INFORMATION_VALIDATE = "Payment Information Validate";
  var OPTION_PAYMENT_METHOD_PROVIDED = "Payment Method Provided";
  var OPTION_QUANTITY_REQUIREMENTS_MET = "Quantity requirements met";
  var OPTION_ITEMS_PRESENT = "Items Present";
  var OPTION_OPTIONS_PROVIDED = "Options Provided";
  var OPTION_CVV2_NOT_REQUIRED = "CVV2 Not Required";
  var OPTION_ELECTRONIC_CHECK_CONFIRM_ACCOUNT_NUMBER = "Electronic Check Confirm Account Number";
  var OPTION_CUSTOMER_PROFILE_DOES_NOT_EXIST = "Customer Profile Does Not Exist.";
  var OPTION_VALID_SHIP_ON_DATE = "Valid Ship On Date";
  var OPTION_PRICING_TIER_LIMITS = "Pricing Tier Limits";
  var OPTION_SHIPPING_NEEDS_RECALCULATION = "Shipping Needs Recalculation";
  var OPTION_MERCHANT_SPECIFIC_ITEM_RELATIONSHIPS = "Merchant Specific Item Relationships";
  var OPTION_ALL = "All";


  var verify = {
    ITEM_QUANTITY_VALID: OPTION_ITEM_QUANTITY_VALID,
    BILLING_ADDRESS_PROVIDED: OPTION_BILLING_ADDRESS_PROVIDED,
    BILLING_STATE_ABBREVIATION_VALID: OPTION_BILLING_STATE_ABBREVIATION_VALID,
    BILLING_PHONE_NUMBERS_PROVIDED: OPTION_BILLING_BILLING_PHONE_NUMBERS_PROVIDED,
    EMAIL_PROVIDED_IF_REQUIRED: OPTION_EMAIL_PROVIDED_IF_REQUIRED,
    BILLING_VALIDATE_CITY_STATE_ZIP: OPTION_BILLING_VALIDATE_CITY_STATE_ZIP,
    TAXCOUNTYSPECIFIED: OPTION_TAX_COUNTY_SPECIFIED,
    SHIPPING_METHOD_PROVIDED: OPTION_SHIPPING_METHOD_PROVIDED,
    ADVERTISING_SOURCE_PROVIDED: OPTION_ADVERTISING_SOURCE_PROVIDED,
    REFERRAL_CODE_PROVIDED: OPTION_REFERRAL_CODE_PROVIDED,
    SHIPPING_ADDRESS_PROVIDED: OPTION_SHIPPING_ADDRESS_PROVIDED,
    SHIPPING_STATE_ABBREVIATION_VALID: OPTION_SHIPPING_STATE_ABBREVIATION_VALID,
    GIFT_MESSAGE_LENGTH: OPTION_GIFT_MESSAGE_LENGTH,
    SHIPPING_VALIDATE_CITY_STATE_ZIP: OPTION_SHIPPING_VALIDATE_CITY_STATE_ZIP,
    SHIPPING_DESTINATION_RESTRICTION: OPTION_SHIPPING_DESTINATION_RESTRICTION,
    ONE_PER_CUSTOMER_VIOLATIONS: OPTION_ONE_PER_CUSTOMER_VIOLATIONS,
    PAYMENT_METHOD_SHIPPING_METHOD_CONFLICT: OPTION_PAYMENT_METHOD_SHIPPING_METHOD_CONFLICT,
    PAYMENT_INFORMATION_VALIDATE: OPTION_PAYMENT_INFORMATION_VALIDATE,
    PAYMENT_METHOD_PROVIDED: OPTION_PAYMENT_METHOD_PROVIDED,
    QUANTITY_REQUIREMENTS_MET: OPTION_QUANTITY_REQUIREMENTS_MET,
    ITEMS_PRESENT: OPTION_ITEMS_PRESENT,
    OPTIONS_PROVIDED: OPTION_OPTIONS_PROVIDED,
    CVV2_NOT_REQUIRED: OPTION_CVV2_NOT_REQUIRED,
    ELECTRONIC_CHECK_CONFIRM_ACCOUNT_NUMBER: OPTION_ELECTRONIC_CHECK_CONFIRM_ACCOUNT_NUMBER,
    CUSTOMER_PROFILE_DOES_NOT_EXIST: OPTION_CUSTOMER_PROFILE_DOES_NOT_EXIST,
    VALID_SHIP_ON_DATE: OPTION_VALID_SHIP_ON_DATE,
    PRICING_TIER_LIMITS: OPTION_PRICING_TIER_LIMITS,
    SHIPPING_NEEDS_RECALCULATION: OPTION_SHIPPING_NEEDS_RECALCULATION,
    MERCHANT_SPECIFIC_ITEM_RELATIONSHIPS: OPTION_MERCHANT_SPECIFIC_ITEM_RELATIONSHIPS,
    ALL: OPTION_ALL
  };

  // Types of payment method
  var PAYMENT_METHOD_CREDIT_CARD = "Credit Card";
  var PAYMENT_METHOD_PURCHASE_ORDER = "Purchase Order";
  var PAYMENT_METHOD_PAYPAL = "PayPal";

  var payments = {
    CREDIT_CARD: PAYMENT_METHOD_CREDIT_CARD,
    PURCHASE_ORDER: PAYMENT_METHOD_PURCHASE_ORDER,
    PAYPAL: PAYMENT_METHOD_PAYPAL
  };

  // Types of credit cards
  var CREDIT_CARD_TYPE_AMEX = "AMEX";
  var CREDIT_CARD_TYPE_DISCOVER = "Discover";
  var CREDIT_CARD_TYPE_MASTERCARD = "MasterCard";
  var CREDIT_CARD_TYPE_JCB = "JCB";
  var CREDIT_CARD_TYPE_DINERS_CLUB = "Diners Club";
  var CREDIT_CARD_TYPE_VISA = "Visa";

  var creditCards = {
    AMEX: CREDIT_CARD_TYPE_AMEX,
    DISCOVER: CREDIT_CARD_TYPE_DISCOVER,
    MASTERCARD: CREDIT_CARD_TYPE_MASTERCARD,
    JCB: CREDIT_CARD_TYPE_JCB,
    DINERS_CLUB: CREDIT_CARD_TYPE_DINERS_CLUB,
    VISA: CREDIT_CARD_TYPE_VISA
  };

  // Types of options
  //noinspection JSUnusedLocalSymbols
  var OPTION_TYPE_SINGLE = "single";
  //noinspection JSUnusedLocalSymbols
  var OPTION_TYPE_MULTILINE = "multiline";
  //noinspection JSUnusedLocalSymbols
  var OPTION_TYPE_DROPDOWN = "dropdown";
  //noinspection JSUnusedLocalSymbols
  var OPTION_TYPE_HIDDEN = "hidden";
  //noinspection JSUnusedLocalSymbols
  var OPTION_TYPE_RADIO = "radio";
  //noinspection JSUnusedLocalSymbols
  var OPTION_TYPE_FIXED = "fixed";

  // Item multimedia types
  var ITEM_MULTIMEDIA_TYPE_IMAGE = "Image";
  var ITEM_MULTIMEDIA_TYPE_VIDEO = "Video";
  var ITEM_MULTIMEDIA_TYPE_UNKNOWN = "Unknown";
  var ITEM_MULTIMEDIA_TYPE_PDF = "PDF";
  var ITEM_MULTIMEDIA_TYPE_TEXT = "Text";

  var multimedia = {
    IMAGE: ITEM_MULTIMEDIA_TYPE_IMAGE,
    VIDEO: ITEM_MULTIMEDIA_TYPE_VIDEO,
    UNKNOWN: ITEM_MULTIMEDIA_TYPE_UNKNOWN,
    PDF: ITEM_MULTIMEDIA_TYPE_PDF,
    TEXT: ITEM_MULTIMEDIA_TYPE_TEXT
  };

  // Distance units of measure
  var DISTANCE_UOM_IN = "IN";
  var DISTANCE_UOM_CM = "CM";

  // Weight units of measure
  var WEIGHT_UOM_LB = "LB";
  var WEIGHT_UOM_KG = "KG";

  var UOM = {
    DISTANCE_UOM_IN: DISTANCE_UOM_IN,
    DISTANCE_UOM_CM: DISTANCE_UOM_CM,
    WEIGHT_UOM_LB: WEIGHT_UOM_LB,
    WEIGHT_UOM_KG: WEIGHT_UOM_KG
  };

  // Auto response names
  var AUTO_RESPONDER_NAME_ICONTACT = "icontact";
  var AUTO_RESPONDER_NAME_SILVERPOP = "silverpop";
  var AUTO_RESPONDER_NAME_MAILCHIMP = "mailchimp";
  var AUTO_RESPONDER_NAME_LYRIS = "lyris";
  var AUTO_RESPONDER_NAME_CAMPAIGNMONITOR = "campaignMonitor";
  var AUTO_RESPONDER_NAME_GETRESPONSE = "getResponse";
  var AUTO_RESPONDER_NAME_MADMIMI = "madmimi";

  //noinspection JSUnusedLocalSymbols
  var AUTO_RESPONDER_NAMES = [
    AUTO_RESPONDER_NAME_ICONTACT,
    AUTO_RESPONDER_NAME_SILVERPOP,
    AUTO_RESPONDER_NAME_MAILCHIMP,
    AUTO_RESPONDER_NAME_LYRIS,
    AUTO_RESPONDER_NAME_CAMPAIGNMONITOR,
    AUTO_RESPONDER_NAME_GETRESPONSE,
    AUTO_RESPONDER_NAME_MADMIMI
  ];

  var autoResponders = {
    ICONTACT: AUTO_RESPONDER_NAME_ICONTACT,
    SILVERPOP: AUTO_RESPONDER_NAME_SILVERPOP,
    MAILCHIMP: AUTO_RESPONDER_NAME_MAILCHIMP,
    LYRIS: AUTO_RESPONDER_NAME_LYRIS,
    CAMPAIGNMONITOR: AUTO_RESPONDER_NAME_CAMPAIGNMONITOR,
    GETRESPONSE: AUTO_RESPONDER_NAME_GETRESPONSE,
    MADMIMI: AUTO_RESPONDER_NAME_MADMIMI
  };


  var util = {
    getParameterValue: getParameterValue,
    getParameterValues: getParameterValues,
    getParameterMap: getParameterMap,
    javaUrlDecode: javaUrlDecode,
    postGet: postGet
  };


  var CHECKOUT_ULTRACART = 'checkoutultracart';
  var CHECKOUT_GOOGLE = 'checkoutgoogle';
  var CHECKOUT_PAYPAL = 'checkoutpaypal';

  var checkouts = {
    CHECKOUT_ULTRACART: CHECKOUT_ULTRACART,
    CHECKOUT_GOOGLE: CHECKOUT_GOOGLE,
    CHECKOUT_PAYPAL: CHECKOUT_PAYPAL
  };


  // ==================================================================================
  // NumberFormat
  // mredkj.com
  // version 2.0: refactored.  interface changes: currencyValue is now currencySymbol
  // ==================================================================================


  var numberFormat = (function () {

    //constants
    var COMMA = ',';
    var PERIOD = '.';
    var DASH = '-';
    var LEFT_PAREN = '(';
    var RIGHT_PAREN = ')';
    var LEFT_OUTSIDE = 0;
    var LEFT_INSIDE = 1;
    var RIGHT_INSIDE = 2;
    var RIGHT_OUTSIDE = 3;
    var LEFT_DASH = 0;
    var RIGHT_DASH = 1;
    var PARENTHESIS = 2;

    // these properties are assigned below based on the num and inputDecimal parameters
    var hasSeparators = false;
    var separatorValue = COMMA;
    var decimalSymbol = PERIOD;
    var negativeFormat = LEFT_DASH;
    var negativeRed = false;
    var hasCurrency = false;
    var currencyPosition = LEFT_OUTSIDE;
    var currencySymbol = '$';
    var places = 2;
    var roundToPlaces = 2;
    var truncate = false;

    /**
     * this method should be called first, every time.  It sets up the cart configuration and creates a local
     * copy of the cart.
     * @param opts format options
     */
    function init(opts) {

      if (opts.hasSeparators) {
        hasSeparators = opts.hasSeparators;
      }
      if (opts.separatorValue) {
        separatorValue = opts.separatorValue;
      }
      if (opts.decimalSymbol) {
        decimalSymbol = opts.decimalSymbol;
      }
      if (opts.negativeFormat) {
        negativeFormat = opts.negativeFormat;
      }
      if (opts.negativeRed) {
        negativeRed = opts.negativeRed;
      }
      if (opts.hasCurrency) {
        hasCurrency = opts.hasCurrency;
      }
      if (opts.currencyPosition) {
        currencyPosition = opts.currencyPosition;
      }
      if (opts.currencySymbol) {
        currencySymbol = opts.currencySymbol;
      }
      if (opts.places) {
        places = opts.places;
      }
      if (opts.roundToPlaces) {
        roundToPlaces = opts.roundToPlaces;
      }
      if (opts.truncate) {
        truncate = opts.truncate;
      }

    }

    function addSeparators(nStr, inD, outD, sep) {
      nStr += '';
      var dpos = nStr.indexOf(inD);
      var nStrEnd = '';
      if (dpos != -1) {
        nStrEnd = outD + nStr.substring(dpos + 1, nStr.length);
        nStr = nStr.substring(0, dpos);
      }
      var rgx = /(\d+)(\d{3})/;
      while (rgx.test(nStr)) {
        nStr = nStr.replace(rgx, '$1' + sep + '$2');
      }
      return nStr + nStrEnd;
    }

    function toCurrency(aNumber) {
      var nNum = aNumber;
      var nStr = null;
      if (roundToPlaces) {
        nNum = getRounded(nNum);
        nStr = preserveZeros(Math.abs(nNum));
      } else {
        nStr = expandExponential(Math.abs(nNum));
      }
      if (hasSeparators) {
        nStr = addSeparators(nStr, PERIOD, decimalSymbol, separatorValue);
      } else {
        nStr = nStr.replace(new RegExp('\\' + PERIOD), decimalSymbol);
      }
      var c0 = '';
      var n0 = '';
      var c1 = '';
      var n1 = '';
      var n2 = '';
      var c2 = '';
      var n3 = '';
      var c3 = '';
      var negSignL = (negativeFormat == PARENTHESIS) ? LEFT_PAREN : DASH;
      var negSignR = (negativeFormat == PARENTHESIS) ? RIGHT_PAREN : DASH;
      if (currencyPosition == LEFT_OUTSIDE) {
        if (nNum < 0) {
          if (negativeFormat == LEFT_DASH || negativeFormat == PARENTHESIS) {
            n1 = negSignL;
          }
          if (negativeFormat == RIGHT_DASH || negativeFormat == PARENTHESIS) {
            n2 = negSignR;
          }
        }
        if (hasCurrency) {
          c0 = currencySymbol;
        }
      } else if (currencyPosition == LEFT_INSIDE) {
        if (nNum < 0) {
          if (negativeFormat == LEFT_DASH || negativeFormat == PARENTHESIS) {
            n0 = negSignL;
          }
          if (negativeFormat == RIGHT_DASH || negativeFormat == PARENTHESIS) {
            n3 = negSignR;
          }
        }
        if (hasCurrency) {
          c1 = currencySymbol;
        }
      } else if (currencyPosition == RIGHT_INSIDE) {
        if (nNum < 0) {
          if (negativeFormat == LEFT_DASH || negativeFormat == PARENTHESIS) {
            n0 = negSignL;
          }
          if (negativeFormat == RIGHT_DASH || negativeFormat == PARENTHESIS) {
            n3 = negSignR;
          }
        }
        if (hasCurrency) {
          c2 = currencySymbol;
        }
      } else if (currencyPosition == RIGHT_OUTSIDE) {
        if (nNum < 0) {
          if (negativeFormat == LEFT_DASH || negativeFormat == PARENTHESIS) {
            n1 = negSignL;
          }
          if (negativeFormat == RIGHT_DASH || negativeFormat == PARENTHESIS) {
            n2 = negSignR;
          }
        }
        if (hasCurrency) {
          c3 = currencySymbol;
        }
      }
      nStr = c0 + n0 + c1 + n1 + nStr + n2 + c2 + n3 + c3;
      if (negativeRed && nNum < 0) {
        nStr = '<span style="color:red">' + nStr + '</span>';
      }
      return (nStr);
    }

    function toPercentage(aNumber) {
      return getRounded(aNumber * 100) + "%";
    }

    function getZeros(places) {
      var extraZ = '';
      var i;
      for (i = 0; i < places; i++) {
        extraZ += '0';
      }
      return extraZ;
    }

    function expandExponential(origVal) {
      if (isNaN(origVal)) {
        return origVal;
      }
      var newVal = parseFloat(origVal) + '';
      var eLoc = newVal.toLowerCase().indexOf('e');
      if (eLoc != -1) {
        var plusLoc = newVal.toLowerCase().indexOf('+');
        var negLoc = newVal.toLowerCase().indexOf('-', eLoc);
        var justNumber = newVal.substring(0, eLoc);
        var places = null;
        if (negLoc != -1) {
          places = newVal.substring(negLoc + 1, newVal.length);
          justNumber = moveDecimalAsString(justNumber, true, parseInt(places));
        } else {
          if (plusLoc == -1) {
            plusLoc = eLoc;
          }
          places = newVal.substring(plusLoc + 1, newVal.length);
          justNumber = moveDecimalAsString(justNumber, false, parseInt(places));
        }
        newVal = justNumber;
      }
      return newVal;
    }

    function moveDecimalRight(val, places) {
      var newVal = '';
      if (places == null) {
        newVal = moveDecimal(val, false);
      } else {
        newVal = moveDecimal(val, false, places);
      }
      return newVal;
    }

    function moveDecimalLeft(val, places) {
      var newVal = '';
      if (places == null) {
        newVal = moveDecimal(val, true);
      } else {
        newVal = moveDecimal(val, true, places);
      }
      return newVal;
    }

    function moveDecimalAsString(val, left, placesArg) {
      var spaces = (arguments.length < 3) ? places : placesArg;
      if (spaces <= 0) {
        return val;
      }
      var newVal = val + '';
      var extraZ = getZeros(spaces);
      var re1 = new RegExp('([0-9.]+)');
      var re2 = null;
      if (left) {
        newVal = newVal.replace(re1, extraZ + '$1');
        re2 = new RegExp('(-?)([0-9]*)([0-9]{' + spaces + '})(\\.?)');
        newVal = newVal.replace(re2, '$1$2.$3');
      } else {
        var reArray = re1.exec(newVal);
        if (reArray != null) {
          newVal = newVal.substring(0, reArray.index) + reArray[1] + extraZ + newVal.substring(reArray.index + reArray[0].length);
        }
        re2 = new RegExp('(-?)([0-9]*)(\\.?)([0-9]{' + spaces + '})');
        newVal = newVal.replace(re2, '$1$2$4.');
      }
      newVal = newVal.replace(/\.$/, '');
      return newVal;
    }

    function moveDecimal(val, left, places) {
      var newVal = '';
      if (places == null) {
        newVal = moveDecimalAsString(val, left);
      } else {
        newVal = moveDecimalAsString(val, left, places);
      }
      return parseFloat(newVal);
    }

    function getRounded(val) {
      val = moveDecimalRight(val);
      if (truncate) {
        val = val >= 0 ? Math.floor(val) : Math.ceil(val);
      } else {
        val = Math.round(val);
      }
      val = moveDecimalLeft(val);
      return val;
    }

    function preserveZeros(val) {
      var i;
      val = expandExponential(val);
      if (places <= 0) {
        return val;
      }
      var decimalPos = val.indexOf('.');
      if (decimalPos == -1) {
        val += '.';
        for (i = 0; i < places; i++) {
          val += '0';
        }
      } else {
        var actualDecimals = (val.length - 1) - decimalPos;
        var difference = places - actualDecimals;
        for (i = 0; i < difference; i++) {
          val += '0';
        }
      }
      return val;
    }


    return {
      toCurrency: toCurrency,
      toPercentage: toPercentage,
      init: init,
      COMMA: COMMA,
      PERIOD: PERIOD,
      DASH: DASH,
      LEFT_PAREN: LEFT_PAREN,
      RIGHT_PAREN: RIGHT_PAREN,
      LEFT_OUTSIDE: LEFT_OUTSIDE,
      LEFT_INSIDE: LEFT_INSIDE,
      RIGHT_INSIDE: RIGHT_INSIDE,
      RIGHT_OUTSIDE: RIGHT_OUTSIDE,
      LEFT_DASH: LEFT_DASH,
      RIGHT_DASH: RIGHT_DASH,
      PARENTHESIS: PARENTHESIS
    }
  }());
  // ==================================================================================
  // End of NumberFormat
  // ==================================================================================


  // ==================================================================================
  //Copyright (c) 2010 Nicholas C. Zakas. All rights reserved.
  //MIT License
  // UltraCart comments:  This is a generic event framework to allow for custom cart
  // events.   A prototype pattern within a module pattern.  <sigh>
  // ==================================================================================
  function EventTarget() {
    this._listeners = {};
  }

  EventTarget.prototype = {

    constructor: EventTarget,

    addListener: function (type, listener, internal) {
      if (typeof this._listeners[type] === "undefined") {
        this._listeners[type] = [];
      }

      this._listeners[type].push(listener);

      if (debugMode && !internal) {
        ucLogInfo("registered listener for event type " + type + " => " + listener);
      }
    },

    fire: function (event) {
      if (typeof event == "string") {
        event = { type: event };
      }
      if (!event.target) {
        event.target = this;
      }

      if (!event.type) {  //false
        ucLogError("Event object missing 'type' property.");
      }

      ucLogInfo("FIRE: " + event.type);
      if (this._listeners[event.type] instanceof Array) {
        var listeners = this._listeners[event.type];
        for (var i = 0, len = listeners.length; i < len; i++) {
          if (debugMode) {
            var functionName = "firing " + listeners[i];
            if (functionName.indexOf('()') > -1) {
              functionName = functionName.substring(0, functionName.indexOf('()'));
            }
            ucLogDebug(event.type + " => " + functionName);
          }

          listeners[i].call(this, event);
        }
      }
    },

    removeListener: function (type, listener) {
      if (this._listeners[type] instanceof Array) {
        var listeners = this._listeners[type];
        for (var i = 0, len = listeners.length; i < len; i++) {
          if (listeners[i] === listener) {
            listeners.splice(i, 1);
            break;
          }
        }
      }
    },

    clear: function () {
      this._listeners = {};
    }
  };

  //noinspection JSClosureCompilerSyntax
  var cartTarget = new EventTarget();
  var EVENT_CART_CHANGE = 'cartchange';
  var EVENT_CART_READY = 'cartready';
  var EVENT_SHIPPING_CHANGE = 'shippingchange';
  var EVENT_ADDRESS_CHANGE = 'addresschange';
  var EVENT_SHIPPING_METHODS_CHANGE = 'shippingmethodschange';
  var EVENT_PROFILE_CHANGE = 'profilechange';

  var events = {
    EVENT_CART_CHANGE: EVENT_CART_CHANGE,
    EVENT_CART_READY: EVENT_CART_READY,
    EVENT_SHIPPING_CHANGE: EVENT_SHIPPING_CHANGE,
    EVENT_ADDRESS_CHANGE: EVENT_ADDRESS_CHANGE,
    EVENT_SHIPPING_METHODS_CHANGE: EVENT_SHIPPING_METHODS_CHANGE,
    EVENT_PROFILE_CHANGE: EVENT_PROFILE_CHANGE
  };


  return{
    // === METHODS ==
    addItems: addItems,
    addListener: cartTarget.addListener,
    applyCoupon: applyCoupon,
    applyCoupons: applyCoupons,
    applyGiftCertificate: applyGiftCertificate,
    backgroundTimer: backgroundTimer,
    checkout: checkout,
    clearFinalizeAfter: clearFinalizeAfter,
    clearItems: clearItems,
    establishCustomerProfile: establishCustomerProfile,
    establishCustomerProfileImmediately: establishCustomerProfileImmediately,
    estimateShipping: estimateShipping,
    fire: cartTarget.fire,
    getAdvertisingSources: getAdvertisingSources,
    getAllowedCountries: getAllowedCountries,
    getCart: getCart,  // should be only property exposed
    getCartItemMultimediaThumbnail: getCartItemMultimediaThumbnail,
    getCheckoutTerms: getCheckoutTerms,
    getCityState: getCityState,
    getCustomerProfile: getCustomerProfile,
    getGiftSettings: getGiftSettings,
    getHostLink: getHostLink,
    getIpAddress: getIpAddress,
    getItem: getItem,
    getItems: getItems,
    getItemsForCatalogGroup: getItemsForCatalogGroup,
    getItemMultimediaThumbnail: getItemMultimediaThumbnail,
    getRelatedItems: getRelatedItems,
    getReturnPolicy: getReturnPolicy,
    getShippingChoice: getShippingChoice,
    getShippingMethods: getShippingMethods,
    getStateProvinces: getStateProvinces,
    getStateProvinceCodes: getStateProvinceCodes,
    getTaxCounties: getTaxCounties,
    init: init,
    loginCustomer: loginCustomer,
    loginCustomerProfile: loginCustomerProfile,
    logoutCustomer: logoutCustomer,
    logoutCustomerProfile: logoutCustomerProfile,
    pingRemoteServer: pingRemoteServer,
    refreshCart: updateCart,
    removeCoupon: removeCoupon,
    removeGiftCertificate: removeGiftCertificate,
    removeItem: removeItem,
    removeItemAtIndex: removeItemAtIndex,
    removeItems: removeItems,
    removeListener: cartTarget.removeListener,
    resetCustomerProfilePassword: resetCustomerProfilePassword,
    saveFieldElements: saveFieldElements,
    search: search,
    setAffiliate: setAffiliate,
    setFinalizeAfter: setFinalizeAfter,
    setShippingChoice: setShippingChoice,
    unabbreviateStateProvinceCode: unabbreviateStateProvinceCode,
    updateCustomerProfile: updateCustomerProfile,
    updateItems: updateItems,
    updateCart: updateCart,
    validate: validate,
    validateAll: validateAll,
    validateGiftCertificate: validateGiftCertificate,

    // === HELPERS ==
    util: util,

    // === CONSTANTS COLLECTIONS ==
    verify: verify,
    creditCards: creditCards,
    payments: payments,
    multimedia: multimedia,
    UOM: UOM,
    autoResponders: autoResponders,
    numberFormat: numberFormat,
    events: events,
    checkouts: checkouts
  }
}());