var changeRecToNewsTimer;
var changeStateTimer;
var appMode = {};
var newsSliderTimeOut;

var slidingTime = 30000;


function smartAppInit(){
    if (localStorage['ReaderAppStoredFeeds']){
        buildFeedListForMinimized();
        setState('newsShow');
    } else {
        setState('recList');
    }
    try{checkState();
        chrome.smartapp.sizeAndPos.onStateChanged.addListener(function(data){
            //console.log(data);
            changeState(data.currentState);
            chrome.extension.sendRequest({msg: "pleseClose", close:'true'});
        });
        chrome.smartapp.child.onRemoved.addListener(function(child){
            if (child.name == 'newsFeeds'){
                if (localStorage['ReaderAppStoredFeeds']){
                    setState('newsShow');
                } else{
                    setState('recList');
                }
            }
        });
        chrome.extension.onRequest.addListener(function(request, sender) {
            if (request.msg == "showPopUp") {
                openPopUpWindow(request.feed);
                if (request.feed != 'error'){
                    request.feed = JSON.parse(request.feed);
                    if ((request.feed.id+'').length > 4){
                        if (window.currentState == 'infoState'){
                            buildInfoState();
                        } else {
                            setState('newsShow');
                        }
                    } else {
                        getNews();
                    }
                }
            }
        });
    }catch(e){}
    initControls();
    renderRecomendList();
}

