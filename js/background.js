var storedFeeds = [];
var pageFeedData = {};
var prevVisit = {};
var curVisit = {};

function init() {
    localStorage['readerAppCurrentTab'] = 'http://';
    
    addListeners();
}

function getFeedContents(feed, firtsTime) {
    var url = feed.href;
    var feedId = feed.id;
    var entries = [];
    var oldItems = localStorage['ReaderAppFeed_' + feedId];
    if (oldItems){
        localStorage['oldReaderAppFeed_' + feedId] = localStorage['ReaderAppFeed_' + feedId];
    } else {
        localStorage['oldReaderAppFeed_' + feedId] = '';
    }
    localStorage['ReaderAppFeed_' + feedId] = '';
    //$.getJSON(config.rssParseURL+encodeURIComponent(url)+'&type=jsonp&client_cache=1000&callback=?', function(data){
    $.ajax({
        url: config.rssParseURL+encodeURIComponent(url)+'&type=jsonp&client_cache=1000&callback=?',
        dataType: 'jsonp',
        success: function(data){
            if(!data) {
                chrome.extension.sendRequest({msg: "showPopUp", feed: {error: 'error', id: feedId}});
                removeFeed(feedId);
                return;
            } else{
                if (firtsTime){
                    //storeFeed(feed);
                }
            }
            var resArray = data.rss.channel.item;
            var isNewsInFeed = false;
            feed.maxDate = new Date(resArray[0].pubDate).getTime()
            for (var i = 0; i < resArray.length; i++) {
                if(resArray[i].content != undefined) {
                    if($.trim(resArray[i].content) != '') {
                        var item = {
                            title : resArray[i].title,
                            descr : resArray[i].content,
                            link : resArray[i].link,
                            date : new Date(resArray[i].pubDate).getTime(),
                            isNew: '1'
                        }
                        if (item.date > feed.maxDate){
                            feed.maxDate = item.date;
                        }
                        var isItemOld = getItemByUrl(item.link, oldItems);
                        if (isItemOld){
                            item = isItemOld;
                            if (isItemOld.isNew == '1'){
                                isNewsInFeed = true;
                            }
                        } else {
                            isNewsInFeed = true;
                        }
                        entries.push(item);
                    }
                }
            }

            if(firtsTime) chrome.extension.sendRequest({msg: "showPopUp", feed: feed});

            feed.isNewsInFeed = isNewsInFeed;
            setFeedById(feed.id, feed);
            entriesHandler(feedId, entries);

        },
    error: function (e){
        console.log(e);
    }
    });
}

function getItemByUrl(link, itemsArr){
    if (itemsArr){
        itemsArr = JSON.parse(itemsArr);
        for (var i = 0; i < itemsArr.length; i++){
            var item = itemsArr[i];
            if (item.link == link){
                return item;
            }
        }
    }
    return false;
}

function setFeedById(id, feed){
    var feedList = JSON.parse(localStorage['ReaderAppStoredFeeds']);
    for (var i = 0; i < feedList.length; i++){
        if (feedList[i].id == id){
            feedList[i] = feed;
        }
    }
    localStorage['ReaderAppStoredFeeds'] = JSON.stringify(feedList);
}

function removeFeed(id){
    var res = [];
    var feedList = JSON.parse(localStorage['ReaderAppStoredFeeds']);
    if(feedList.length == 1) {
        delete localStorage['ReaderAppStoredFeeds'];
        return;
    }
    for (var i = 0; i < feedList.length; i++){
        if (feedList[i].id != id){
            res.push(feedList[i]);
        }
    }
    localStorage['ReaderAppStoredFeeds'] = JSON.stringify(res);
}

function entriesHandler(feedId, entries) {
    localStorage['ReaderAppFeed_' + feedId] = JSON.stringify(entries);
}

function getAllData() {
    var storedFeedsStr = localStorage['ReaderAppStoredFeeds'];
    if(storedFeedsStr != undefined) {
        storedFeeds = JSON.parse(storedFeedsStr);
        for(var i = 0; i < storedFeeds.length; i++) {
            getFeedContents(storedFeeds[i]);
        }
    }
}

