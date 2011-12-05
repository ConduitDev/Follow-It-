// Copyright (c) 2010 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// First check to see if this document is a feed. If so, it will redirect.
// Otherwise, check if it has embedded feed links, such as:
// (<link rel="alternate" type="application/rss+xml" etc). If so, show the
// page action icon.

function runFinder() {
	//alert('runFinder');
	debugMsg(logLevels.info, "Running feed finder script");

	if (!isFeedDocument()) {
	  debugMsg(logLevels.info, "Document is not a feed, check for <link> tags.");
	  findFeedLinks();
	}
}

//runFinder();

// See if the document contains a <link> tag within the <head> and
// whether that points to an RSS feed.
function findFeedLinks() {
  // Find all the RSS link elements.
  var result = document.evaluate(
      '//*[local-name()="link"][contains(@rel, "alternate")] ' +
      '[contains(@type, "rss") or contains(@type, "atom") or ' +
      'contains(@type, "rdf")]', document, null, 0, null);
      
    var count = 0;
    var feeds = [];
    while (item = result.iterateNext()) {
        //console.log(item);
        feeds.push({"href": item.href, "title": item.title});
        ++count;
    }
    if (count == 0) return;

    var favicon = document.evaluate(
      '//*[local-name()="link"][contains(@rel, "shortcut icon")or contains(@rel, "Shortcut Icon")]', document, null, 0, null);
	try{
		var faviconHref = favicon.iterateNext().href;
	} catch(e) {
		var faviconHref = 'http://'+window.location.host+'/favicon.ico';
	}
	//alert(faviconHref);
	var image = new Image();
	image.src = faviconHref;
    image.onload = function () {
        if(this.height == 0) faviconHref = 'img/icon16.png';
        feedsPass(feeds, faviconHref);
    }
    image.onerror = function () {
        faviconHref = 'img/icon16.png';
        feedsPass(feeds, faviconHref);
    }
}

function feedsPass (feeds, faviconHref) {
    for(var i = 0; i < feeds.length; i++) {
        feeds[i].icon = faviconHref;
    }
    chrome.extension.sendRequest({msg: "ReaderAppPageFeeds", feeds: feeds});
    
}

// Check to see if the current document is a feed delivered as plain text,
// which Chrome does for some mime types, or a feed wrapped in an html.
function isFeedDocument() {
  var body = document.body;

  debugMsg(logLevels.info, "Checking if document is feed");

  var soleTagInBody = "";
  if (body && body.childElementCount == 1) {
    soleTagInBody = body.children[0].tagName;
    debugMsg(logLevels.info, "The sole tag in the body is: " + soleTagInBody);
  }

  // Some feeds show up as feed tags within the BODY tag, for example some
  // ComputerWorld feeds. We cannot check for this at document_start since
  // the body tag hasn't been defined at that time (contains only HTML element
  // with no children).
  if (soleTagInBody == "RSS" || soleTagInBody == "FEED" ||
      soleTagInBody == "RDF") {
    debugMsg(logLevels.info, "Found feed: Tag is: " + soleTagInBody);
    chrome.extension.sendRequest({msg: "feedDocument", href: location.href});
    return true;
  }

  // Chrome renders some content types like application/rss+xml and
  // application/atom+xml as text/plain, resulting in a body tag with one
  // PRE child containing the XML. So, we attempt to parse it as XML and look
  // for RSS tags within.
  if (soleTagInBody == "PRE") {
    debugMsg(logLevels.info, "Found feed: Wrapped in PRE");
    var domParser = new DOMParser();
    var doc = domParser.parseFromString(body.textContent, "text/xml");

    if (currentLogLevel >= logLevels.error) {
      var error = doc.getElementsByTagName("parsererror");
      if (error.length)
        debugMsg(logLevels.error, 'error: ' + doc.childNodes[0].outerHTML);
    }

    // |doc| now contains the parsed document within the PRE tag.
    if (containsFeed(doc)) {
      // Let the extension know that we should show the subscribe page.
      chrome.extension.sendRequest({msg: "feedDocument", href: location.href});
      return true;
    }
  }

  debugMsg(logLevels.info, "Exiting: feed is not a feed document");

  return false;
}
