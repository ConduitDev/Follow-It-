var changeRecToNewsTimer;
var changeStateTimer;
var readingPanelIsOpened = false;
var appMode = {};
var xButtTimeout = {};
var fastDeleteMode = false;

var newFeedsArray = [];
var checkForUpdatedInt;

function smartAppInit(){
    try{
        initListeners();
    }catch (e){

    }
    pushNewFeedsToArr();
    initFeedList();
    checkState();
    initControls();
    getTopUrls();
}

function initControls(){
    $('body').mouseleave(function(){
        fastDeleteMode = false;
    });
    $('.feedList li').die().live('click', function(e){
        if (!$(e.target).hasClass('x') && !$(e.target).hasClass('undo')){
            openNewsWindow($(this).attr('rel'));
        }
    });
    $('#readAll').click(function(){
        openNewsWindow('0');
    });
    $('#addFeed').click(function(){
        openPopUpWindow('addPopUp');
    });
    $('.feedList li:not(.deleted)').live("mouseenter", function(){
        $('.x').hide();
        var x = $(this).find('.x').first();
        var timeToFadeIn = config.xAppearTimeout * 1000;
        if(fastDeleteMode) timeToFadeIn = 1;
        try{
            clearTimeout(xButtTimeout[$(this).attr('rel')]);
        } catch(e){};
        xButtTimeout[$(this).attr('rel')] = setTimeout(function(){
            if(timeToFadeIn == 1) {
                x.show()  
            } else {
                x.fadeIn(function(){
                    fastDeleteMode = true;
                });
            }
        }, timeToFadeIn);
        //alert(followButt);
    }).live("mouseleave", function(){
        try{
            clearTimeout(xButtTimeout[$(this).attr('rel')]);
        } catch(e){};
        var x = $(this).find('.x').first();
        x.fadeOut();
    });
    
    $('.x').live("click", function(){
        fastDeleteMode = true;
        var feedItem = $(this).parent();
        $(this).fadeOut(function(){
            feedItem.addClass('deleted');
            var undo = feedItem.find('.undo').first();
            undo.fadeIn();
            setTimeout(function(){
                if(undo.css('display') != 'none') {
                    feedItem.fadeOut(function(){
                        var id = $(this).attr('rel');
                        removeFeed(id);                        
                        $(this).remove();
                    });
                }
            }, 3000);
        });
    });
    
    $('.undo').live("click", function(){
        var feedItem = $(this).parent();
        $(this).fadeOut(function(){
            feedItem.removeClass('deleted');
        });
    });
}

function removeFeed(id){
    var res = [];
    var feeds = JSON.parse(localStorage['ReaderAppStoredFeeds']);
    for(var i = 0; i < feeds.length; i++) {
        if(feeds[i].id != id) {
            res.push(feeds[i]);
        }
    }
    if (res.length == 0){
        localStorage.removeItem('ReaderAppStoredFeeds');
        changeState('recommend');
    } else {
        localStorage['ReaderAppStoredFeeds'] = JSON.stringify(res);
        //isNewsIsHere(buildFeedList);
        buildFeedList('new');
    }
    localStorage.removeItem('ReaderAppFeed_' + id);
    localStorage.removeItem('oldReaderAppFeed_' + id);
}

function initListeners(){
    chrome.smartapp.sizeAndPos.onStateChanged.addListener(function(data){
        checkState();
        chrome.extension.sendRequest({msg: "pleseClose", close:'true'});
    });
    chrome.smartapp.child.onRemoved.addListener(function(child){
        if (child.name == 'newsFeeds'){
            readingPanelIsOpened = false;
            if (localStorage['ReaderAppStoredFeeds']){
                changeState('default');
            } else {
                buildRecommendList();
            }
        }
    });
    chrome.extension.onRequest.addListener(function(request, sender) {
        if (request.msg == "showPopUp") {
            if (!request.feed.error){
                if ((request.feed.id+'').length > 4){
                    removeFeedFromRecommend(request.feed.id);
                    openPopUpWindow("popUp", JSON.stringify(request.feed));
                    isNewsIsHere(buildFeedList);
                }
            }else{
                if (request.feed.id){
                    removeFeedFromRecommend(request.feed.id);
                }
                
                openPopUpWindow("popUp", 'error');
            }
        } 
    });
}

