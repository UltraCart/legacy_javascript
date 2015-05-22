//
// READ ME FIRST!
// To make this script work, you MUST set 3 variables
// Search for merchantId, checkoutSite, remoteApiUrl (they're properties of the merchantCartConfig object)
// Set these values appropriately.
//
// Please see:
// http://docs.ultracart.com/display/ucdoc/Getting+Started+with+the+Javascript+Checkout
// http://docs.ultracart.com/display/ucdoc/UltraCart+Advanced+JavaScript+Checkout+API
// http://docs.ultracart.com/display/ucdoc/Introduction++%28JS+API+v2%29
//


// ===========================================================================
// Merchant Configuration - Begin
// Here is where merchant specific code should reside.
// FOR A STANDARD IMPLEMENTATION, YOU WON'T NEED TO MODIFY ANYTHING BEYOND THIS BLOCK
// ===========================================================================

// these values affect the operation of code in this script.  They will impact what is displayed
// and the validation rules enforced during checkout.  Please ensure the 'required' flags match
// your cart configuration on the ultracart portal or customers will experience problems.
var businessRules = {
  emailRequired: true,               // if true, the customer must enter an email address
  requireEmailConfirm: false,         // if true, a confirmation email field is displayed and required entry
  requireBillingTitle: false,         // if true, the billing title field becomes a required field
  requireShippingTitle: false,        // if true, the shipping title field is displayed
  showBillingTitle: false,            // if true, the billing title field is displayed
  showContinueShopping: false,
  showCoupons: true,                 // if true, coupons and coupon entry are displayed
  showEmail: true,                   // if true, email field is displayed
  showEmailUpdates: true,            // if true, send me email updates checkbox is shown
  showGoogleCheckout: true,          // if true, google checkout is shown, note, it may still be disabled (unavailable ) due to cart conditions or items like autoorders or certain coupons
  // however, this setting means nothing if the cart flag says we're incompatible.  nothing to be done about that.  if that's so, no google checkout.
  showItems: true,                   // if true, item table is displayed
  showPayPalCheckout: true,          // if true, paypal checkout is shown
  showShipFrom: true,                // if true, the 'orders shipped from is shown'
  showShippingTitle: false,           // if true, the shipping title field is required.
  showUpdateQuantity: true,         // if true, quantities are shown in edit fields and 'update quantity' link is displayed.
  showRemoveItem: true,              // if true, trash can is displayed for each item allowing item to be removed from cart.
  showUltraCartCheckout: true        // if true, ultracart checkout is shown
};


// these are development options.  none should be enabled during production!
var devel = {
  itemQuickAdd: true, // if true, adds a small div to add items to a cart.
  bizRulesConfig: true // if true, shows the merchant cart configuration
};