function openPopUpWindow(feed){
    if (!feed){
        feed = '0';
    }
    var windowPosObj = {
        name: "popUp",
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


function buildFeedListForMinimized(){
    var listContainer = $('.feedListContainer .feedList');
    var feedList = JSON.parse(localStorage['ReaderAppStoredFeeds']);
    var listItem = '';
    listContainer.html('');
    var isSmthNew = false;
    for (var i = 0; i < feedList.length; i++){
        var feed = feedList[i];
        if (feed.isNewsInFeed){
            isSmthNew = true;
        }
        var isNew = feed.isNewsInFeed ? 'update' : '';
        listItem += '<li class="feedItem '+isNew+'"><img width="16" height="16" src="'+feed.icon+'" rel="'+feed.id+'" alt="'+feed.title+'" title="'+feed.title+'"/></li>';
    }
    if (feedList.length > 1){
        var isNewAll = isSmthNew ? 'update' : '';
        listItem += '<li class="feedItem '+isNewAll+'"><img width="16" height="16" src="img/allFeeds.png" rel="all" alt="Mix" title="Mix"/></li>';
    }
    var preSlided = parseInt($('.feedList').css('margin-left').slice(0, -2));
    if (preSlided == ((3 - feedList.length)*28)){
        preSlided == true;
    }
    window.feedListLength = feedList.length;
    if (feedList.length > 3){
        $('.feedList').width(28*(feedList.length + 1));
        if (!preSlided){
            $('#scrollRight').show();
        }
        bindScrollEvents();
    }
    listContainer.append(listItem);
    $('.feedItem img').click(function(){
        openNewsWindow($(this).attr('rel'));
    });
}

function unBindScrollEvents(){
    $('#scrollRight').unbind('click');
    $('#scrollLeft').unbind('click');
}

function bindScrollEvents(){
        $('#scrollRight').unbind('click').click(function(){
            unBindScrollEvents();
            $('.feedList').animate({'margin-left':'-=28px'},500,function(){
                $('#scrollLeft').show();
                var slided = parseInt($('.feedList').css('margin-left').slice(0, -2));
                if (slided == ((3 - window.feedListLength)*28)){
                    $('#scrollRight').hide();
                }
                bindScrollEvents();
            });
        });
        $('#scrollLeft').unbind('click').click(function(){
            unBindScrollEvents();
            $('.feedList').animate({'margin-left':'+=28px'},500,function(){
                $('#scrollRight').show();
                var slided = parseInt($('.feedList').css('margin-left').slice(0, -2));
                if (slided == 0){
                    $('#scrollLeft').hide();
                }
                bindScrollEvents();
            });
        });
}

function addToFeedList(feed){
    chrome.extension.sendRequest({msg: "ReaderAppNewFeed", feed: feed});
}

function RecToNewsStartTimer(){
    changeRecToNewsTimer = setTimeout(function(){
        setState('newsShow');
    },5000);
}

function RecToNewsClearTimer(){
    if (changeRecToNewsTimer){
        clearTimeout(changeRecToNewsTimer);
    }
}

function getNews(){
    var firstPrior = new Array();
    var secondPrior = new Array();
    var feedList = JSON.parse(localStorage['ReaderAppStoredFeeds']);
    for (var i = 0; i < feedList.length; i++){
        var feed = feedList[i];
        var news = JSON.parse(localStorage['ReaderAppFeed_' + feed.id]);
        for (var j = 0; j < news.length; j++){
            var item = news[j];
            if (item.isNew == 1){
                firstPrior.push({feed:feed, item:item});
            } else if (item.isNew == 2){
                secondPrior.push({feed:feed, item:item});
            }
        }
    }
    var newsToShow = (firstPrior.length > 0) ? firstPrior : secondPrior;
    newsToShow = newsToShow.sort(sortNews);
    showFeeds(newsToShow);
    buildFeedListForMinimized();
    buildInfoState();
}

function showFeeds(newsList){
    clearTimeout(newsSliderTimeOut);
    $('.articleContainer').html('');
    if(newsList.length > 0){
        for (var i = 0; i < newsList.length; i++){
            var item = newsList[i];
            var disp = (i == 0) ? 'display:block' : 'display:none'
            var htmlnewContainer = '<div class="feedItemContainer" style="'+disp+'" rel="'+item.item.link+'">'+
                                        '<div class="feedNameTitle">'+
                                            '<img width="16" height="16" class="titleFeedIcon" src="'+item.feed.icon+'"/><span>'+item.feed.title+'</span>'+
                                        '</div>'+
                                        '<span class="articleTitle">'+item.item.title+'</span>'+
                                        '<span class="articleText">'+item.item.descr+'</span>'+
                                        '<mark class="bg" onClick="openNewsWindow(\''+item.feed.id+'\', \''+item.item.date+'\');"></mark>'+
                                        '<mark class="crease" rel="'+item.feed.id+'"></mark>'+
                                    '</div>';
            $('.articleContainer').append(htmlnewContainer);
        }
        startFeedsFadein();
    } else {
        var noNewsHtml = '<div class="feedItemContainer" rel="">'+
                            '<span class="articleTitle"></span>'+
                            '<span class="articleText">There are no news</span>'+
                            '<mark class="bg" onClick="openNewsWindow(\'0\', \'0\');"></mark>'+
                            '<mark class="crease" rel=""></mark>'+
                        '</div>';
        $('.articleContainer').html(noNewsHtml);
    }
}

function startFeedsFadein(){
    $('.feedItemContainer:visible').fadeOut(500, function(){
        if ($(this).hasClass('removeMe')){
            $(this).remove();
        }
        $(this).next().fadeIn(300);
        if ($(this).next().length == 0){
            $('.feedItemContainer').first().fadeIn(500);
        }
    });
    newsSliderTimeOut = setTimeout(startFeedsFadein, slidingTime);
}

function sortNews(a, b) {
    if(a.item.date > b.item.date)
        return -1;
    if(a.item.date < b.item.date)
        return 1;
    return 0;
}

function buildInfoState(){
    var feedList = JSON.parse(localStorage['ReaderAppStoredFeeds']);
    $('.numberOfFeeds .number').text(feedList.length);
    var nowDate = new Date().getTime();
    var newItems = 0;
    var newItems24h = 0;
    for (var i = 0; i < feedList.length; i++){
        var feed = feedList[i];
        var feedItems = JSON.parse(localStorage['ReaderAppFeed_' + feed.id]);
        for (var j = 0; j < feedItems.length; j++){
            var item = feedItems[j];
            if (item.isNew == '1'){
                newItems ++;
                if (nowDate - item.date < 24*60*60*1000){
                    newItems24h ++;
                }
            }
        }
    }
    $('.numberOfNews .number').text(newItems);
    $('.numberOfNewsPD .number').text(newItems24h);
    $('.infoMini .counter').text(newItems + ' New items');
}

function setState(state){
    window.currentState = state;
    var minimized = false;
    if ($('.minimizedState').css('display') == 'block'){
        minimized = true;
    }
    if (state == 'newsShow'){
        getNews();
        if (minimized){
            $('.infoMini').fadeOut(500,function(){
                $('.feedListContainer').fadeIn(500);
            });
            $('.viewMode').hide();
            $('.articleContainer').show();
        } else {
            if ($('.viewMode:visible').length == 0){
                $('.articleContainer').show();
            } else {
                $('.viewMode:visible').fadeOut(500,function(){
                    $('.articleContainer').fadeIn(500,function(){});
                });
            }
            $('.infoMini').hide();
            $('.feedListContainer').show();
        }
    } else if (state=='recList'){
        if ($('#newsCountContainer:visible').length == 0){
            $('#mainFrame').show();
            $('.feedListContainer').hide();
            $('.infoMini').show();
        } else {
            $('.viewMode:visible').fadeOut(500,function(){
                $('#mainFrame').fadeIn(500);
                $('.infoMini .counter').text('No feeds yet');
                $('#recomendFeeds li').css('opacity','1');
                $('#recomendFeeds li').removeClass('notActive');
            });
        }
    } else if (state == 'infoState'){
        buildInfoState();
        if (minimized){
            $('.feedListContainer').fadeOut(500,function(){
                $('.infoMini').fadeIn(500);
            });
            $('.viewMode').hide();
            $('#newsCountContainer').show();
        } else {
            $('.articleContainer').stop(true, true).fadeOut(500,function(){
                $(this).css('opacity','1');
                $('#newsCountContainer').fadeIn(500);
            });
            $('.feedListContainer').hide();
            $('.infoMini').show();
        }
    }
}

function renderRecomendList(){
    if(config.defaultFeeds){ // Variable from config server
        var feedListHtml = '';
        for (var i = 0; i < config.defaultFeeds.length; i++){
            var feed = config.defaultFeeds[i];
            feedListHtml += '<li>'+
                '<img align="left" class="recFeedIcon" src="'+feed.icon+'"/><span>'+feed.title+'</span> <img rel="'+i+'" class="plusIcon" src="img/recListPlus.png"/>'+
            '</li>';
        }
        $('#recomendFeeds').html(feedListHtml);
        $('#recomendFeeds li').live('click', function(){
            if (!$(this).hasClass('notActive')){
                var self = $(this).find('.plusIcon');
                self.parent().animate({
                    opacity: 0.25
                },100,function(){
                    var id = parseInt(self.attr('rel'));
                    addToFeedList(config.defaultFeeds[id]);
                    self.parent().addClass('notActive');
                    RecToNewsClearTimer();
                    tryToChangeState(parseInt(id)+1);
                }); 
            }
        });
    }
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

function changeState(state){
    var appState = '';
    var appPos = '';
    var linePos = state.indexOf('_');
    if (linePos > -1){
        appState = state.split('_')[0];
        appPos = state.split('_')[1];
    } else {
        appState = appPos = 'roaming';
    }
    appMode.appState = appState;
    appMode.appPos = appPos;
    if (appState == 'minimized'){
        setMinimized();
    } else {
        setFull();
    } 
}

function setMinimized(){
    $('#dockedMode').hide();
    $('.minimizedState').show();
}

function setFull(){
    $('#dockedMode').show();
    $('.minimizedState').hide();
}

function checkState(){
    chrome.smartapp.sizeAndPos.getState(chrome.app.getDetails().id, function(data){
        changeState(data.state);
    });
}

function openWindow(){
    var windowPosObj = {
        name: "newsFeeds",
        width: 387,
        height: 570,
        initParams : '2'
    };
    chrome.smartapp.sizeAndPos.getPosition(location.hostname, function(position){
        if(windowPosObj.width + 20 < position.x){
            if (windowPosObj.height + 40 < position.y){
                var verticalPos = - windowPosObj.height - 20;
                windowPosObj.top = verticalPos;
                windowPosObj.left = -windowPosObj.width + 160;
                windowPosObj.arrow_location = {
                    arrow_side: "bottom"
                };
                windowPosObj.arrow_location.arrow_offset = windowPosObj.width - 170;
            } else {
                windowPosObj.left = -windowPosObj.width - 20;
                windowPosObj.top = 0;
                windowPosObj.arrow_location = {
                    arrow_side: "right"
                };
                windowPosObj.arrow_location.arrow_offset = 0;
            }
        }
        chrome.smartapp.child.create(windowPosObj, function(window) {});
    });
}

function openNewsWindow(id, itemDate){
    setState('infoState');
    var windowPosObj = {
        name: "newsFeeds",
        width: 387,
        height: 550,
        initParams : id+','+itemDate
    };
    if (appMode.appPos == 'side' || appMode.appPos == 'roaming'){
        if (appMode.appState == 'minimized'){
            windowPosObj.top = - windowPosObj.height - 40;
            windowPosObj.left = -windowPosObj.width + 160;
            windowPosObj.arrow_location = {
                arrow_side: "bottom"
            };
            windowPosObj.arrow_location.arrow_offset = windowPosObj.width - 170;
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

function initControls(){
    $('.crease').live('click', function(){
        openNewsWindow($(this).attr('rel'));
    });
    $('.infoMini').mouseover(function(){
        if ($(this).find('.counter').text() == 'No feeds yet'){
            openPopUpWindow('');
        }
    });
    $('.feedItemContainer').live('mouseover', function(){
        if (!window.cursorOnItem){
            window.cursorOnItem = new Date().getTime();
        }
        clearTimeout(newsSliderTimeOut);
    });
    $('.feedItemContainer').live('mouseleave',function(){
        var curTime = new Date().getTime();
        if (curTime - window.cursorOnItem > 5*1000){
            //setPriorityToItem()
            var itemLink = $(this).attr('rel');
            var feedId = $(this).find('.crease').attr('rel');
            $(this).addClass('removeMe');
            setPriorityToItem(feedId, itemLink, '3');
        }
        window.cursorOnItem = 0;
        //startFeedsFadein();
        newsSliderTimeOut = setTimeout(startFeedsFadein, slidingTime);
    });
    $('.feedItemContainer').live('click', function(el){
        var itemLink = $(this).attr('rel');
        var feedId = $(this).find('.crease').attr('rel');
        $(this).addClass('removeMe');
        setPriorityToItem(feedId, itemLink, '3');
        if (!$(el.target).hasClass('bg')){
            chrome.tabs.create({url: $(this).attr('rel')});
        }
    });
}

function setPriorityToItem(feedId, itemLink, priority){
    var items = JSON.parse(localStorage['ReaderAppFeed_' + feedId]);
    var isNewsInFeed = false;
    for (var i = 0; i < items.length; i++){
        if (items[i].link == itemLink){
            items[i].isNew = '3';
        }
        if (items[i].isNew == 1){
            isNewsInFeed = true;
        }
    }
    localStorage['ReaderAppFeed_' + feedId] = JSON.stringify(items);
    if (isNewsInFeed){
        setFeedReadById(feedId);
    }
}

function setFeedReadById(id){
    var feedList = JSON.parse(localStorage['ReaderAppStoredFeeds']);
    for (var i = 0; i < feedList.length; i++){
        if (feedList[i].id == id){
            feedList[i].isNewsInFeed = false;
        }
    }
    localStorage['ReaderAppStoredFeeds'] = JSON.stringify(feedList);
}