function openPopUpWindow(name, feed){
    if (!feed){
        feed = '0';
    }
    var windowPosObj = {
        name: name,
        width: 205,
        height: 60,
        initParams : feed
    };
    if (appMode.appPos == 'side' || appMode.appPos == 'roaming'){
        windowPosObj.left = -220;
        windowPosObj.top = -15;
        windowPosObj.arrow_location = {
            arrow_side: "right"
        };
        windowPosObj.arrow_location.arrow_offset = 15;
    } else {
        if (appMode.appState == 'minimized'){
            windowPosObj.left = 0;
            windowPosObj.top = -80;
            windowPosObj.arrow_location = {
                arrow_side: "bottom",
                arrow_offset: 0
            };
        } else {
            windowPosObj.left = 6;
            windowPosObj.top = -75;
            windowPosObj.arrow_location = {
                arrow_side: "bottom",
                arrow_offset: 0
            };
        }
    }
    chrome.smartapp.child.create(windowPosObj, function(window) {});
}

function checkState(){
    try{
        chrome.smartapp.sizeAndPos.getState(chrome.app.getDetails().id, function(data){
            var appState = '';
            var appPos = '';
            var linePos = data.state.indexOf('_');
            if (linePos > -1){
                appState = data.state.split('_')[0];
                appPos = data.state.split('_')[1];
            } else {
                appState = appPos = 'roaming';
            }
            appMode.appState = appState;
            appMode.appPos = appPos;
            changeState();
        });
    } catch(e){
        
    }
}

function changeState(view){
    if (view){
        if (view == 'recommend'){
            if (appMode.appState != 'minimized'){
                buildRecommendList();
                $('#defaultState').fadeOut(200, function(){
                    $('#mainFrame').fadeIn(200);
                });
            }
        } else {
            isNewsIsHere(buildFeedListQuick);
            if (appMode.appState != 'minimized'){
                $('#mainFrame').fadeOut(200, function(){
                    $('#defaultState').fadeIn(200);
                });
            } else {
                $('#mainFrame').hide();
                $('#defaultState').show();
            }
        }
    } else {
        $('#dockedMode').removeClass();
        if (appMode.appState == 'minimized'){
            $('#dockedMode').addClass('minimized');
        }
    }
}

function removeSameFeeds(feedsFromHistory){
    var newFeedsArray = [];
    if (localStorage['ReaderAppStoredFeeds']){
        for (var i = 0; i < feedsFromHistory.length; i++){
            if (localStorage['ReaderAppStoredFeeds'].indexOf(feedsFromHistory[i].href) == -1){
                newFeedsArray.push(feedsFromHistory[i]);
            }
        }
    } else {
        return feedsFromHistory;
    }
    return newFeedsArray;
}

function buildRecommendList(){
    //if (window.feedsFromHistoryReady){
    if (true){
        $('#recomendFeeds').html('');
        var feedsFromHistory = localStorage['feedFromHistory'] ? JSON.parse(localStorage['feedFromHistory']) : [];
        feedsFromHistory = removeSameFeeds(feedsFromHistory);
        var length = (feedsFromHistory.length > config.rssFromHistoryMin - 1) ? config.rssFromHistoryMin : feedsFromHistory.length;
        window.recFeedsLength = length;
        var i = 0;
        while ($('#recomendFeeds li').length < length){
        //for (var i = 0; i < length; i++){
            var feed = feedsFromHistory[i];
            feed.icon = feed.icon ? feed.icon : 'img/icon16.png';
            if (localStorage['ReaderAppStoredFeeds']){
                if (localStorage['ReaderAppStoredFeeds'].indexOf(feed.href) < 0){
                    $('#recomendFeeds').append('<li><img align="left" class="recFeedIcon" src="'+feed.icon+'"/><span>'+feed.title+'</span> <img rel="'+i+'" class="plusIcon" src="img/recListPlus.png"/><img rel="'+i+'" class="loadIcon" src="img/mini-loader.gif"/></li>');
                }
            } else {
                $('#recomendFeeds').append('<li><img align="left" class="recFeedIcon" src="'+feed.icon+'"/><span>'+feed.title+'</span> <img rel="'+i+'" class="plusIcon" src="img/recListPlus.png"/><img rel="'+i+'" class="loadIcon" src="img/mini-loader.gif"/></li>');
            }
            i++;
        }
        
        $('.plusIcon').die().live('click',function(){
            $(this).hide();
            $(this).next().show();
            var feed = feedsFromHistory[parseInt(parseInt($(this).attr('rel')))];
            feed.id = new Date();
            feed.id = feed.id.getTime();
            $(this).next().attr('rel', feed.id+'');
            /*$(this).parent().fadeOut(500,function(){
                var feed = feedsFromHistory[++length]
                if (feed){
                    $('#recomendFeeds').append('<li><img align="left" class="recFeedIcon" src="'+feed.icon+'"/><span>'+feed.title+'</span> <img rel="'+i+'" class="plusIcon" src="img/recListPlus.png"/></li>');
                }
                $(this).remove();
            });*/
            addToFeedList(feed);
            RecToNewsClearTimer();
            if (!readingPanelIsOpened){
                tryToChangeState(feed.id);
            }
        });
        $('#recomendFeeds li').die().live('click',function(){
            $(this).find('.plusIcon:visible').click();
        });
    } else {
        setTimeout(buildRecommendList, 1000);
    }
}