// These values are passed to the UltraCart Checkout API
// They affect the remote calls and cart behaviour.  While there may be some business rule
// logic sprinkled in here, the dividing factor of whether a configuration option is included
// in the businessRules or merchantCartConfig is whether the rule affects code in this script or the checkout api.
var merchantCartConfig =
{
  merchantId: "DEMO",
  screenBrandingThemeCode: 'DFLT', // doesn't affect these pages, but will determine how receipt and upsell pages appear.
  isCheckoutPage: true, // if true, additional code is run during init() to populate shipping methods and such.  This must
  // be true if you are collecting address information, displaying shipping, or finalizing an order.
  checkoutSite: 'secure.ultracart.com', // this site is only used during checkout. You may omit this, and checkout will proceed to secure.ultracart.com
  // if you provide a value, it must be an SSL alias that points to secure.ultracart.com (Custom SSL Certificate)
  // if isCheckoutPage = false, this value doesn't matter.

  remoteApiUrl: 'http://v3.com/legacy_javascript/example/proxy.php', // this url is used for all remote calls. It may point to secure.ultracart.com, a custom SSL site, or your own proxy script.
  // you may omit this, and the default url is used (points to a path at secure.ultracart.com)
  // see the top of the checkoutapi script for the path info if you have a custom ssl cert.
  // btw, nothing special about port 3000, it's just my development port - Perry.  Get rid of :3000
  debugMode: true,
  verboseAjax: true,
  addressPriority: 'billing', // if you're showing shipping fields and hiding billing, set to 'shipping', if you're showing billing fields and have a "My shipping address is different button", set to 'billing'
  updateShippingOnAddressChange: true, // if this is true, shippingFields must be mapped below or no events will fire.
  shippingCountries: ['United States'],  // populates shipping country select.  if absent, remote call is made to get list configured in ultracart.  this is faster, but must be maintained.
  billingCountries: ['United States'],   // populates billing country select.  if absent, remote call is made to get list configured in ultracart.  this is faster, but must be maintained.
  unifiedAffiliateTracking: true, // set this to true if you're using a custom ssl certificate (NOT secure.ultracart.com) and you have affiliates.
  // when true, a script is dynamically insert into the head element. it in turn makes a call to the checkout site which does some cookie magic to unify affiliates
  numberFormatConfig: {
    hasCurrency: true,
    currentPosition: ultraCart.numberFormat.LEFT_INSIDE,
    currencySymbol: '$',
    negativeFormat: ultraCart.numberFormat.LEFT_DASH,
    roundToPlaces: 2,
    places: 2,
    truncate: false,
    hasSeparators: true,
    separatorValue: ultraCart.numberFormat.COMMA,
    decimalValue: ultraCart.numberFormat.PERIOD
  },
  listeners: {
    // at first glance, cartready and cartchange look the same, but the cartready fires when ultraCart.init() finishes.  This method is here
    // because init does so much, that numerous events would fire during it, causing renderers like summary to get called several times in a row.
    "cartready": [renderCartVisibility, renderCartItems, renderSubtotal, renderCoupons, renderSummary, renderShipping, renderGoogleCheckout, renderPayPalCheckout], // "cartready" == ultraCart.events.EVENT_CART_READY
    "cartchange": [renderCartVisibility, renderCartItems, renderSubtotal, renderCoupons, renderSummary, renderGoogleCheckout, renderPayPalCheckout], //  "cartchange" == ultraCart.events.EVENT_CART_CHANGE
    "shippingchange": [renderSummary], // "shippingchange" == ultraCart.events.EVENT_SHIPPING_CHANGE
    "addresschange": [],  //  "addresschange" == ultraCart.events.EVENT_ADDRESS_CHANGE
    "shippingmethodschange": [renderShipping] // "shippingmethodschange" == ultraCart.events.EVENT_SHIPPING_METHODS_CHANGE
  },
  cartFieldMapping: {
    shipToAddress1: "shippingAddress1",
    shipToAddress2: "shippingAddress2",
    shipToCity: "shippingCity",
    shipToCompany: "shippingCompany",
    shipToCountry: "shippingCountry",
    shipToEveningPhone: null, // not mapped. I could delete this line, but it's left here to be explicit.
    shipToFirstName: "shippingFirstName",
    shipToLastName: "shippingLastName",
    shipToPhone: "shippingPhone",
    shipToPostalCode: "shippingZip",
    //shipToResidential:"shippingResidential",
    shipToState: "shippingState",
    //shipToTitle:"shippingTitle",
    email: "email",
    billToAddress1: "billingAddress1",
    billToAddress2: "billingAddress2",
    billToCity: "billingCity",
    billToCompany: "billingCompany",
    billToCountry: "billingCountry",
    //billToDayPhone:"billingDayPhone",  // not mapped, I just commented these out.  could've also deleted these lines
    //billToEveningPhone:"billingEveningPhone",
    billToFirstName: "billingFirstName",
    billToLastName: "billingLastName",
    billToPostalCode: "billingZip",
    billToState: "billingState",
    //billToTitle:"billingTitle"

    creditCardExpirationMonth: "creditCardExpMonth",
    creditCardExpirationYear: "creditCardExpYear",
    creditCardNumber: "creditCardNumber",
    creditCardType: "creditCardType",
    creditCardVerificationNumber: "creditCardVerificationNumber",

    mailingListOptIn: "mailingList"

  }
};


/**
 * merchantOnReady is called after the cart is loaded and cart events have fired.  This is a place to perform gui customization.
 */
