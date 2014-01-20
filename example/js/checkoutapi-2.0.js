// Add trim() method to the string object to make life easier.
String.prototype.trim = function() { return this.replace(/^\s+|\s+$/g, ''); };
String.prototype.startsWith = function(str){
    return (this.indexOf(str) === 0);
};


var ultraCart;
ultraCart = (function() {

  var ULTRACART_SITE = "secure.ultracart.com";
  var ULTRACART_ERROR_PARAM = 'ucError';
  var SHIPPING_ADDRESS_IS_PRIORITY = 'shipping';
  var BILLING_ADDRESS_IS_PRIORITY = 'billing';

  var checkoutSite = ULTRACART_SITE;
  var merchantId = "";
  var version = "1.1";  //server side, not client.  this might not match version number in this file's name.
  var remoteApiUrl = "https://" + ULTRACART_SITE + "/cgi-bin/UCCheckoutAPIJSON";
  var debugMode = false;
  var verboseAjax = false;
  var updateShippingOnAddressChange = false;
  var screenBrandingThemeCode = null;
  var shippingCountries = null;
  var billingCountries = null;

  var addressPriority = SHIPPING_ADDRESS_IS_PRIORITY;


  // Global cart variable
  var cart = null;

  // Shipping methods variable
  var shippingMethods = null; // an array of the current shipping methods available and their price
  var shippingChoice = null;  // the shipping choice currently selected. this is a transient variable and not stored anywhere
  var lastShippingEstimate = {
    shipToAddress1:null,
    shipToAddress2:null,
    shipToCity:null,
    shipToState:null,
    shipToZip:null,
    shipToCountry:null
  };
  var cartFieldMap = {
    shipToAddress1:null,  shipToAddress2:null, shipToCity:null,       shipToCompany:null,     shipToCountry:null, shipToEveningPhone:null, shipToFirstName:null,
    shipToLastName:null,  shipToPhone:null,    shipToPostalCode:null, shipToResidential:null, shipToState:null,   shipToTitle:null,        email:null,

    billToAddress1:null,  billToAddress2:null, billToCity:null,       billToCompany:null,     billToCountry:null, billToDayPhone:null,     billToEveningPhone:null,
    billToFirstName:null, billToLastName:null, billToPostalCode:null, billToState:null,       billToTitle:null,

    creditCardExpirationMonth:null,
    creditCardExpirationYear:null,
    creditCardNumber:null,
    creditCardType:null,
    creditCardVerificationNumber:null,

    mailingListOptIn:null
  };

  // Background timer
  var updateCartTimer;

  function getCart(){
    return cart;
  }


  // Static data used by the getStateProvinces() and getStateProvinceCodes()
  var ucStateProvinces = [
    {
      'country': 'United States',
      'stateProvinces' : ["Alabama","Alaska","American Samoa","Arizona","Arkansas","Armed Forces Africa","Armed Forces Americas","Armed Forces Canada","Armed Forces Europe","Armed Forces Middle East","Armed Forces Pacific","California","Colorado","Connecticut","Delaware","District of Columbia","Federated States of Micronesia","Florida","Georgia","Guam","Hawaii","Idaho","Illinois","Indiana","Iowa","Kansas","Kentucky","Louisiana","Maine","Marshall Islands","Maryland","Massachusetts","Michigan","Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire","New Jersey","New Mexico","New York","North Carolina","North Dakota","Northern Mariana Islands","Ohio","Oklahoma","Oregon","Palau","Pennsylvania","Puerto Rico","Rhode Island","South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont","Virgin Islands","Virginia","Washington","West Virginia","Wisconsin","Wyoming"],
      'codes': ["AL","AK","AS","AZ","AR","AE","AA","AE","AE","AE","AP","CA","CO","CT","DE","DC","FM","FL","GA","GU","HI","ID","IL","IN","IA","KS","KY","LA","ME","MH","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","MP","OH","OK","OR","PW","PA","PR","RI","SC","SD","TN","TX","UT","VT","VI","VA","WA","WV","WI","WY"]
    },
    {
      'country': 'Canada',
      'stateProvinces' : ["Alberta","British Columbia","Manitoba","New Brunswick","Newfoundland","Northwest Territories","Nova Scotia","Nunavut","Ontario","Prince Edward Island","Quebec","Saskatchewan","Yukon Territory"],
      'codes' : ["AB","BC","MB","NB","NF","NT","NS","NU","ON","PE","QC","SK","YT"]
    }
  ];

  /**
   * This method makes the actual call to the remote server.
   * @param functionName name of the remote function to execute
   * @param params remote function parameters
   * @param opts optional ucRemoteCall options(async=true/false,onComplete=callback)
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


    // jsonify all the parameters.
    for (var prop in params) {
      if (params.hasOwnProperty(prop)) {
        params[prop] = jQuery.toJSON(params[prop]);
      }
    }

    // add the function name and meta data to the params for remote execution
    params['functionName'] = functionName;
    params['merchantId'] = merchantId;
    params['version'] = version;

    // Do we want async?
    var async = false;
    var onComplete;

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

    jQuery.ajax(
    {
      url: remoteApiUrl,
      async: async,
      cache: false,
      dataType: 'json',
      global: true,
      data: params,
      type: 'POST',
      success: function(jsonResult) {
        // Store the result into our variable.
        if (debugMode && verboseAjax) {
          ucLogDebug("ucRemoteCall: success");
        }
        result = jsonResult;

        // Call their function
        if (async && onComplete != undefined) {
          ucLogDebug("ucRemoteCall: calling onComplete now.");
          onComplete(result);
        }
      },
      error: function(xhr, textStatus, errorThrown) {
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
    if (updatedCart == null || updatedCart.cartId == null) return;
    cart = updatedCart;
    if(!doNotNotify){
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
        cart.creditCardExpirationYear = isNaN(cart.creditCardExpirationYear) ? 0 :parseInt(cart.creditCardExpirationYear);
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
    var result = ucRemoteCall('updateCart', { 'parameter1': cart}, opts);
    if (result != null){
      ucSetCart(result);
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


    if(config.numberFormatConfig){
      numberFormat.init(config.numberFormatConfig);
    }

    cartTarget.clear(); // needed in case of re-initialization

    // window dressing for a checkout page. ignore if this is a lightweight page like an item display page.
    if(config.isCheckoutPage){

      if(config.updateShippingOnAddressChange){
        updateShippingOnAddressChange = true;
      }

      if(config.addressPriority){
        if(config.addressPriority != SHIPPING_ADDRESS_IS_PRIORITY && config.addressPriority != BILLING_ADDRESS_IS_PRIORITY){
          ucLogError('invalid addressPriority (' + config.addressPriority + '), only "shipping" and "billing" are valid values.');
        } else {
          addressPriority = config.addressPriority;
        }
      }



      if(config.listeners){
        for(var evt in config.listeners){
          if(evt == EVENT_CART_CHANGE || evt == EVENT_SHIPPING_CHANGE || evt == EVENT_ADDRESS_CHANGE || evt == EVENT_SHIPPING_METHODS_CHANGE || evt == EVENT_CART_READY){
            var funcs = config.listeners[evt];
            for(var i = 0; i < funcs.length; i++){
              cartTarget.addListener(evt, funcs[i]);
            }
          } else {
            ucLogError('unknown ultracart event: ' + evt);
          }
        }
      }



      // this is for re-initialization. clean up no matter what so a cart can go from having events to not cleanly.
      for (var f in cartFieldMap) {
        if (cartFieldMap.hasOwnProperty(f)) {
          if(cartFieldMap[f] != null){
            ucLogDebug("unbinding all events for " + f);
            jQuery(cartFieldMap[f]).unbind('.ultraCart');
            cartFieldMap[f] = null;
          }
        }
      }

      if(config.cartFieldMapping){
        for(var fld in config.cartFieldMapping){
          if(cartFieldMap.hasOwnProperty(fld)){
            if(!config.cartFieldMapping[fld]){ continue; /* ignore null values and such */}

            var el = document.getElementById(config.cartFieldMapping[fld]);
            if(el == null){
              ucLogError('config.cartFieldMapping[' + fld + '] is pointing to element.id=' + config.cartFieldMapping[fld] + ', but there is no html element with that id.  cannot map cart field.')
              continue;
            }

            cartFieldMap[fld] = el; // need this later for the field>cart procedure.

            // bind cart handles element->cart mappings
            // bind shipping creates triggers to update shipping when specific values change
            ucBindCartField(fld, el);
            if(lastShippingEstimate.hasOwnProperty(fld)){
              ucBindShippingField(fld, el);
            }
          } else {
            ucLogError('unknown ultracart field mapping (' + fld + ')');
          }
        }
      }

      if(updateShippingOnAddressChange){
        cartTarget.addListener(EVENT_ADDRESS_CHANGE, ucUpdateShippingMethodsForAddressChange, true);
      }


      ucInitCartInstance();


      if(config.shippingCountries){
        shippingCountries = config.shippingCountries;
      } else {
        shippingCountries = getAllowedCountries();
      }


      if(config.billingCountries){
        billingCountries = config.billingCountries
      } else {
        billingCountries = shippingCountries;
      }



      var noPriorShippingMethod = false;
      if(cart.shippingMethod){
        noPriorShippingMethod = true;
        shippingChoice = cart.shippingMethod;
      }

      if(screenBrandingThemeCode && cart && screenBrandingThemeCode != cart.screenBrandingThemeCode){
        cart.screenBrandingThemeCode = screenBrandingThemeCode;  // if this isn't set already, then shipping isn't set either. it'll get updated together.
      }

      ucGetShippingMethods();
      ucSyncShippingChoice();

      lastShippingEstimate.shipToAddress1 = cart.shipToAddress1;
      lastShippingEstimate.shipToAddress2 = cart.shipToAddress2;
      lastShippingEstimate.shipToCity = cart.shipToCity;
      lastShippingEstimate.shipToState = cart.shipToState;
      lastShippingEstimate.shipToZip = cart.shipToPostalCode;
      lastShippingEstimate.shipToCountry = cart.shipToCountry;

      if(shippingChoice && shippingChoice != cart.shippingMethod){
        cart.shippingMethod = shippingChoice;
        updateCart(
        {
          async:true
          ,onComplete:function(result){
            ucSetCart(result);

          }
        });
      }

      cartTarget.addListener(EVENT_CART_CHANGE, ucUpdateShippingMethodsAsync, true);

      ucPopulateFieldElements();
    } else { // just initialize the cart.
      ucInitCartInstance();
    } //end-if isCheckoutPage==true/false


    // lastly (to avoid laggin anything)
    if(config.unifiedAffiliateTracking){
      ucLogDebug("tracking affiliates");
      ucTrackAffiliates();
    }

    ucLogDebug("init finished. (async calls may still finish)");
    cartTarget.fire(EVENT_CART_READY);

  }

  function ucPopulateFieldElements(){
    if(cart == null) return;


    // populate the credit card types select box.
    if(uc.getCart() != null){
      var cardTypes = uc.getCart().creditCardTypes;
      var cardTypesHtml = '<option value="">Select Type<\/option>';
      for(var j = 0; j < cardTypes.length; j++){
        cardTypesHtml += "<option value='" + cardTypes[j] + "'>" + cardTypes[j] + "<\/option>";
      }
      jQuery('#creditCardType').html(cardTypesHtml);
    }

    // populate the credit card expiration year select box. 25 years.
    var currentDate = new Date();
    var currentYear = currentDate.getFullYear();
    var creditCardExpYearHtml = '<option value="">Select Year<\/option>';
    for(var i = 0; i < 25; i++){
      creditCardExpYearHtml += "<option>" + (currentYear + i) + "<\/option>";
    }
    jQuery('#creditCardExpYear').html(creditCardExpYearHtml);


    // hard code countries to just US for this cart.
    var scHtml = '';
    for(var b = 0; b < shippingCountries.length; b++){
      scHtml += '<option value="' + shippingCountries[b] + '">' + shippingCountries[b] + '<\/option>';
    }
    jQuery('#shippingCountry').html(scHtml);

    var bcHtml = '';
    for(var b = 0; b < billingCountries.length; b++){
      bcHtml += '<option value="' + billingCountries[b] + '">' + billingCountries[b] + '<\/option>';
    }
    jQuery('#billingCountry').html(bcHtml);



    ucLogDebug("populating field elements with cart values");
    for (var fieldName in cartFieldMap) {
      if (!cart.hasOwnProperty(fieldName)) { continue; /* should never happen, but safety check */ }

      var el = cartFieldMap[fieldName];
      if(!el){
        ucLogDebug("[cart>elements]: no mapping for " + fieldName);
        continue;
      }

      if(!cart[fieldName]){
        ucLogDebug("[cart>elements]: cart has no value for " + fieldName);
        continue;
      }

      var fld = jQuery(el);
      if(!fld){
        ucLogDebug("[cart>elements]: jQuery could not wrap element for field " + fieldName);
        continue;
      }

      ucLogDebug("[cart>elements]: " + fieldName + "=>" + cart[fieldName]);
      if(fld.is('input:checkbox')){
        fld.attr("checked", cart[fieldName] || false);
      }else if(fld.is('input')){
        fld.val(cart[fieldName]);
      } else if (fld.is('select')){
        // try to set value first, then text.
        fld.val(cart[fieldName]);
        // if nothing was set, try the text value.
        if(!fld.val()){
          jQuery('option', fld).each(function(){
            this.selected = (this.text == cart[fieldName]);
          });
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
  function saveFieldElements(callback){
    if(cart == null) return;

    ucLogDebug("populating cart values with field elements");
    for (var fieldName in cartFieldMap) {
      if (!cart.hasOwnProperty(fieldName)) { continue; /* should never happen, but safety check */ }

      var el = cartFieldMap[fieldName];
      if(!el){
        ucLogDebug("[cart>elements]: no mapping for " + fieldName);
        continue;
      }

      var fld = jQuery(el);
      if(!fld){
        ucLogDebug("[cart>elements]: jQuery could not wrap the field element for " + fieldName);
        continue;
      }

      if(fld.is('input:checkbox')){
        cart[fieldName] = fld.attr("checked");
      }else if(fld.is('input')){
        cart[fieldName] = fld.val() || '';
      } else if (fld.is('select')){
        cart[fieldName] = fld.val() || '';
      }
    }

    // copy shipping to billing where missing
    if(addressPriority == SHIPPING_ADDRESS_IS_PRIORITY){
      if(!cart.billToAddress1) cart.billToAddress1 = cart.shipToAddress1;
      if(!cart.billToAddress2) cart.billToAddress2 = cart.shipToAddress2;
      if(!cart.billToCity) cart.billToCity = cart.shipToCity;
      if(!cart.billToState) cart.billToState = cart.shipToState;
      if(!cart.billToCountry) cart.billToCountry = cart.shipToCountry;
      if(!cart.billToPostalCode) cart.billToPostalCode = cart.shipToPostalCode;
      if(!cart.billToFirstName) cart.billToFirstName = cart.shipToFirstName;
      if(!cart.billToLastName) cart.billToLastName = cart.shipToLastName;
    } else {
      if(!cart.shipToAddress1) cart.shipToAddress1 = cart.billToAddress1;
      if(!cart.shipToAddress2) cart.shipToAddress2 = cart.billToAddress2;
      if(!cart.shipToCity) cart.shipToCity = cart.billToCity;
      if(!cart.shipToState) cart.shipToState = cart.billToState;
      if(!cart.shipToCountry) cart.shipToCountry = cart.billToCountry;
      if(!cart.shipToPostalCode) cart.shipToPostalCode = cart.billToPostalCode;
      if(!cart.shipToFirstName) cart.shipToFirstName = cart.billToFirstName;
      if(!cart.shipToLastName) cart.shipToLastName = cart.billToLastName;
    }



    updateCart({async:true,onComplete:callback});
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


  function addItems(items, opts) {
    // an empty cart has no shipping methods. so check for an empty cart first.
    // if the cart goes from empty->items, estimateShipping needs to be called.
    var cartWasEmpty = true;
    if(cart != null && cart.items && cart.items.length > 0){
      cartWasEmpty = false;
    }

    ucSanitizeDataTypes();
    var result = ucRemoteCall('addItems', { 'parameter1': cart, 'parameter2': items}, opts);

    if (result != null && result.cart != null){
      ucSetCart(result.cart, true); // don't notify yet, but set the cart for use below.

      if(cartWasEmpty && cart != null && cart.items && cart.items.length > 0){
        ucUpdateShippingMethodsAsync({
          async:true,
          onComplete:function(){

            // we just got back from updating the cart and now we're going back?
            // because the shipping methods weren't there before on an empty cart
            // we want to be sure to set the method again if needed.
            if(shippingChoice && shippingChoice != cart.shippingMethod){
              ucLogDebug("shippingChoice != cart.shippingMethod.  fixing up.");
              cart.shippingMethod = shippingChoice;
              updateCart(
              {
                async:true
                ,onComplete:function(){
                  cartTarget.fire(EVENT_CART_CHANGE);

                }
              });
            } else { // nothing done, just send out the notification
              cartTarget.fire(EVENT_CART_CHANGE);
            }


          }});
      } else { // cart was not empty prior to this add
        cartTarget.fire(EVENT_CART_CHANGE);
      }
    }
    if (result == null) return ["addItems result was null"];
    return result.errors;

  }

  function removeItems(itemIds, opts) {
    ucSanitizeDataTypes();
    var result = ucRemoteCall('removeItems', { 'parameter1': cart, 'parameter2': itemIds}, opts);
    if (result != null && result.cart != null){
      ucSetCart(result.cart);
    }
    if (result == null) return ["removeItems result was null"];
    return result.errors;
  }

  function removeItem(itemId, opts) {
    ucSanitizeDataTypes();
    var result = ucRemoteCall('removeItem', { 'parameter1': cart, 'parameter2': itemId}, opts);
    if (result != null && result.cart != null){
      ucSetCart(result.cart);
    }
    if (result == null) return ["removeItem result was null"];
    return result.errors;
  }

  function clearItems(opts) {
    ucSanitizeDataTypes();
    var result = ucRemoteCall('clearItems', {'parameter1': cart}, opts);
    if (result != null && result.cart != null){
      ucSetCart(result.cart);
    }
    if (result == null) return ["clearItems result was null"];
    return result.errors;
  }


  function updateItems(items, opts) {

    // an empty cart has no shipping methods. so check for an empty cart first.
    // if the cart goes from empty->items, estimateShipping needs to be called.
    var cartWasEmpty = true;
    if(cart != null && cart.items && cart.items.length > 0){
      cartWasEmpty = false;
    }

    ucSanitizeDataTypes();
    var result = ucRemoteCall('updateItems', {'parameter1': cart, 'parameter2': items}, opts);
    if (result != null && result.cart != null){
      ucSetCart(result.cart, true); // don't notify yet, but set the cart for use below.

      if(cartWasEmpty && cart != null && cart.items && cart.items.length > 0){
        ucUpdateShippingMethodsAsync({
          async:true,
          onComplete:function(){

            // we just got back from updating the cart and now we're going back?
            // because the shipping methods weren't there before on an empty cart
            // we want to be sure to set the method again if needed.
            if(shippingChoice && shippingChoice != cart.shippingMethod){
              ucLogDebug("shippingChoice != cart.shippingMethod.  fixing up.");
              cart.shippingMethod = shippingChoice;
              updateCart(
              {
                async:true
                ,onComplete:function(){
                  cartTarget.fire(EVENT_CART_CHANGE);

                }
              });
            } else { // nothing done, just send out the notification
              cartTarget.fire(EVENT_CART_CHANGE);
            }


          }});
      } else { // cart was not empty prior to this add
        cartTarget.fire(EVENT_CART_CHANGE);
      }
    }

    if (result == null) return ["updateItems result was null"];
    return result.errors;
  }



  function establishCustomerProfile(email, password, opts) {

    ucSanitizeDataTypes();
    var result = ucRemoteCall('establishCustomerProfile', {'parameter1': cart, 'parameter2': email, 'parameter3': password}, opts);
    if (result != null && result.cart != null){
      ucSetCart(result.cart);
    }
    if (result == null) return ["establishCustomerProfile result was null"];
    return result.errors;
  }

  function establishCustomerProfileImmediately(email, password, opts) {

    ucSanitizeDataTypes();
    var result = ucRemoteCall('establishCustomerProfileImmediately', {'parameter1': cart, 'parameter2': email, 'parameter3': password}, opts);
    if (result != null && result.cart != null){
      ucSetCart(result.cart);
    }
    if (result == null) return ["establishCustomerProfileImmediatey result was null"];
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
    if(typeof window.console === 'undefined') return;
    if (debugMode) {
      if (console.debug) {
        console.debug("[DEBUG] " + msg);
      } else if (console.log) {
        console.log("[DEBUG] " + msg);
      }
    }
  }

  function ucLogInfo(msg) {
    if(typeof window.console === 'undefined') return;
    if (debugMode) {
      if (console.info) {
        console.info("[INFO] " + msg);
      } else if (console.log) {
        console.log("[INFO] " + msg);
      }
    }
  }

  function ucLogWarn(msg) {
    if(typeof window.console === 'undefined') return;
    if (debugMode) {
      if (console.warn) {
        console.warn("[WARN] " + msg);
      } else if (console.log) {
        console.log("[WARN] " + msg);
      }
    }
  }

  function ucLogError(msg) {
    if(typeof window.console === 'undefined') return;
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
        var firebugLite = function(F, i, r, e, b, u, g, L, I, T, E) {
          if (F.getElementById(b))return;
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
    if(typeof window.console === 'undefined') return;
    if (debugMode && console.trace) {
      console.trace();
    }
  }


  function isDiff(o1, o2) {
    if (o1 == null && o2 == null) return false;
    if (o1 == null && o2 != null) return true;
    if (o1 != null && o2 == null) return true;
    return o1 == o2;
  }

  /**
   * legacy api call. don't recommend using it.  there are more elegant solutions.
   * @param opts async and onComplete properties.
   */
  function estimateShipping(opts) {
    if(opts && opts.async){
      ucUpdateShippingMethodsForAddressChange();
      return null;
    } else {
      ucGetShippingMethods();
      return shippingMethods;
    }
  }


  function getShippingMethods(){
    return shippingMethods;
  }

  function ucGetShippingMethods(opts){
    ucSanitizeDataTypes();
    shippingMethods = ucRemoteCall('estimateShipping', {'parameter1': cart}, opts);
  }

  function ucUpdateShippingMethodsForAddressChange(){

    ucLogDebug("checking to see if shipping needs updating...");

    if (cart && lastShippingEstimate && (
        isDiff(lastShippingEstimate.shipToAddress1, cart.shipToAddress1) ||
        isDiff(lastShippingEstimate.shipToAddress2, cart.shipToAddress2) ||
        isDiff(lastShippingEstimate.shipToCity, cart.shipToCity) ||
        isDiff(lastShippingEstimate.shipToState, cart.shipToState) ||
        isDiff(lastShippingEstimate.shipToZip, cart.shipToPostalCode) ||
        isDiff(lastShippingEstimate.shipToCountry, cart.shipToCountry)
        )) {

      ucLogDebug("...it does.  updating shipping (if I have enough fields).");
      if(cart.shipToCity && cart.shipToState && cart.shipToPostalCode){
        ucUpdateShippingMethodsAsync();
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
  function ucUpdateShippingMethodsAsync(opts){

    ucLogDebug("updating shipping methods async");

    ucGetShippingMethods({
      async:true,
      onComplete:function(result){
        shippingMethods = result;
        ucSyncShippingChoice();

        cartTarget.fire(EVENT_SHIPPING_METHODS_CHANGE);
        lastShippingEstimate.shipToAddress1 = cart.shipToAddress1;
        lastShippingEstimate.shipToAddress2 = cart.shipToAddress2;
        lastShippingEstimate.shipToCity = cart.shipToCity;
        lastShippingEstimate.shipToState = cart.shipToState;
        lastShippingEstimate.shipToZip = cart.shipToPostalCode;
        lastShippingEstimate.shipToCountry = cart.shipToCountry;

        if(opts.async && opts.onComplete){
          opts.onComplete();
        }

      }
    });
  }


  /**
   * compares the shipping choice to the cart and available shipping methods.
   * adjust them if 1) no shipping choice has been made or 2) current choice is no longer available
   */
  function ucSyncShippingChoice(){

    // situation: customer has 2 items in cart, and selected cheapest method.
    // customer then adds 30 more items.  package is now too big for cheapest method.
    // check to see if there's a shipping choice and ensure it's a valid choice, if not,
    // select the cheapest one and fire off that it's changed.
    var shippingChoiceIsInvalid = true;
    if(shippingChoice && shippingMethods){
      for(var z = 0; z < shippingMethods.length; z++){
        if(shippingMethods[z].name == shippingChoice){
          shippingChoiceIsInvalid = false;
        }
      }
    }

    if(shippingChoiceIsInvalid){
      shippingChoice = ''; // reset it.
      if(shippingMethods && shippingMethods.length){
        for(var w = 0; w < shippingMethods.length; w++){
          if(shippingMethods[w].defaultMethod){
            shippingChoice = shippingMethods[w].name;
            shippingChoiceIsInvalid = false;
          }
        }
      }
    }

    // if the shippingChoice is still invalid, it means the default method is not available.
    // in that case, choose the cheapest method.  it'll be the first one.
    if(shippingChoiceIsInvalid && shippingMethods && shippingMethods.length && shippingMethods.length > 0){
      shippingChoice = shippingMethods[0].name;
    }

  }


  function getRelatedItems(opts) {
    ucSanitizeDataTypes();
    return ucRemoteCall('getRelatedItems', {'parameter1': cart}, opts);
  }

  function getGiftSettings(opts) {
    ucSanitizeDataTypes();
    return ucRemoteCall('getGiftSettings', {'parameter1': cart}, opts);
  }

  function getItems(itemIds, opts) {
    return ucRemoteCall('getItems', {'parameter1': itemIds, 'parameter2': cart}, opts);
  }

  function getItem(itemId, opts) {
    return ucRemoteCall('getItem', {'parameter1': itemId, 'parameter2': cart}, opts);
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
    if (result != null && result.cart != null) ucSetCart(result.cart);
    if (result == null) return ["logoutCustomerProfile result was null"];
    return result.errors;
  }

  function setFinalizeAfter(minutes, opts) {
    ucSanitizeDataTypes();
    return ucRemoteCall('setFinalizeAfter', {'parameter1': cart, 'parameter2': minutes}, opts);
  }

  function clearFinalizeAfter(opts) {
    ucSanitizeDataTypes();
    return ucRemoteCall('clearFinalizeAfter', {'parameter1': cart}, opts);
  }

  function checkout(checkoutMethod, opts){

    ucSanitizeDataTypes();

    var methodName = 'checkoutHandoff'; // default, also what CHECKOUT_ULTRACART points to
    if(checkoutMethod){
      if(checkoutMethod == CHECKOUT_GOOGLE){
        ucLogInfo("[CHECKOUT] executing google checkout");
        methodName = 'googleCheckoutHandoff';
      } else if(checkoutMethod == CHECKOUT_PAYPAL){
        ucLogInfo("[CHECKOUT] executing paypal checkout");
        methodName = 'paypalHandoff';
      } else if(checkoutMethod == CHECKOUT_ULTRACART){
        ucLogInfo("[CHECKOUT] executing standard checkout");
      }
    } else {
      ucLogInfo("[CHECKOUT] no checkoutMethod provided, executing standard checkout");
    }


    var customUrl = (checkoutSite != ULTRACART_SITE);
    if(customUrl){
      return ucRemoteCall(methodName, {'parameter1': cart, 'parameter2': checkoutSite, 'parameter3': document.URL, 'parameter4': ULTRACART_ERROR_PARAM}, opts);
    } else {
      return ucRemoteCall(methodName, {'parameter1': cart, 'parameter2': document.URL, 'parameter3': ULTRACART_ERROR_PARAM}, opts);
    }
  }


  function validateGiftCertificate(giftCertificateCode, opts) {
    return ucRemoteCall('validateGiftCertificate', {'parameter1': giftCertificateCode, 'parameter2': cart}, opts);
  }

  function applyGiftCertificate(giftCertificateCode, opts) {
    ucSanitizeDataTypes();
    var result = ucRemoteCall('applyGiftCertificate', {'parameter1': cart, 'parameter2': giftCertificateCode}, opts);
    if (result != null && result.cart != null){
      ucSetCart(result.cart);
    }
    if (result == null) return ["applyGiftCertificate result was null"];
    return result.errors;
  }

  function removeGiftCertificate(opts) {
    ucSanitizeDataTypes();
    var result = ucRemoteCall('removeGiftCertificate', {'parameter1': cart}, opts);
    if (result != null && result.cart != null){
      ucSetCart(result.cart);
    }
    if (result == null) return ["removeGiftCertificate result was null"];
    return result.errors;
  }

  function applyCoupon(couponCode, opts) {

    ucSanitizeDataTypes();
    var result = ucRemoteCall('applyCoupon', {'parameter1': cart, 'parameter2': couponCode}, opts);
    if (result != null && result.cart != null){
      ucSetCart(result.cart);
    }
    if (result == null) return ["applyCoupon result was null"];
    return result.errors;
  }

  function removeCoupon(couponCode, opts) {

    ucSanitizeDataTypes();
    var result = ucRemoteCall('removeCoupon', {'parameter1': cart, 'parameter2': couponCode}, opts);
    // for this method, the result IS the cart object.
    if (result != null){
      ucSetCart(result);
    }
    if (result == null) return ["removeCoupon result was null"];
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
  function ucTrackAffiliates(){
    ucRemoteCall('getUnifiedAffiliateCookieScript', {parameter1: checkoutSite}, {async:true,
      onComplete:function(result){
        if(result){
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

    return new Array();
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

    return new Array();
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
      type: 'POST', success: function(responseText) {
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
    if (cart != null) return;

    if (readCookie('UltraCartShoppingCartID')) {
      cart = ucGetCart(readCookie('UltraCartShoppingCartID'));
      if (cart == null) {
        eraseCookie('UltraCartShoppingCartID');
        cart = ucCreateCart();
        createCookie('UltraCartShoppingCartID', cart.cartId, 0);
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
  function setShippingChoice(choice){
    ucLogDebug("setShippingChoice('" + choice + "')");
    shippingChoice = choice;
    cart.shippingMethod = choice;

    cartTarget.fire(EVENT_SHIPPING_CHANGE);

    updateCart(
    {
      async:true,
      onComplete:function(result){
        ucSetCart(result, true);
      }
    });
  }

  function getShippingChoice(){
    if(!shippingChoice || !shippingMethods) return null;
    for(var i = 0; i< shippingMethods.length; i++){
      if(shippingChoice == shippingMethods[i].name) return shippingMethods[i];
    }
    return null;
  }


  function ucMakeBindShippingField(field, element){
    function checkForChange(){
      var lastValue = lastShippingEstimate[field];
      var currentValue = null;
      var el = jQuery(element);
      if(el.is('input')){
        currentValue = el.val();
      } else if(el.is('select')){
        currentValue = el.val() || el.text();
      }

      if(currentValue) currentValue = currentValue.trim();
      if(lastValue == null){
        ucLogDebug("updating lastShippingEstimate[" + field + "], was null, now => " + currentValue);
        lastShippingEstimate[field] = currentValue;
        cartTarget.fire(EVENT_ADDRESS_CHANGE);
      } else if(lastValue != currentValue){
        ucLogDebug("updating lastShippingEstimate[" + field + "] " + lastShippingEstimate[field] + " => " + currentValue);
        lastShippingEstimate[field] = currentValue;
        cartTarget.fire(EVENT_ADDRESS_CHANGE);
      } else {
        ucLogDebug("blur called, but no change for lastShippingEstimate[" + field + "]");
      }
    }

    return checkForChange;
  }

  function ucBindShippingField(field, element){
    ucLogDebug("binding " + field + " to element " + element.id);
    jQuery(element).bind('blur.ultraCart', ucMakeBindShippingField(field,element));
  }




  function ucMakeBindCartField(field, element){
    function checkForChange(){
      var currentValue = null;
      var el = jQuery(element);
      if(el.is('input:checkbox')){
        currentValue = el.attr('checked');
      }else if(el.is('input')){
        currentValue = el.val();
      } else if(el.is('select')){
        currentValue = el.val();
      }

      if(cart){
        ucLogDebug("updating cart." + field + " " + cart[field] + " => " + currentValue);
        cart[field] = currentValue;

        // save off the email immediately.
        if(field == 'email'){
          updateCart({async:true});
        }

      }
    }

    return checkForChange;
  }

  function ucBindCartField(field, element){
    ucLogDebug("[cart] binding " + field + " to element " + element.id);
    jQuery(element).bind('blur.ultraCart', ucMakeBindCartField(field,element));
  }


  /**
   * takes a url, constructs a form with parameters, and then posts it
   * @param getUrl a full url suitable for location.href
   */
  function postGet(getUrl){

    var url = document.createElement('a');
    url.href = getUrl;
    if(url.search != null){
      var paramMap = getParameterMap(url.search.substring(1)); // substring removes question mark
    }

    var action = url.href.replace(url.search, '');

    var form = document.createElement('form');
    form.method = 'post';
    form.action = action;

    for (var param in paramMap) {
      if (paramMap.hasOwnProperty(param)) {
        var values = paramMap[param];
        for(var i = 0; i < values.length; i++){
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
    var result = [];

    // Make sure there is a query parameter
    if (window.location.search == null) return result;

    // Get everything after the ?
    var query = window.location.search.substring(1);

    // Split into name/value pairs
    var vars = query.split("&");
    for (var i = 0; i < vars.length; i++) {

      // Split into name and value array
      var pair = vars[i].split("=");

      // Does the name match our errorParameterName?
      if (pair[0] == parameterName) {

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
    if (queryString == null) return result;

    // Split into name/value pairs
    var vars = queryString.split("&");
    for (var i = 0; i < vars.length; i++) {

      // Split into name and value array
      var pair = vars[i].split("=");

      if(!result.hasOwnProperty(pair[0])){
        result[pair[0]] = [];
      }
      result[pair[0]].push(javaUrlDecode(pair[1]))

    }

    return result;
  }

  function getParameterValue(parameterName) {

    // Make sure there is a query parameter
    if (window.location.search == null) return null;

    // Get everything after the ?
    var query = window.location.search.substring(1);

    // Split into name/value pairs
    var vars = query.split("&");
    for (var i = 0; i < vars.length; i++) {

      // Split into name and value array
      var pair = vars[i].split("=");

      // Does the name match our errorParameterName?
      if (pair[0] == parameterName) {

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

  // Methods to help work with JSON seralized dates like shipOnDate and deliveryDate

  function ucMonthNumberToAbbrev(m) {
    if (m == 0) return "Jan";
    if (m == 1) return "Feb";
    if (m == 2) return "Mar";
    if (m == 3) return "Apr";
    if (m == 4) return "May";
    if (m == 5) return "Jun";
    if (m == 6) return "Jul";
    if (m == 7) return "Aug";
    if (m == 8) return "Sep";
    if (m == 9) return "Oct";
    if (m == 10) return "Nov";
    if (m == 11) return "Dec";
    return "Dec";
  }

  function ucGetHoursAMPM(h) {
    if (h >= 12) h = h - 12;
    if (h == 0) return 12;
    return h;
  }

  function ucGetAMPM(h) {
    if (h < 12) return "AM";
    return "PM";
  }

  function ucPadTwo(v) {
    var s = "" + v;
    if (s.length == 1) s = "0" + s;
    return s;
  }

  function ucJsonStringToDate(s) {
    if (s == null) return null;
    return new Date(s);
  }

  function ucDateToJsonString(d) {
    if (d == null) return null;
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
      while (c.charAt(0) == ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
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
  var OPTION_SHIPPING_ADDRESS_PROVIDED = "Shipping Addres Provided";
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
    ITEM_QUANTITY_VALID:OPTION_ITEM_QUANTITY_VALID,
    BILLING_ADDRESS_PROVIDED:OPTION_BILLING_ADDRESS_PROVIDED,
    BILLING_STATE_ABBREVIATION_VALID:OPTION_BILLING_STATE_ABBREVIATION_VALID,
    BILLING_PHONE_NUMBERS_PROVIDED:OPTION_BILLING_BILLING_PHONE_NUMBERS_PROVIDED,
    EMAIL_PROVIDED_IF_REQUIRED:OPTION_EMAIL_PROVIDED_IF_REQUIRED,
    BILLING_VALIDATE_CITY_STATE_ZIP:OPTION_BILLING_VALIDATE_CITY_STATE_ZIP,
    TAXCOUNTYSPECIFIED:OPTION_TAX_COUNTY_SPECIFIED,
    SHIPPING_METHOD_PROVIDED:OPTION_SHIPPING_METHOD_PROVIDED,
    ADVERTISING_SOURCE_PROVIDED:OPTION_ADVERTISING_SOURCE_PROVIDED,
    REFERRAL_CODE_PROVIDED:OPTION_REFERRAL_CODE_PROVIDED,
    SHIPPING_ADDRESS_PROVIDED:OPTION_SHIPPING_ADDRESS_PROVIDED,
    SHIPPING_STATE_ABBREVIATION_VALID:OPTION_SHIPPING_STATE_ABBREVIATION_VALID,
    GIFT_MESSAGE_LENGTH:OPTION_GIFT_MESSAGE_LENGTH,
    SHIPPING_VALIDATE_CITY_STATE_ZIP:OPTION_SHIPPING_VALIDATE_CITY_STATE_ZIP,
    SHIPPING_DESTINATION_RESTRICTION:OPTION_SHIPPING_DESTINATION_RESTRICTION,
    ONE_PER_CUSTOMER_VIOLATIONS:OPTION_ONE_PER_CUSTOMER_VIOLATIONS,
    PAYMENT_METHOD_SHIPPING_METHOD_CONFLICT:OPTION_PAYMENT_METHOD_SHIPPING_METHOD_CONFLICT,
    PAYMENT_INFORMATION_VALIDATE:OPTION_PAYMENT_INFORMATION_VALIDATE,
    PAYMENT_METHOD_PROVIDED:OPTION_PAYMENT_METHOD_PROVIDED,
    QUANTITY_REQUIREMENTS_MET:OPTION_QUANTITY_REQUIREMENTS_MET,
    ITEMS_PRESENT:OPTION_ITEMS_PRESENT,
    OPTIONS_PROVIDED:OPTION_OPTIONS_PROVIDED,
    CVV2_NOT_REQUIRED:OPTION_CVV2_NOT_REQUIRED,
    ELECTRONIC_CHECK_CONFIRM_ACCOUNT_NUMBER:OPTION_ELECTRONIC_CHECK_CONFIRM_ACCOUNT_NUMBER,
    CUSTOMER_PROFILE_DOES_NOT_EXIST:OPTION_CUSTOMER_PROFILE_DOES_NOT_EXIST,
    VALID_SHIP_ON_DATE:OPTION_VALID_SHIP_ON_DATE,
    PRICING_TIER_LIMITS:OPTION_PRICING_TIER_LIMITS,
    SHIPPING_NEEDS_RECALCULATION:OPTION_SHIPPING_NEEDS_RECALCULATION,
    MERCHANT_SPECIFIC_ITEM_RELATIONSHIPS:OPTION_MERCHANT_SPECIFIC_ITEM_RELATIONSHIPS,
    ALL:OPTION_ALL
  };

  // Types of payment method
  var PAYMENT_METHOD_CREDIT_CARD = "Credit Card";
  var PAYMENT_METHOD_PURCHASE_ORDER = "Purchase Order";
  var PAYMENT_METHOD_PAYPAL = "PayPal";

  var payments = {
    CREDIT_CARD:PAYMENT_METHOD_CREDIT_CARD,
    PURCHASE_ORDER:PAYMENT_METHOD_PURCHASE_ORDER,
    PAYPAL:PAYMENT_METHOD_PAYPAL
  };

  // Types of credit cards
  var CREDIT_CARD_TYPE_AMEX = "AMEX";
  var CREDIT_CARD_TYPE_DISCOVER = "Discover";
  var CREDIT_CARD_TYPE_MASTERCARD = "MasterCard";
  var CREDIT_CARD_TYPE_JCB = "JCB";
  var CREDIT_CARD_TYPE_DINERS_CLUB = "Diners Club";
  var CREDIT_CARD_TYPE_VISA = "Visa";

  var creditCards = {
    AMEX:CREDIT_CARD_TYPE_AMEX,
    DISCOVER:CREDIT_CARD_TYPE_DISCOVER,
    MASTERCARD:CREDIT_CARD_TYPE_MASTERCARD,
    JCB:CREDIT_CARD_TYPE_JCB,
    DINERS_CLUB:CREDIT_CARD_TYPE_DINERS_CLUB,
    VISA:CREDIT_CARD_TYPE_VISA
  };

  // Types of options
  var OPTION_TYPE_SINGLE = "single";
  var OPTION_TYPE_MULTILINE = "multiline";
  var OPTION_TYPE_DROPDOWN = "dropdown";
  var OPTION_TYPE_HIDDEN = "hidden";
  var OPTION_TYPE_RADIO = "radio";
  var OPTION_TYPE_FIXED = "fixed";

  // Item multimedia types
  var ITEM_MULTIMEDIA_TYPE_IMAGE = "Image";
  var ITEM_MULTIMEDIA_TYPE_VIDEO = "Video";
  var ITEM_MULTIMEDIA_TYPE_UNKNOWN = "Unknown";
  var ITEM_MULTIMEDIA_TYPE_PDF = "PDF";
  var ITEM_MULTIMEDIA_TYPE_TEXT = "Text";

  var multimedia = {
    IMAGE:ITEM_MULTIMEDIA_TYPE_IMAGE,
    VIDEO:ITEM_MULTIMEDIA_TYPE_VIDEO,
    UNKNOWN:ITEM_MULTIMEDIA_TYPE_UNKNOWN,
    PDF:ITEM_MULTIMEDIA_TYPE_PDF,
    TEXT:ITEM_MULTIMEDIA_TYPE_TEXT
  };

  // Distance units of measure
  var DISTANCE_UOM_IN = "IN";
  var DISTANCE_UOM_CM = "CM";

  // Weight units of measure
  var WEIGHT_UOM_LB = "LB";
  var WEIGHT_UOM_KG = "KG";

  var UOM = {
    DISTANCE_UOM_IN:DISTANCE_UOM_IN,
    DISTANCE_UOM_CM:DISTANCE_UOM_CM,
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
    ICONTACT:AUTO_RESPONDER_NAME_ICONTACT,
    SILVERPOP:AUTO_RESPONDER_NAME_SILVERPOP,
    MAILCHIMP:AUTO_RESPONDER_NAME_MAILCHIMP,
    LYRIS:AUTO_RESPONDER_NAME_LYRIS,
    CAMPAIGNMONITOR:AUTO_RESPONDER_NAME_CAMPAIGNMONITOR,
    GETRESPONSE:AUTO_RESPONDER_NAME_GETRESPONSE,
    MADMIMI:AUTO_RESPONDER_NAME_MADMIMI
  };


  var util = {
    getParameterValue:getParameterValue,
    getParameterValues:getParameterValues,
    getParameterMap:getParameterMap,
    javaUrlDecode:javaUrlDecode,
    postGet:postGet
  };


  var CHECKOUT_ULTRACART = 'checkoutultracart';
  var CHECKOUT_GOOGLE = 'checkoutgoogle';
  var CHECKOUT_PAYPAL = 'checkoutpaypal';

  var checkouts = {
    CHECKOUT_ULTRACART:CHECKOUT_ULTRACART,
    CHECKOUT_GOOGLE:CHECKOUT_GOOGLE,
    CHECKOUT_PAYPAL:CHECKOUT_PAYPAL
  }


  // ==================================================================================
  // NumberFormat
  // mredkj.com
  // version 2.0: refactored.  interface changes: currencyValue is now currencySymbol
  // ==================================================================================


  var numberFormat = (function() {

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

      if(opts.hasSeparators) hasSeparators = opts.hasSeparators;
      if(opts.separatorValue) separatorValue = opts.separatorValue;
      if(opts.decimalSymbol) decimalSymbol = opts.decimalSymbol;
      if(opts.negativeFormat) negativeFormat = opts.negativeFormat;
      if(opts.negativeRed) negativeRed = opts.negativeRed;
      if(opts.hasCurrency) hasCurrency = opts.hasCurrency;
      if(opts.currencyPosition) currencyPosition = opts.currencyPosition;
      if(opts.currencySymbol) currencySymbol = opts.currencySymbol;
      if(opts.places) places = opts.places;
      if(opts.roundToPlaces) roundToPlaces = opts.roundToPlaces;
      if(opts.truncate) truncate = opts.truncate;

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
                  if (negativeFormat == LEFT_DASH || negativeFormat == PARENTHESIS) n1 = negSignL;
                  if (negativeFormat == RIGHT_DASH || negativeFormat == PARENTHESIS) n2 = negSignR;
              }
              if (hasCurrency) c0 = currencySymbol;
          } else if (currencyPosition == LEFT_INSIDE) {
              if (nNum < 0) {
                  if (negativeFormat == LEFT_DASH || negativeFormat == PARENTHESIS) n0 = negSignL;
                  if (negativeFormat == RIGHT_DASH || negativeFormat == PARENTHESIS) n3 = negSignR;
              }
              if (hasCurrency) c1 = currencySymbol;
          } else if (currencyPosition == RIGHT_INSIDE) {
              if (nNum < 0) {
                  if (negativeFormat == LEFT_DASH || negativeFormat == PARENTHESIS) n0 = negSignL;
                  if (negativeFormat == RIGHT_DASH || negativeFormat == PARENTHESIS) n3 = negSignR;
              }
              if (hasCurrency) c2 = currencySymbol;
          } else if (currencyPosition == RIGHT_OUTSIDE) {
              if (nNum < 0) {
                  if (negativeFormat == LEFT_DASH || negativeFormat == PARENTHESIS) n1 = negSignL;
                  if (negativeFormat == RIGHT_DASH || negativeFormat == PARENTHESIS) n2 = negSignR;
              }
              if (hasCurrency) c3 = currencySymbol;
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
          if (isNaN(origVal)) return origVal;
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
                  if (plusLoc == -1) plusLoc = eLoc;
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
          if (spaces <= 0) return val;
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
          if (places <= 0) return val;
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
        toCurrency:toCurrency,
        toPercentage:toPercentage,
        init:init,
        COMMA:COMMA,
        PERIOD:PERIOD,
        DASH:DASH,
        LEFT_PAREN:LEFT_PAREN,
        RIGHT_PAREN:RIGHT_PAREN,
        LEFT_OUTSIDE:LEFT_OUTSIDE,
        LEFT_INSIDE:LEFT_INSIDE,
        RIGHT_INSIDE:RIGHT_INSIDE,
        RIGHT_OUTSIDE:RIGHT_OUTSIDE,
        LEFT_DASH:LEFT_DASH,
        RIGHT_DASH:RIGHT_DASH,
        PARENTHESIS:PARENTHESIS
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
  function EventTarget(){
      this._listeners = {};
  }

  EventTarget.prototype = {

      constructor: EventTarget,

      addListener: function(type, listener, internal){
          if (typeof this._listeners[type] === "undefined"){
              this._listeners[type] = [];
          }

          this._listeners[type].push(listener);

          if(debugMode && !internal){
            ucLogInfo("registered listener for event type " + type + " => " + listener );
          }
      },

      fire: function(event){
          if (typeof event == "string"){
              event = { type: event };
          }
          if (!event.target){
              event.target = this;
          }

          if (!event.type){  //falsy
              ucLogError("Event object missing 'type' property.");
          }

          ucLogInfo("FIRE: " + event.type);
          if (this._listeners[event.type] instanceof Array){
              var listeners = this._listeners[event.type];
              for (var i=0, len=listeners.length; i < len; i++){
                  listeners[i].call(this, event);
              }
          }
      },

      removeListener: function(type, listener){
          if (this._listeners[type] instanceof Array){
              var listeners = this._listeners[type];
              for (var i=0, len=listeners.length; i < len; i++){
                  if (listeners[i] === listener){
                      listeners.splice(i, 1);
                      break;
                  }
              }
          }
      },

      clear: function(){
        this._listeners = {};
      }
  };

  var cartTarget = new EventTarget();
  var EVENT_CART_CHANGE = 'cartchange';
  var EVENT_CART_READY = 'cartready';
  var EVENT_SHIPPING_CHANGE = 'shippingchange';
  var EVENT_ADDRESS_CHANGE = 'addresschange';
  var EVENT_SHIPPING_METHODS_CHANGE = 'shippingmethodschange';

  var events = {
    EVENT_CART_CHANGE:EVENT_CART_CHANGE,
    EVENT_CART_READY:EVENT_CART_READY,
    EVENT_SHIPPING_CHANGE:EVENT_SHIPPING_CHANGE,
    EVENT_ADDRESS_CHANGE:EVENT_ADDRESS_CHANGE,
    EVENT_SHIPPING_METHODS_CHANGE:EVENT_SHIPPING_METHODS_CHANGE
  };



  return{
    // === METHODS ==
    addItems:addItems,
    addListener:cartTarget.addListener,
    applyCoupon:applyCoupon,
    applyGiftCertificate:applyGiftCertificate,
    backgroundTimer:backgroundTimer,
    checkout:checkout,
    clearFinalizeAfter:clearFinalizeAfter,
    clearItems:clearItems,
    establishCustomerProfile:establishCustomerProfile,
    establishCustomerProfileImmediately:establishCustomerProfileImmediately,
    estimateShipping:estimateShipping,
    fire:cartTarget.fire,
    getAdvertisingSources:getAdvertisingSources,
    getAllowedCountries:getAllowedCountries,
    getCart:getCart,  // should be only property exposed
    getCartItemMultimediaThumbnail:getCartItemMultimediaThumbnail,
    getCheckoutTerms:getCheckoutTerms,
    getCustomerProfile:getCustomerProfile,
    getGiftSettings:getGiftSettings,
    getIpAddress:getIpAddress,
    getItem:getItem,
    getItems:getItems,
    getItemMultimediaThumbnail:getItemMultimediaThumbnail,
    getRelatedItems:getRelatedItems,
    getReturnPolicy:getReturnPolicy,
    getShippingChoice:getShippingChoice,
    getShippingMethods:getShippingMethods,
    getStateProvinces:getStateProvinces,
    getStateProvinceCodes:getStateProvinceCodes,
    getTaxCounties:getTaxCounties,
    init:init,
    loginCustomerProfile:loginCustomerProfile,
    logoutCustomerProfile:logoutCustomerProfile,
    refreshCart:updateCart,
    removeCoupon:removeCoupon,
    removeGiftCertificate:removeGiftCertificate,
    removeItem:removeItem,
    removeItems:removeItems,
    removeListener:cartTarget.removeListener,
    resetCustomerProfilePassword:resetCustomerProfilePassword,
    saveFieldElements:saveFieldElements,
    search:search,
    setFinalizeAfter:setFinalizeAfter,
    setShippingChoice:setShippingChoice,
    unabbreviateStateProvinceCode:unabbreviateStateProvinceCode,
    updateCustomerProfile:updateCustomerProfile,
    updateItems:updateItems,
    validate:validate,
    validateAll:validateAll,
    validateGiftCertificate:validateGiftCertificate,

    // === HELPERS ==
    util:util,

    // === CONSTANTS COLLECTIONS ==
    verify:verify,
    creditCards:creditCards,
    payments:payments,
    multimedia:multimedia,
    UOM:UOM,
    autoResponders:autoResponders,
    numberFormat:numberFormat,
    events:events,
    checkouts:checkouts
  }
}());