function removeFeedFromRecommend(feedId){
    var feedsFromHistory = localStorage['feedFromHistory'] ? JSON.parse(localStorage['feedFromHistory']) : [];
    feedsFromHistory = removeSameFeeds(feedsFromHistory);
    $(".loadIcon[rel='"+feedId+"']").parent().fadeOut(500,function(){
        var feed = feedsFromHistory[++window.recFeedsLength]
        if (feed){
            $('#recomendFeeds').append('<li><img align="left" class="recFeedIcon" src="'+feed.icon+'"/><span>'+feed.title+'</span> <img rel="'+i+'" class="plusIcon" src="img/recListPlus.png"/></li>');
        }
        $(this).remove();
    });
    
}

function RecToNewsClearTimer(){
    if (changeRecToNewsTimer){
        clearTimeout(changeRecToNewsTimer);
    }
}

function RecToNewsStartTimer(){
    changeRecToNewsTimer = setTimeout(function(){
        changeState('default');
    },5000);
}

function tryToChangeState(feedId){
    if (localStorage['ReaderAppFeed_' + feedId]){
        RecToNewsStartTimer();
    } else {
        clearTimeout(changeStateTimer);
        changeStateTimer = setTimeout(function(){
            tryToChangeState(feedId);
        }, 2000);
    }
}

function getTopUrls(){
    window.urlsWithFeeds = [];
    window.urls = [];
    var curDate = new Date().getTime();
    chrome.history.search({text:"",startTime:0,endTime:curDate},function(pages){
        pages.sort(sortPages);
        for (var i = 0; i < pages.length; i++){
            var page = pages[i];
            if (page.url.indexOf('http://') > -1 && window.urls.indexOf(cutUrl(page.url)) == -1){
                window.urls.push(cutUrl(page.url));
            }
        }
        getRssFromUrls();
    });
}

function cutUrl(url){
    var httpPos = url.indexOf('http://');
    if (httpPos < 0){
        url = url.slice(0, url.indexOf('/'));
    } else {
        var withoutHttp = url.slice(httpPos + 7, url.length);
        withoutHttp = (withoutHttp.indexOf('/') < 0) ? withoutHttp : withoutHttp.slice(0, withoutHttp.indexOf('/'));
        url = 'http://' + withoutHttp;
    }
    return url;
}

function storeFeedFromHistory(feed){
    var feedFromHistory = localStorage['feedFromHistory'] ? localStorage['feedFromHistory'] : '';
    if (feedFromHistory.indexOf(feed.href) == -1){
        if (feedFromHistory){
            feedFromHistory = JSON.parse(feedFromHistory);
        } else {
            feedFromHistory = [];
        }
        if (!localStorage['ReaderAppStoredFeeds']){
            feedFromHistory.push(feed);
        } else if (localStorage['ReaderAppStoredFeeds'].indexOf(feed.href) == -1){
            feedFromHistory.push(feed);
        }
        localStorage['feedFromHistory'] = JSON.stringify(feedFromHistory);
    }
}

function getRssFromUrls(){
    if(window.urls[0]){
        $.getJSON(config.feedFinderURL+encodeURIComponent(window.urls[0])+'&callback=?', function(data){
            for (var i = 0; i < data.feeds.length; i++){
                storeFeedFromHistory(data.feeds[i]);
                if (i == 1) break;
            }
            window.urls.splice(0,1);
            var storedFeedsFromHistory = localStorage['feedFromHistory'] ? JSON.parse(localStorage['feedFromHistory']) : [];
            if (storedFeedsFromHistory != config.rssFromHistoryLimit){
                getRssFromUrls();
            }
            if (storedFeedsFromHistory == config.rssFromHistoryMin){
                window.feedsFromHistoryReady = true;
            }
        });
    }
}