function merchantOnReady() {

  var c = ultraCart.getCart();
  if (c != null) {

    teardownSecureCreditCardFields();

    // decide whether to show billing information.  first, toggle based on the checkbox,
    // then look at the billing fields.  If any are populated, show them.
    showHide(document.getElementById('billingDifferent'), 'billingTable');
    if (c.billToAddress1 || c.billToAddress2 || c.billToCity || c.billToLastName || c.billToFirstName) {
      jQuery('#billingDifferent').attr('checked', true);
      jQuery('#billingTable').show();
    }
  }

  jQuery('#shipFrom').toggle(businessRules.showShipFrom);

  // each checkout field contains a span for adding a custom note.  here is a good place to add that note.
  jQuery('#emailNote').html('(for order confirmation ONLY)<br />We Value Your Privacy');

  // assign popups to any popup links on the page.
  jQuery('#cvv2popup').click(makePopup('https://secure.ultracart.com/checkout/cvv2/both.jsp', "scrollbars,resizable,toolbar,width=600,height=450,left=50,top=50"));


  if (businessRules.hasOwnProperty('showItems') && !businessRules.showItems) {
    jQuery('#cartItemsContainer').hide();
  } else {
    jQuery('#cartItemsContainer').show();
  }


  if (businessRules.showEmail) {
    var emailContainer = jQuery('#emailContainer');
    emailContainer.show();
    if (businessRules.emailRequired) {
      emailContainer.prepend('<span class="required">*</span>');
    }

    if (businessRules.requireEmailConfirm) {

      // check for cookie with value since email confirm is not part of cart data.
      var emailConfirm = readCookie('checkout_emailConfirm');
      if (emailConfirm) {
        jQuery('#emailConfirm').val(emailConfirm);
      }
      jQuery('#emailConfirmContainer').show();
    } else {
      jQuery('#emailConfirmContainer').hide();
    }

  }

  var shippingTitle = jQuery('#shippingTitleContainer');
  if (businessRules.showShippingTitle) {
    shippingTitle.show();
    if (businessRules.requireShippingTitle) {
      shippingTitle.prepend('<span class="required">*</span>');
    }
  } else {
    shippingTitle.hide();
  }

  var billingTitle = jQuery('#billingTitleContainer');
  if (businessRules.showBillingTitle) {
    billingTitle.show();
    if (businessRules.requireBillingTitle) {
      billingTitle.prepend('<span class="required">*</span>');
    }
  } else {
    billingTitle.hide();
  }

  if (businessRules.hasOwnProperty('showUpdateQuantity') && !businessRules.showUpdateQuantity) {
    jQuery('#updateQuantityContainer').hide();
  } else {
    jQuery('#updateQuantityContainer').show();
  }

  if (businessRules.showRemoveItem) {
    jQuery('#removeItemHeader').show();
  } else {
    jQuery('#removeItemHeader').hide();
  }

  if (businessRules.showContinueShopping) {
    jQuery('#continueShoppingContainer').show();
  } else {
    jQuery('#continueShoppingContainer').hide();
  }

  if (businessRules.showCoupons) {
    jQuery('#couponContainer').show();
  } else {
    jQuery('#couponContainer').hide();
  }


  if (businessRules.showUltraCartCheckout) {
    jQuery('#ucUltraCartCheckoutSection').show();
  } else {
    jQuery('#ucUltraCartCheckoutSection').hide();
  }

  renderCartVisibility();
  setupSecureCreditCardFields();

  // the only way I'm going to get shipping updates with billing priority
  if (merchantCartConfig.addressPriority == 'billing') {

  }

  if (devel.itemQuickAdd) {
    renderItemQuickAdd();
  }

  if (devel.bizRulesConfig) {
    renderBizRulesConfig();
  }

}




// === START PCI 3.0 CODE
var hostedFields = null;

// setup should be called each time the UI updates.
function setupSecureCreditCardFields() {
// set this to true to see verbose debugging.  usually only UltraCart support will use this.
  window.ultraCartHostedFieldsDebugMode = false;
  hostedFields = UltraCartHostedFields.setup(jQuery, JSON3, {
    'sessionCredentials': {
      'merchantId': merchantCartConfig.merchantId, 'shoppingCartId': ultraCart.getCart()
    },
//          'cssUrls':[
//              'https://www.mysite.com/styles.css'
//          ],
    'hostedFields': {
      'creditCardNumber': {
        'selector': '#creditCardNumber'
        /* ,'tokenSelector': '#cardNumberToken' */
      },
      'creditCardCvv2': {
        'selector': '#creditCardVerificationNumber'
        /* ,'tokenSelector': '#cvv2Token' */
      }
    }
  });
}


// teardown should be called each time a UI needs destroying.
function teardownSecureCreditCardFields() {
  if (hostedFields != null) {
    hostedFields.destroy();
    hostedFields = null;
  }
}
// === END PCI 3.0 CODE

/**
 * behavior to take when email is required.
 */
function alertEmailRequired() {
  jQuery('#emailContainer').addClass('field_container_error');
  jQuery('#email').focus();
  alert('Your email is required.  Please provide it in this field.');
}


function alertEmailConfirmRequired() {
  jQuery('#emailConfirmContainer').addClass('field_container_error');
  jQuery('#emailConfirm').focus();
  alert('Please confirm your email by retyping it in the field provided.');
}


function alertEmailConfirmMismatch() {
  jQuery('#emailConfirmContainer').addClass('field_container_error');
  jQuery('#emailConfirm').focus();
  alert('Your email and email confirmation do not match.  Please retype your email address.');
}


// ===========================================================================
// Merchant Configuration - End
// ===========================================================================


// ===========================================================================
// Render Functions
// Merchant: If you can your page layout, these will need
// to change accordingly.
// ===========================================================================


/**
 * toggles the overall visibility of the cart.  if there are no more items,
 * we should display a 'cart is empty, continue shopping message of some kind.
 */
function renderCartVisibility() {
  var c = uc.getCart();
  if (c != null && c.items && c.items.length > 0) {
    jQuery('#emptyCart').hide();
    jQuery('#shoppingCart').show();
  } else {
    renderEmptyCart();
    jQuery('#emptyCart').show(); // should already be visible
    jQuery('#shoppingCart').hide(); // should already be hidden
  }
}