function storeFeed(feed) {
    if (localStorage['ReaderAppStoredFeeds']){
        storedFeeds = JSON.parse(localStorage['ReaderAppStoredFeeds']);
    } else {
        storedFeeds = new Array();
    }
    if(feed.icon){
        if(feed.icon.indexOf('.png') == -1 && feed.icon.indexOf(config.icoConvertURL) == -1) {
            feed.icon = config.icoConvertURL + feed.icon;
        }
    } else {
        feed.icon = 'img/icon16.png';
    }
    if (!feed.title){
        feed.title = feed.href;
    }
    storedFeeds.push(feed);
    localStorage['ReaderAppStoredFeeds'] = JSON.stringify(storedFeeds);
}

function isAdded(feed) {
    var stored = localStorage['ReaderAppStoredFeeds'];
    if(stored) {
        stored = JSON.parse(stored);
        for (var i = 0; i < stored.length; i++) {
            if(stored[i].href == feed.href) return true;
        }
    }
    return false;
}

function showInfobar(tabId) {
    chrome.tabs.get(tabId, function(tab){
        var hostname = get_hostname_from_url(tab.url);
        if(!localStorage['ReaderApp_' + hostname]) localStorage['ReaderApp_' + hostname] = 0;
            getDomainTabsCount(hostname, function(count){
                if(count == 1) {
                    localStorage['ReaderApp_' + hostname]++;
                    localStorage['RSSfeedsFromPage'+tabId] = JSON.stringify(pageFeedData[tabId]);
                    if(localStorage['ReaderApp_' + hostname] == config.infobar1VisitCount || localStorage['ReaderApp_' + hostname] == config.infobar2VisitCount) {
                        chrome.smartapp.infobars.show({
                            tabId: tabId,
                            path : 'top.html'
                        });
                    }
                }
            });
    });
}

function addListeners() {
    chrome.extension.onRequest.addListener(function(request, sender) {
        if (request.msg == "ReaderAppNewFeed") {//On new feed added
            var storedFeeds = localStorage['ReaderAppStoredFeeds'] ? JSON.parse(localStorage['ReaderAppStoredFeeds']) : [];
            for(var i = 0; i < storedFeeds.length; i++) {
                if(storedFeeds[i].href == request.feed.href) return;
            }
            storeFeed(request.feed);
            getFeedContents(request.feed, true);
        } else if (request.msg == "ReaderAppPageFeeds") {//On new page feeds detected
            var tabId = sender.tab.id;
            pageFeedData[tabId] = request.feeds;
            
            for(var i = 0; i < pageFeedData[tabId].length; i++) {
                if(isAdded(pageFeedData[tabId][i])) {
                    return;
                }
            }
            
            showInfobar(tabId);
        }
    });

    //On tab update
    chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
        if ((tab.url.indexOf('http://') > -1 || tab.url.indexOf('https://') > -1)){
            if(prevVisit[tabId] != curVisit[tabId]) {
                chrome.tabs.executeScript(tabId, {code : 'try { runFinder() } catch (e) {}' });
            }
            
            localStorage['readerAppCurrentTab'] = 'http://' + get_hostname_from_url(tab.url);
        } else {
            localStorage['readerAppCurrentTab'] = 'http://';
        }
        prevVisit[tabId] = curVisit[tabId];
        curVisit[tabId] = get_hostname_from_url(tab.url);
    });
        
    //On tab change
    chrome.tabs.onSelectionChanged.addListener(function(tabId, selectInfo) {
        chrome.tabs.get(tabId, function(tab){
            if ((tab.url.indexOf('http://') > -1 || tab.url.indexOf('https://') > -1)){
                if(prevVisit[tabId] != curVisit[tabId]) {
                    chrome.tabs.executeScript(tabId, {code : 'try { runFinder() } catch (e) {}' });
                }
            
                localStorage['readerAppCurrentTab'] = 'http://' + get_hostname_from_url(tab.url);
            } else {
                localStorage['readerAppCurrentTab'] = 'http://';
            }
            prevVisit[tabId] = curVisit[tabId];
            curVisit[tabId] = get_hostname_from_url(tab.url);
        });
    });
}

function getDomainTabsCount(hostname, callback) {
    var count = 0;
    chrome.windows.getAll({populate: true}, function(windows){
        for(var i = 0; i < windows.length; i++) {
            for(var j = 0; j < windows[i].tabs.length; j++) {
                if(get_hostname_from_url(windows[i].tabs[j].url) == hostname) {
                    count++;
                }
            }
        }
        callback(count);
    });
}

function get_hostname_from_url(url) {
    return url.match(/:\/\/(.[^/]+)/)[1];
}

function escapeHtml(unsafe) {
  return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
}

getAllData();

setInterval(getAllData, config.checkUpdateInterval * 60 * 1000);