function sortPages(a, b) {
    if(a.visitCount > b.visitCount)
        return -1;
    if(a.visitCount < b.visitCount)
        return 1;
    return 0;
}

function sortFeeds(a, b) {
    if(a.maxDate > b.maxDate)
        return -1;
    if(a.maxDate < b.maxDate)
        return 1;
    return 0;
}

function initFeedList(){
    if (!localStorage['wasUsed']){
        $('.loader').show();
        for (var i = 0; i < config.defaultFeeds.length; i++){
            addToFeedList(config.defaultFeeds[i]);
        }
        localStorage['wasUsed'] = '1';
    } else {
        if (!localStorage['ReaderAppStoredFeeds'] || localStorage['ReaderAppStoredFeeds'] == '[]'){
            changeState('recommend');
        }
    }
    isNewsIsHere(buildFeedList);
}

function buildFeedList(newOrOld){
    $('.loader').hide();
    var feedKey = '';

    var feedList = JSON.parse(localStorage['ReaderAppStoredFeeds']);
    if (newOrOld == 'old'){
        feedKey = 'old';
        $('.feedList.new').html('');
        $('.feedList.old').html('');
    }
    feedList.sort(sortFeeds);
    var newItemsSum = 0;
    for (var i = 0; i < feedList.length; i++){
        var feed = feedList[i];
        var feeItems = localStorage[feedKey + 'ReaderAppFeed_' + feed.id];
        if (feeItems){
            feeItems = JSON.parse(feeItems);
            for (var j = 0; j < feeItems.length; j++){
                if (feeItems[j].isNew == '1'){
                    newItemsSum++;
                }
            }
        }
        $('#readAll span').text('Read All ('+newItemsSum+')');
        if (newOrOld == 'old'){
            if (feed.isNewsInFeed){
                $('.feedList.new').append('<li rel="'+feed.id+'"><div class="newOrOld"></div><img align="left" class="recFeedIcon" src="'+feed.icon+'"/><div class="x"></div><div class="undo"></div><span>'+feed.title+'</span></li>');
            } else {
                $('.feedList.old').append('<li rel="'+feed.id+'"><div class="newOrOld"></div><img align="left" class="recFeedIcon" src="'+feed.icon+'"/><div class="x"></div><div class="undo"></div><span>'+feed.title+'</span></li>');
            }
            checkToInsertLine();
        } 
    }
    if (newOrOld == 'new'){
        animateSorting(feedList);
    }
}

function buildFeedListQuick(newOrOld){ /* they want to change logic, but did not give time for it, so...*/
    $('.loader').hide();
    var feedKey = '';

    var feedList = JSON.parse(localStorage['ReaderAppStoredFeeds']);
    if (newOrOld == 'old'){
        feedKey = 'old';
    }
    $('.feedList.new').html('');
    $('.feedList.old').html('');
    feedList.sort(sortFeeds);
    var newItemsSum = 0;
    for (var i = 0; i < feedList.length; i++){
        var feed = feedList[i];
        var feeItems = localStorage[feedKey + 'ReaderAppFeed_' + feed.id];
        if (feeItems){
            feeItems = JSON.parse(feeItems);
            for (var j = 0; j < feeItems.length; j++){
                if (feeItems[j].isNew == '1'){
                    newItemsSum++;
                }
            }
        }
        $('#readAll span').text('Read All ('+newItemsSum+')');
        if (feed.isNewsInFeed){
            $('.feedList.new').append('<li rel="'+feed.id+'"><div class="newOrOld"></div><img align="left" class="recFeedIcon" src="'+feed.icon+'"/><div class="x"></div><div class="undo"></div><span>'+feed.title+'</span></li>');
        } else {
            $('.feedList.old').append('<li rel="'+feed.id+'"><div class="newOrOld"></div><img align="left" class="recFeedIcon" src="'+feed.icon+'"/><div class="x"></div><div class="undo"></div><span>'+feed.title+'</span></li>');
        }
        checkToInsertLine();
    }
}