/**
 * this is what's displayed when the cart is empty.  you could have a beautiful div and toggle visibility
 * instead, if you want.  totally customizable.
 */
function renderEmptyCart() {
  jQuery('#emptyCart').html('<h4>Your cart is currently empty.  Please click here to continue shopping.</h4>');
}


/**
 * updates the main item table
 */
function renderCartItems() {
  var cartItems = uc.getCart().items;
  var editQty = true;
  var removeItem = false;
  if (businessRules.hasOwnProperty('showUpdateQuantity') && !businessRules.showUpdateQuantity) {
    editQty = false;
  }
  if (businessRules.showRemoveItem) {
    removeItem = true;
  }

  jQuery('#cartItemsBody').html(''); //clear out cart
  for (var i = 0; i < cartItems.length; i++) {
    renderCartItem(cartItems[i], i, editQty, removeItem);
  }
}


/**
 * adds a cart item to the table
 * @param cartItem item to add
 * @param position is needed for some of the event methods.
 */
function renderCartItem(cartItem, position, editQty, removeItem) {
  var parent = jQuery('#cartItemsBody');

  var amt = cartItem.quantity * cartItem.unitCostWithDiscount;

  var html = "<tr><td class='item_thumbnail'>" + getCartItemImg(cartItem)
          + "<\/td><td class='item_id'>"
          + cartItem.itemId
          + "<\/td><td class='item_qty'>";

  if (editQty) {
    html += "<input type='text' name='cartItemQty' size='3' maxlength='5' value='" + +cartItem.quantity
            + "'/>";
  } else {
    html += cartItem.quantity;
  }

  html += "<\/td><td class='item_desc'>"
          + cartItem.description
          + "<\/td><td class='item_amt'>"
          + nf.toCurrency(amt)
          + "<\/td><td class='item_remove'>";

  if (removeItem) {
    html += "<span onclick='removeItem("
            + position
            + ")' class='remove_link' title='remove item'><img src='images/trash.png' alt='remove item'/></span>";
  } else {
    html += '&nbsp;';
  }

  html += "<\/td><\/tr>";

  parent.append(html);

}


/**
 * renders the coupons that are applied to the current transaction
 */
function renderCoupons() {
  var coupons = uc.getCart().coupons;

  var html = '';
  if (coupons.length > 0) {
    html += "<div class='couponHeader'>Applied Coupons:</div>";
    for (var i = 0; i < coupons.length; i++) {
      var coupon = coupons[i];
      html += "<div><span style='float:left;vertical-align:middle'>" + coupon.couponCode + "</span><span class='coupon_link' onclick='removeCoupon(\"" + coupon.couponCode + "\")'><img src='images/delete_coupon.png' alt='remove coupon' style='float:left;vertical-align:middle' /><\/span><\/div>";
    }
  }

  var couponsApplied = jQuery('#couponsApplied');
  couponsApplied.html(html);
}


function renderShipping() {
  var c = uc.getCart();
  var choice = uc.getShippingChoice();
  var methods = uc.getShippingMethods();

  // if no default, select the first one.  should be the cheapest.
  if (!choice && methods && methods.length) {
    choice = methods[0].name;
  }

  // unbind any existing options before overwriting to avoid leaks.
  jQuery('[name=shippingMethod]').unbind('.ultraCart');

  if (methods) {
    var html = '';
    for (var i = 0; i < methods.length; i++) {
      var checked = (choice && choice.name && methods[i].name && choice.name == methods[i].name);

      html += "<div class='shippingMethod'>";
      html += "<div class='shippingName'>";
      html += "<input class='shippingField' name='shippingMethod' type='radio' value='" + methods[i].name + "' " + (checked ? "checked='checked'" : "") + " />";
      html += methods[i].displayName;
      html += "<\/div><div class='shippingPrice'>";
      html += nf.toCurrency(methods[i].cost);
      html += "<\/div>";
    }
  }

  jQuery('#shippingMethods').html(html);
  jQuery('[name=shippingMethod]').bind('click.ultraCart', chooseShipping);

}


/**
 * updates the summary block showing subtotal, tax, shipping, and total
 */
function renderSummary() {
  var c = uc.getCart();
  if (c.items.length == 0) {
    jQuery('#summaryContainer').hide();
    return;
  } else {
    jQuery('#summaryContainer').show();
  }

  // shipping must be dealt with specially.  to prevent customers from gaming the system, there are several instances
  // where the price of shipping is reset.  So, when rendering, always lookup the shipping method and calculate the cost
  // from that rather than using the cart.shippingHandlingWithDiscount, although the latter would be simpler

  var totalTax = c.tax;
  var shippingTotal = '&nbsp;'; // don't display anything if there's no choice
  var total = c.subtotalWithDiscount + c.tax;

  var shippingChoice = uc.getShippingChoice();
  if (shippingChoice) {
    totalTax += shippingChoice.tax;
    if (shippingChoice.cost == 0) {
      shippingTotal = '<strong>FREE Shipping!</strong>';
    } else {
      shippingTotal = nf.toCurrency(shippingChoice.cost);
    }
    total += shippingChoice.cost;
    total += shippingChoice.tax;
  }


  jQuery('#summarySubtotal').html("<div class='summaryLabel'>Subtotal:<\/div><div class='summaryField'>" + nf.toCurrency(c.subtotalWithDiscount) + "<\/div>");
  jQuery('#summaryTax').html("<div class='summaryLabel'>Tax:<\/div><div class='summaryField'>" + (totalTax == 0 ? "<span class='tax'>No Sales Tax!</span>" : nf.toCurrency(totalTax)) + "<\/div>");
  jQuery('#summaryShipping').html("<div class='summaryLabel'>Shipping:<\/div><div class='summaryField'>" + shippingTotal + "<\/div>");
  jQuery('#summaryTotal').html("<div class='summaryLabel'>Total:<\/div><div class='summaryField'>" + nf.toCurrency(total) + "<\/div>");
}


/**
 * Updates the subtotal at the end of the main item table that shows the subtotal details (including discounts)
 */
function renderSubtotal() {
  var c = uc.getCart();
  if (c.subtotalDiscount == 0) {
    jQuery('#subtotal1').hide();
    jQuery('#subtotal_label1').hide();
    jQuery('#discount1').hide();
    jQuery('#discount_label1').hide();
  } else {
    jQuery('#subtotal1').show().html(nf.toCurrency(c.subtotal));
    jQuery('#subtotal_label1').show();
    jQuery('#discount1').show().html(nf.toCurrency(c.subtotalDiscount));
    jQuery('#discount_label1').show();
  }
  jQuery('#subtotal2').html(nf.toCurrency(c.subtotalWithDiscount));
}


function renderGoogleCheckout() {

  // unbind here and rebind to avoid stacking event handlers
  jQuery('.google_link').unbind('.ultraCart').removeClass('fake_hyper');

  var cart = uc.getCart();


  // biz rules can override the cart settings to hide google checkout,
  // but it cannot show if the cart says no.  end of story.
  if (businessRules.showGoogleCheckout && cart && cart.hasGoogleCheckout) {
    jQuery('#ucGoogleCheckoutSection').show();

    if (businessRules.showPayPalCheckout && cart.hasPayPal && cart.payPalCompatible) {
      jQuery('#ucGoogleConjunction1').show();
      jQuery('#ucGoogleConjunction2').hide();
    } else if (businessRules.showUltraCartCheckout) {
      jQuery('#ucGoogleConjunction2').show();
    }
  } else {
    jQuery('#ucGoogleCheckoutSection').hide();
    jQuery('#ucGoogleConjunction1').hide();
    jQuery('#ucGoogleConjunction2').hide();
  }


  if (cart && businessRules.showGoogleCheckout) {

    // show the image no matter what.  it will show disabled if need be.
    // but only put in the click event if the cart is compatible.

    var googleImage = jQuery('#googleImage');
    if (cart.googleCheckoutButtonUrl && (googleImage.attr('src') != cart.googleCheckoutButtonUrl)) {
      googleImage.attr('src', cart.googleCheckoutButtonUrl);
      googleImage.attr('alt', cart.googleCheckoutButtonAltText);
    }

    if (cart.googleCheckoutCompatible) {
      jQuery('.google_link').bind('click.ultraCart', googleCheckout).addClass('fake_hyper');
    }
  }
}


function renderPayPalCheckout() {

  // unbind here and rebind to avoid stacking event handlers
  jQuery('.paypal_link').unbind('.ultraCart').removeClass('fake_hyper');

  var cart = uc.getCart();

  // biz rules can override the cart settings to hide paypal checkout,
  // but it cannot show if the cart says no.  end of story.
  if (businessRules.showPayPalCheckout && cart && cart.hasPayPal) {
    jQuery('#ucPayPalCheckoutSection').show();
    if (businessRules.showUltraCartCheckout) {
      jQuery('#ucPayPalConjunction').show();
    }
  } else {
    jQuery('#ucPayPalCheckoutSection').hide();
    jQuery('#ucPayPalConjunction').hide();
  }

  if (cart && businessRules.showPayPalCheckout) {

    // show the image no matter what.  it will show disabled if need be.
    // but only put in the click event if the cart is compatible.

    var paypalImage = jQuery('#paypalImage');
    if (cart.payPalButtonUrl && (paypalImage.attr('src') != cart.payPalButtonUrl)) {
      paypalImage.attr('src', cart.payPalButtonUrl);
      paypalImage.attr('alt', cart.payPalButtonAltText);
    }

    if (cart.payPalCompatible) {
      jQuery('.paypal_link').bind('click.ultraCart', payPalCheckout).addClass('fake_hyper');
    }
  }
}