function animateSorting(feedList){
    var unread = [];
    var read = [];
    for (index in feedList){
        if (feedList[index].isNewsInFeed){
            unread.push(feedList[index]);
        } else {
            read.push(feedList[index]);
        }
    }
    sortFeedsInList(unread, 0, 'new');
    sortFeedsInList(read, 0, 'old');
}

function sortFeedsInList(feeds, index, newOrOld){
    if (index < feeds.length){
        var element = $(".feedList li[rel='"+feeds[index].id+"']");
        if (element.length > 0){
            var curPos = $(".feedList."+newOrOld+" li").index(element);
            if (curPos != index){
                element.fadeOut(500, function(){
                    element.remove();
                    var prevElem = $(".feedList."+newOrOld+" li")[index-1];
                    if (prevElem){
                        element.insertAfter(prevElem).fadeIn(500, function(){
                            sortFeedsInList(feeds, ++index, newOrOld);
                            checkToInsertLine();
                        });
                    } else {
                        $(".feedList."+newOrOld).prepend(element);
                        element.fadeIn(500, function(){
                            sortFeedsInList(feeds, ++index, newOrOld);
                            checkToInsertLine();
                        });
                    }
                });
            } else {
                sortFeedsInList(feeds, ++index, newOrOld);
            }
        } else {
            element = $('<li rel="'+feeds[index].id+'" style="display:none"><div class="newOrOld"></div><img align="left" class="recFeedIcon" src="'+feeds[index].icon+'"/><div class="x"></div><div class="undo"></div><span>'+feeds[index].title+'</span></li>');
            $(".feedList."+newOrOld).prepend(element);
            element.fadeIn(500, function(){
                sortFeedsInList(feeds, ++index, newOrOld);
                checkToInsertLine();
            });
        }
        
    } else {
        var length = $(".feedList."+newOrOld+" li").length
        $('.feedList.'+newOrOld+' li').each(function(elIndex){if (index<=elIndex && elIndex < length){$(this).remove()}})
    }
}

function checkToInsertLine(){
    if($('.feedList.new li').length == 0 || $('.feedList.old li').length == 0){
        $('.newsSplitter').hide();
    } else {
        $('.newsSplitter').show();
    }
}

/*
function buildFeedList(newOrOld){
    $('.loader').hide();
    if (newOrOld == 'old'){
        $('.newsSplitter').hide();
        var feedList = JSON.parse(localStorage['ReaderAppStoredFeeds']);
        var newItemsSum = 0;
        $('.feedList.old').html('');
        $('.feedList.new').html('');
        for (var i = 0; i < feedList.length; i++){
            var feed = feedList[i];
            var feeItems = localStorage['oldReaderAppFeed_' + feed.id] ? localStorage['oldReaderAppFeed_' + feed.id] : localStorage['ReaderAppFeed_' + feed.id];
            if (feeItems){
                feeItems = JSON.parse(feeItems);
                for (var j = 0; j < feeItems.length; j++){
                    if (feeItems[j].isNew == '1'){
                        newItemsSum++;
                    }
                }
            }
            $('#readAll span').text('Read All ('+newItemsSum+')');
            if (feed.isNewsInFeed){
                $('.feedList.new').append('<li rel="'+feed.id+'"><div class="newOrOld"></div><img align="left" class="recFeedIcon" src="'+feed.icon+'"/><div class="x"></div><div class="undo"></div><span>'+feed.title+'</span></li>');
            } else {
                $('.feedList.old').append('<li rel="'+feed.id+'"><div class="newOrOld"></div><img align="left" class="recFeedIcon" src="'+feed.icon+'"/><div class="x"></div><div class="undo"></div><span>'+feed.title+'</span></li>');
            }
            if($('.feedList.new li').length == 0 || $('.feedList.old li').length == 0){
                $('.newsSplitter').hide();
            } else {
                $('.newsSplitter').show();
            }
        }
    } else {
        if ($('.feedList.old li').length == 0 && $('.feedList.new li').length == 0){
            buildFeedList('old');
        } else {
            checkForUpdatedFeeds();
        }
    }
}*/