/**
 * hides the error messages when the user acknowledges them.  This isn't really a render function, but
 * it's tied to the renderErrors function so it's included here to ensure it's not missed.
 */
function hideError() {
  jQuery('#error_container').hide();
}

/**
 * This function wraps many remote calls to display any errors returned from the server.
 * @param errors - string array of error messages
 */
function renderErrors(errors) {
  if (typeof errors == 'undefined' || errors == null) return false;
  if (!errors.length) return false;
  if (errors.length == 0) return false;

  var html = '<ul>';
  for (var i = 0; i < errors.length; i++) {
    html += '<li>' + errors[i] + '</li>';
  }
  html += '</ul>';

  jQuery('#error_messages').html(html);
  jQuery('#error_container').show();
  document.getElementById('error_container').scrollIntoView();

  return true;
}

// ===========================================================================
// Render Functions - End
// ===========================================================================


// ===========================================================================
// Startup Code.
// Here is the code which initializes the cart, and the few global cart objects
// ===========================================================================

var uc = ultraCart;  // less typing with uc alias
var nf = ultraCart.numberFormat; // for formatting currency
var finalizing = false; // state variable to prevent double submissions

jQuery('document').ready(function () {

  jQuery(document).ajaxStart(function () {
    jQuery('.ajaxLoad').show();
  }).ajaxStop(function () {
            jQuery('.ajaxLoad').hide();
          });

  jQuery('#finalizeLink').click(function () {
    finalizeOrder();
  });

  uc.init(merchantCartConfig);

  var cart = uc.getCart();
  if (cart != null) {
    if (businessRules.showPayPalCheckout && cart.hasPayPal && cart.payPalButtonUrl) {
      var paypalImage = jQuery('#paypalImage');
      paypalImage.attr('src', cart.payPalButtonUrl)
      paypalImage.attr('alt', cart.payPalButtonAltText);
    }
  }

  merchantOnReady();
  handleCheckoutErrors(); // if there were any.

});

// ===========================================================================
// Startup Code - End
// ===========================================================================


// ===========================================================================
// Business/Cart Logic.
// Here is the code provides and manages the customer/page events
// ===========================================================================


/**
 * checks for any errors returned from the finalize method and displays them
 */
function handleCheckoutErrors() {
  renderErrors(uc.util.getParameterValues('ucError'));
}


/**
 * updates the cart and handsoff to the checkout.
 */
function finalizeOrder(checkoutMethod) {
  if (!finalizing) {

    // set to prevent multiple submissions
    finalizing = true;

    // reset any errors
    jQuery('.field_container_error').removeClass('field_container_error');

    if (businessRules.emailRequired) {

      // keep it simple.  server side does the exhaustive email check.
      var email = jQuery('#email').val();
      if (!email || email.indexOf('@') < 0) {
        alertEmailRequired();
        finalizing = false;
        return;
      }

      if (businessRules.requireEmailConfirm) {
        var emailConfirm = jQuery('#emailConfirm').val();
        if (!emailConfirm) {
          alertEmailConfirmRequired();
          finalizing = false;
          return;
        } else if (email != emailConfirm) {
          alertEmailConfirmMismatch();
          finalizing = false;
          return;
        }


        // email confirmation is not stored by the cart.  save it to cookie for page reloads or customer will have to re-enter
        createCookie('checkout_emailConfirm', emailConfirm, 1);
      }
    }

    document.getElementById('pleaseWait').scrollIntoView();


    if (!checkoutMethod || checkoutMethod == uc.checkouts.CHECKOUT_ULTRACART) {
      uc.getCart().paymentMethod = 'Credit Card';
    }

    uc.saveFieldElements(function () {
      uc.checkout(checkoutMethod || uc.checkouts.CHECKOUT_ULTRACART, {async: true, onComplete: function (result) {
        if (result.redirectToUrl) {
          uc.util.postGet(result.redirectToUrl); // post instead of redirect to discourage back button use.
        } else if (result.errors) {
          finalizing = false;
          renderErrors(result.errors);
        } else {
          finalizing = false;
          // ?? this should never happen.
        }
      }})
    });
  }
}

function googleCheckout() {
  return finalizeOrder(ultraCart.checkouts.CHECKOUT_GOOGLE);
}

function payPalCheckout() {
  return finalizeOrder(ultraCart.checkouts.CHECKOUT_PAYPAL);
}


/**
 * adding items isn't typically done on a checkout, but this is here for handling
 * any related items offering and perhaps a future 'undo' tied to the removeItem
 * @param item itemId to add
 * @param qty item quantity
 */
function addItem(item, qty) {
  renderErrors(uc.addItems([
    {itemId: item, quantity: qty}
  ]));
}


/**
 * provided in case you wish to offer a 'cancel my order' link
 */
function clearCart() {
  renderErrors(uc.clearItems());
}


/**
 * removes an item from the cart
 * @param position the position in the list of items
 */
function removeItem(position) {
  var cartItems = uc.getCart().items;
  var item = cartItems[position];
  renderErrors(uc.removeItem(item.itemId));
}


/**
 * updates the cart for any items that have changed quantities
 */
function updateQty() {
  var qtyFields = jQuery('[name=cartItemQty]');


  var quantities = [];
  var validationError = false;
  qtyFields.each(function (index, el) {
    if (!isUnsignedInteger(el.value)) {
      validationError = true;
    } else {
      quantities.push(parseInt(el.value));
    }
  });
  if (validationError) {
    alert("One or more fields contain an invalid number.  Please correct before continuing.");
    return;
  }

  var updatedItems = [];
  var cartItems = uc.getCart().items;
  for (var i = 0; i < cartItems.length; i++) {
    if (cartItems[i].quantity != quantities[i]) {
      updatedItems.push({itemId: cartItems[i].itemId, quantity: quantities[i]});
    }
  }

  renderErrors(uc.updateItems(updatedItems));
}


/**
 * retrieves the thumbnail associated with the item and returns back <img> html code for it.
 * Note that there's a lot of different images associated with
 * a cart item, and this is function is most likely going to be an issue.
 * @param cartItem The cart item for which to return the image tag.
 */
function getCartItemImg(cartItem) {
  if (!cartItem.multimedias) return "";

  var media = cartItem.multimedias;
  if (media.length > 0) {
    for (var i in media) {
      if (media[i].type == uc.multimedia.IMAGE && media[i].isDefault) {
        if (media[i].thumbnails && media[i].thumbnails.length > 0) {
          var thumbnail = media[i].thumbnails[0];

          var url = '';
          if (thumbnail.httpsUrl && thumbnail.httpUrl) {
            url = ((window.location.protocol == "https:") ? (thumbnail.httpsUrl || thumbnail.httpUrl) : thumbnail.httpUrl);
          } else if (thumbnail.httpUrl) {
            url = thumbnail.httpUrl;
          }

          return "<img alt='' width='"
                  + thumbnail.width
                  + "px' height='"
                  + thumbnail.height
                  + "px' src='"
                  + url
                  + "' />";
        }
      }
    }
  }

  return "&nbsp;";
}


/**
 * applies a coupon to the cart.
 */
function applyCoupon() {
  var couponCode = jQuery('#couponCode').val();
  if (couponCode && couponCode.trim().length > 0) {
    renderErrors(uc.applyCoupon(couponCode));
  }
  jQuery('#couponCode').val('')
}


/**
 * removes a coupon from the cart.
 * @param coupon - the coupon code
 */
function removeCoupon(coupon) {
  renderErrors(uc.removeCoupon(coupon));
}

function chooseShipping() {
  uc.setShippingChoice(jQuery('[name=shippingMethod]:checked').val());
}


// ===========================================================================
// Utility Functions
// ===========================================================================
function makePopup(url, opts) {
  function popup() {
    var popup = window.open(url, "popup", opts);
    popup.focus();
    return false;
  }

  return popup;
}

function isUnsignedInteger(s) {
  return (s.toString().search(/^[0-9]+$/) == 0);
}

function showHide(checkbox, divId) {
  jQuery('#' + divId).toggle(checkbox.checked);
}