function openNewsWindow(id, itemDate){
    readingPanelIsOpened = true;
    changeState('recommend');
    var windowPosObj = {
        name: "newsFeeds",
        width: 381,
        height: 540,
        initParams : id+','+itemDate
    };
    if (appMode.appPos == 'side' || appMode.appPos == 'roaming'){
        if (appMode.appState == 'minimized'){
            windowPosObj.top = - windowPosObj.height;
            windowPosObj.left = -windowPosObj.width + 160;
            windowPosObj.arrow_location = {
                arrow_side: "right"
            };
            windowPosObj.arrow_location.arrow_offset = 535;
        }else{
            windowPosObj.left = -407;
            windowPosObj.top = 0;
            windowPosObj.arrow_location = {
                arrow_side: "right"
            };
            windowPosObj.arrow_location.arrow_offset = 0; 
        }
        
    } else {
        if (appMode.appState == 'minimized'){
            windowPosObj.left = 0;
            windowPosObj.top = -590;
            windowPosObj.arrow_location = {
                arrow_side: "bottom",
                arrow_offset: 70
            };
        } else {
            windowPosObj.left = 6;
            windowPosObj.top = -585;
            windowPosObj.arrow_location = {
                arrow_side: "bottom",
                arrow_offset: 70
            };
        }
    }
    chrome.smartapp.child.create(windowPosObj, function(window) {});
}

function addToFeedList(feed){
    chrome.extension.sendRequest({msg: "ReaderAppNewFeed", feed: feed});
}

function isNewsIsHere(callback){
    var feedList;
    var isLoaded = true;
    if (localStorage['ReaderAppStoredFeeds']){
        feedList = JSON.parse(localStorage['ReaderAppStoredFeeds']);
        for (var i = 0; i < feedList.length; i++){
            if (!localStorage['ReaderAppFeed_' + feedList[i].id]){
                isLoaded = false;
                callback.call(null, 'old');
                break;
            }
        }
    }
    if(!isLoaded || !feedList){
        setTimeout(function(){
            isNewsIsHere(callback);
        }, 5000);
    } else {
        callback.call(null, 'new');
    }
}

function pushNewFeedsToArr() {
    if(localStorage['ReaderAppStoredFeeds']) {
        var feeds = JSON.parse(localStorage['ReaderAppStoredFeeds']);
         
        for(var i = 0; i < feeds.length; i++) {
            if(feeds[i].isNewsInFeed) {
                newFeedsArray.push(feeds[i].id);
            }
        }
    }
}

function removeIdFromArr(id) {
    var res = [];
    for(var i = 0; i < newFeedsArray.length; i++) {
        if(newFeedsArray[i] != id) {
           res.push(newFeedsArray[i]); 
        }
    }
    newFeedsArray = res;
}

function checkForUpdatedFeeds() {
    if(localStorage['ReaderAppStoredFeeds']) {
        var feeds = JSON.parse(localStorage['ReaderAppStoredFeeds']);
        feeds = feeds.reverse();
        for(var i = 0; i < feeds.length; i++) {
            if(feeds[i].isNewsInFeed && !$.inArray(feeds[i].id, newFeedsArray) && $(".feedList.old li[rel='"+feeds[i].id+"']").size() > 0) {
                feedToTopAnimate(feeds[i].id);
                $('.newsSplitter').show();
                return;
            }
            if(!feeds[i].isNewsInFeed && $(".feedList.new li[rel='"+feeds[i].id+"']").size() > 0) {
                feedToBottomAnimate(feeds[i].id);
                return;
            }
        }
    }
}

function feedToTopAnimate(id) {
    var item = $(".feedList.old li[rel='"+id+"']");
    if(item.size() == 0) return;
    item.animate({opacity : 0}, function(){
        var html = $(this).html();
        $(this).animate({height : 0}, function(){
            $(this).remove();
            $(".feedList.new").prepend('<li rel="'+id+'">'+html+'</li>');
            $(".feedList.new li[rel='"+id+"']").animate({opacity : 1});
            removeIdFromArr(id);
            checkForUpdatedFeeds();
        });
    });
}

function feedToBottomAnimate(id) {
    var item = $(".feedList.new li[rel='"+id+"']");
    if(item.size() == 0) return;
    item.animate({opacity : 0}, function(){
        var html = $(this).html();
        $(this).animate({height : 0}, function(){
            $(this).remove();
            $(".feedList.old").append('<li rel="'+id+'">'+html+'</li>');
            $(".feedList.old li[rel='"+id+"']").animate({opacity : 1});
            if ($('.feedList.new li').length == 0){
                $('.newsSplitter').hide();
            } else {
                if ($('.newsSplitter').css('display') == 'none'){
                    $('.newsSplitter').show();
                }
            }
            checkForUpdatedFeeds();
        });
    });
}