function createCookie(name, value, days) {
  var expires = "";
  if (days) {
    var date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toGMTString();
  }
  document.cookie = name + "=" + value + expires + "; path=/";
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

function addToCart(item, qty, clearCart) {

  if (clearCart) {

    // this is done using one call, and has more javascript, but only one remote call.
    var updatedItems = [];
    // add the actual item desired
    updatedItems.push({itemId: item, quantity: qty});

    // if there are any other items, set their quantity to zero
    var cartItems = ultraCart.getCart().items;
    for (var i in cartItems) {
      var existingItem = cartItems[i];
      updatedItems.push({itemId: existingItem.itemId, quantity: 0});
    }

    renderErrors(ultraCart.updateItems(updatedItems));
  } else {

    // this is formatted to illustrate what's being done.
    // I'm passing an array of cartItems to addItems().
    // the only required fields are itemId and quantity, so I create a
    // simple object with those properties, wrap it in an array, and pass it along.
    renderErrors(ultraCart.addItems(
            [
              {
                itemId: item,
                quantity: qty
              }
            ]
    ));
  }

}


// ===========================================================================
// Development Functions.
// Here is code which adds developmental widgets to the screen for testing.
// ===========================================================================

function renderControlBar() {
  if (jQuery('#ucdevel_controlbar').length > 0) {
    return;
  }

  var body = jQuery('body');
  var html = '';
  html += '<div id="ucdevel_controlbar" style="background-color:#fff6bf;border-top: 1px solid #ffd324;border-bottom: 1px solid #ffd324;font-family:Verdana,serif;font-size:0.75em;margin-top:10px;margin-bottom:10px;padding:5px"><div style="float:left">| UltraCart Development Panel v1.0 MERCHANT:' + merchantCartConfig.merchantId + ' (see top of checkout.js!)</div><div style="clear:both;"></div></div>';
  body.prepend(html);
}


function renderItemQuickAdd() {
  if (jQuery('#ucdevel_quickadd').length > 0) {
    return;
  }
  renderControlBar();

  var body = jQuery('body');


  var html = '';
  html += '<div id="ucdevel_quickadd" style="background-color:#fff6bf;border: 1px solid #ffd324;font-family:Verdana,serif;font-size:0.75em;position:absolute;top:40px;left:0;margin:10px;padding:5px;width:500px;display:none;">';
  html += '<div style="font-weight:bold;padding-bottom:5px;">Development Widget: Quick Add (<span style="font-color:red">REMOVE FOR PRODUCTION</span>)</div>';
  html += '<table style="font-size:1.0em">';
  html += '<tr><td>Item ID:</td><td><input type="text" size="20" id="ucdevel_quickadd_item" /></td></tr>';
  html += '<tr><td>Quantity:</td><td><input type="text" size="20" id="ucdevel_quickadd_qty" /></td></tr>';
  html += '<tr><td>&nbsp;</td><td><input type="checkbox" id="ucdevel_quickadd_clear" /> Clear Cart First</td></tr>';
  html += '<tr><td><input type="button" value="Add" id="ucdevel_quickadd_btn" style="font-size:1.0em" /></td><td>&nbsp;</td></tr></table>';
  html += '<span style="font-weight:bold;cursor:pointer;color:blue;float:right;margin-bottom:5px;margin-right:5px;" onclick="toggleItemQuickAdd()">Hide</span></div>';

  body.prepend(html);

  jQuery('#ucdevel_controlbar').prepend('<div style="float:left;padding-left:5px;padding-right:5px;cursor:pointer;color:blue;" onclick="toggleItemQuickAdd()">| Quick Add</div>');


  jQuery('#ucdevel_quickadd_btn').click(function () {
    toggleItemQuickAdd();
    var item = jQuery('#ucdevel_quickadd_item').val();
    var qty = jQuery('#ucdevel_quickadd_qty').val();
    var clearCart = jQuery('#ucdevel_quickadd_clear').attr('checked');
    addToCart(item, qty, clearCart);

  });
}

function toggleItemQuickAdd() {
  jQuery('#ucdevel_quickadd').toggle();
}


function renderBizRulesConfig() {
  if (jQuery('#ucdevel_config').length > 0) {
    return;
  }
  renderControlBar();

  var body = jQuery('body');


  var html = '';
  html += '<div id="ucdevel_config" style="background-color:#fff6bf;border: 1px solid #ffd324;font-family:Verdana,serif;font-size:0.75em;position:absolute;top:40px;left:0;margin:10px;padding:5px;width:500px;display:none;">';
  html += '<div style="font-weight:bold;padding-bottom:5px;">Development Widget: Biz Rules Config (<span style="font-color:red">REMOVE FOR PRODUCTION</span>)</div>';
  html += '<table style="font-size:1.0em">';

  for (var p in businessRules) {
    if (businessRules.hasOwnProperty(p)) {
      html += '<tr><td><input type="checkbox"' + (businessRules[p] ? 'checked="checked"' : '') + ' onclick="toggleBizRule(this, \'' + p + '\')" /></td><td> ' + p + '</td></tr>';
    }
  }

  html += '<tr><td><input type="button" value="Reinitialize Cart" id="ucdevel_config_btn" style="font-size:1.0em" /></td><td>&nbsp;</td></tr></table>';
  html += '<span style="font-weight:bold;cursor:pointer;color:blue;float:right;margin-bottom:5px;margin-right:5px;" onclick="toggleBizRulesConfig()">Hide</span></div>';

  body.prepend(html);

  jQuery('#ucdevel_controlbar').prepend('<div style="float:left;padding-left:5px;padding-right:5px;cursor:pointer;color:blue;" onclick="toggleBizRulesConfig()">| Merchant Properties</div>');


  jQuery('#ucdevel_config_btn').click(function () {
    jQuery('#ucdevel_config').toggle();
    reinitializeCart();
  });
}

function toggleBizRule(checkbox, prop) {
  businessRules[prop] = checkbox.checked;
}

function toggleBizRulesConfig() {
  jQuery('#ucdevel_config').toggle();
}


/**
 * calls init again, effectively reinitializes the cart
 */
function reinitializeCart() {
  uc.init(merchantCartConfig);
  var cartListeners = merchantCartConfig.listeners['cartchange'];
  for (var i = 0; i < cartListeners.length; i++) {
    cartListeners[i].call();
  }
  merchantOnReady();
}
