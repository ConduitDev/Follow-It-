var allFeedsData = [];
var xButtTimeout = {};
var fastDeleteMode = false;
var newFeedCounter = 0;

var month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function newsFeedsInit(){
    var winId = window.location.search.split('?id=')[1];
    if(winId != 'undefined'){
        chrome.smartapp.child.onCreated.addListener(function(child){
            if (child.name == 'newsFeeds'){
                if (child.id != winId){
                    closeWindow();
                }
            }
        });
        
        chrome.smartapp.child.get(parseInt(winId),function(obj){
            
            var params = obj.initParams.split(',');
            renderFeedsList();
            
            initControls();
            ////console.log(params);
            
            if(params[0] == '0') {
                $('.feedItem').first().click();
                return;
            }
            $('li.tab'+params[0]).click();
            window.location.href = '#item'+params[1];
            setFocused(params[1]);
        });
    }
    addListeners();  
}

function addListeners() {
    chrome.extension.onRequest.addListener(function(request, sender) {
        if(request.msg == "ReaderAppNewFeed") {
            newFeedCounter++;
            appendFeedLoaders();
        } else if (request.msg == "showPopUp") {
            newFeedCounter--;
             if (!request.feed.error){
                if ((request.feed.id+'').length > 4){
                    renderFeedsList();
                    appendFeedLoaders();
                }
            }
        } else if(request.msg == "pleseClose"){
            closeWindow();
        }
    });
}

function appendFeedLoaders() {
    $(".feedItemLoader").remove();
    if(newFeedCounter < 0) newFeedCounter = 0;
    for(var i = 0; i < newFeedCounter; i++) {
        //$("#feedList").append('<li class="feedItemLoader" title="Loading..."><img src="img/mini-loader.gif"></li>');
        $("<li class='feedItemLoader' title='Loading...'><img src='img/mini-loader.gif'></li>").insertBefore($(".feedItem:not(.taball)").first());
    }
}

function initControls(){
    $('.closeBtn').click(function(){
        closeWindow();
    });
}

function clickFeedItem(id) {
    window.currentFeed = id;
    var feedItem = $('.tab'+id);
    if(id == 'all') {
        var feed = mergeAllNews();
        var feedList = JSON.parse(localStorage['ReaderAppStoredFeeds']);
        try{
        for (var i = 0; i < feedList.length; i++){
           setPriorityToItem(feedList[i].id); 
        }
        }catch(e){};
    } else {
        var feed = getFeedById(id);
        //try {
            setPriorityToItem(feed.id);
        //} catch(e) {};
    }
    showNews(feed);
      $('#newsList').scrollTop(0);
    
    feedItem.removeClass('isNew');
    var freshFeedsNum = $('.isNew:not(.taball)').size();
    if(freshFeedsNum > 0) {
        $('.taball').addClass('isNew');
    } else {
        $('.taball').removeClass('isNew');
    }
    
    if(feedItem.is('.taball')) $('li.feedItem').removeClass('isNew');
    
    $('li.feedItem').removeClass('clicked');
    feedItem.addClass('clicked');
}

function initFeedsEvents(){
    $('.feedItem').die().live("click", function(){
        //var feedItem = $(this).parent();
        var id = $(this).attr('rel');
        clickFeedItem(id);
        
    });
    
    $('li.feedItem:not(.deleted)').die().live("mouseenter", function(){
        $('.x').hide().removeClass('visible');
        var x = $(this).find('.x').first();
        var timeToFadeIn = config.xAppearTimeout * 1000;
        //var timeToFadeIn = 1000;
        if(fastDeleteMode) timeToFadeIn = 1;
        try{
            clearTimeout(xButtTimeout[$(this).attr('rel')]);
        } catch(e){};
        xButtTimeout[$(this).attr('rel')] = setTimeout(function(){
           if(timeToFadeIn == 1) {
                x.show()
                x.addClass('visible');
            } else {
                x.fadeIn(function(){
                    fastDeleteMode = true;
                    $(this).addClass('visible');
                });
            }
            
        }, timeToFadeIn);
        //alert(followButt);
    }).live("mouseleave", function(){
        try{
            clearTimeout(xButtTimeout[$(this).attr('rel')]);
        } catch(e){};
        var x = $(this).find('.x').first();
        x.fadeOut(function(){
            $(this).removeClass('visible');
        });
    });
    
    $('.x').die().live("click", function(e){
        e.stopPropagation();
        fastDeleteMode = true;
        var feedItem = $(this).parent();
        $(this).fadeOut(function(){
            feedItem.addClass('deleted');
            var undo = feedItem.find('.undo').first();
            undo.addClass('visible');
            undo.fadeIn();
            setTimeout(function(){
                if(undo.css('display') != 'none') {
                    feedItem.fadeOut(function(){
                        var id = $(this).attr('rel');
                        //try {
                            removeFeed(id);
                        //} catch(e){};
                        $(this).remove();
                        
                        
                        if($('.feedItem').size() <= 15) {
                            $('#feedList').animate({'margin-top': '0px'}, 1000);
                            $('#scrollUp, #scrollDown').hide();
                        }
                    });
                }
            }, 3000);
        });
    });
    
    $('.undo').die().live("click", function(e){
        e.stopPropagation();
        var feedItem = $(this).parent();
        $(this).fadeOut(function(){
            $(this).removeClass('visible');
            feedItem.removeClass('deleted');
        });
    });
    
    $('body').mouseleave(function(){
        fastDeleteMode = false;
    });
    
    $(document).click(function(e){
        if(!$(e.target).hasClass('x') && !$(e.target).hasClass('undo')) {
            fastDeleteMode = false;
        }
    });
    
    initScrollButtons();
}

function initScrollButtons() {
    $('#scrollUp').unbind('click').click(function(){
        $('#scrollUp, #scrollDown').unbind('click');
        var feedList = $('#feedList');
        var margin = feedList.css('margin-top');
        var wrapHeight = $('#feedListWrap').height();
        var listHeight = feedList.height();
        //console.log(margin);
        if(margin == '-36px') {
            $(this).hide();
        }
        
        $('#scrollDown').show();
                
        feedList.animate({'margin-top' : '+=36px'},1000, initScrollButtons);
    });
    
    $('#scrollDown').unbind('click').click(function(){
        $('#scrollUp, #scrollDown').unbind('click');
        var feedList = $('#feedList');
        var margin = parseInt(feedList.css('margin-top'));
        var wrapHeight = $('#feedListWrap').height();
        var listHeight = feedList.height();
        //console.log(margin);
        //console.log(wrapHeight);
        //console.log(listHeight);
        if(wrapHeight + 72 >= listHeight + margin) {
            $(this).hide();
        }
        $('#scrollUp').show();
        feedList.animate({'margin-top' : '-=36px'},1000, initScrollButtons);
    });
}

function removeFeed(id) {
    var res = [];
    var feeds = JSON.parse(localStorage['ReaderAppStoredFeeds']);
    for(var i = 0; i < feeds.length; i++) {
        if(feeds[i].id != id) {
            res.push(feeds[i]);
        }
    }
    localStorage['ReaderAppStoredFeeds'] = JSON.stringify(res);
    localStorage.removeItem('ReaderAppFeed_' + id);
    localStorage.removeItem('oldReaderAppFeed_' + id);
    
    var currFeedId = $('.clicked').attr('rel');
    
    if($('.deleted').size() == 0) {
        renderFeedsList();
    }
    
    if(currFeedId == id) {
        if($('.taball').css('display') != 'none') {
            $('.taball').click();
        }
    } else {
        //$('.tab'+currFeedId+' .feedImg').click();
        if(localStorage['ReaderAppFeed_' + currFeedId]) {
            clickFeedItem(currFeedId);
        }
    }
    if(res.length == 0) {
        localStorage.removeItem('ReaderAppStoredFeeds');
        closeWindow();
    } else {
        if(res.length == 1) {
            $('.taball').remove();
            $('.feedItem').first().click();
        }
    }
}

function closeWindow(){
    var id = parseInt(location.search.substr(4));
    chrome.smartapp.child.remove(id);
}

function renderFeedsList(){
    var storedFeeds = JSON.parse(localStorage['ReaderAppStoredFeeds']);
    var lis = '';
    if(storedFeeds.length > 1) {
        lis += '<li class="feedItem taball" rel="all" title="Mix"><div class="feedImg"><img width="16" height="16" src="img/allFeeds.png"></div><div class="newOrOld"></div></li>';
    }
    
    var feeds = storedFeeds.reverse();
    
    for(var i = 0; i < feeds.length; i++) {
        var clicked = (window.currentFeed == feeds[i].id) ? ' clicked' : '';
        //console.log(feeds[i].isNewsInFeed);
        var feedClass = (feeds[i].isNewsInFeed)?'isNew' : '';
        lis += '<li class="feedItem tab'+feeds[i].id+' '+feedClass+clicked+'" rel="' + feeds[i].id + '" title="' + feeds[i].title + '">'+
        '<div class="feedImg"><img width="16" height="16" src="' + feeds[i].icon + '"></div>'+
        '<div class="x"></div>'+
        '<div class="undo"></div>'+
        '<div class="newOrOld"></div>'+
        '</li>';
        
        var feedEntries = retrieveFeedEntries(feeds[i].id, renderFeedsList);
        if(!feedEntries) continue;
        feeds[i].items = feedEntries.sort(sortNews);
        allFeedsData.push(feeds[i]);
    }
    $('#feedList').html(lis);
    
    var freshFeedsNum = $('.isNew:not(.taball)').size();
    if(freshFeedsNum > 0) {
        $('.taball').addClass('isNew');
    } else {
        $('.taball').removeClass('isNew');
    }
    
    if($('.feedItem').size() > 15) {
        $('#scrollDown').show();
    } else {
        $('#scrollDown, #scrollDown').hide();
    }
    
    initFeedsEvents();
}

function retrieveFeedEntries(feedId, callback) {
    if(localStorage['ReaderAppFeed_' + feedId]) {
        return JSON.parse(localStorage['ReaderAppFeed_' + feedId]);
    }
    setTimeout(function(){
        callback.call();
    }, 5000);
    if(localStorage['oldReaderAppFeed_' + feedId]) {
        return JSON.parse(localStorage['oldReaderAppFeed_' + feedId]);
    }
    return false;
}

function getFeedById(id) {
    for(var i = 0; i < allFeedsData.length; i++) {
        if(allFeedsData[i].id == id) return allFeedsData[i];
    }
}

function newsItemClick(itemLink, feedId) {
    if(itemLink == 'false') return;
    chrome.tabs.create({url: itemLink});
    setPriorityToItem(feedId, itemLink, '3');
}

function showNews(feed) {
    /*$('.feedTitle span').text(feed.title);
    $('.titleFeedIcon').attr('src', feed.icon);*/
    $('.feedText').remove();
    $('.header').prepend('<div class="feedText"><div class="feedSmth"><img width="16" height="16" src="'+feed.icon+'"/><span class="feedTitle">'+feed.title+'</span></div></div>');
    
    if(feed.items.length == 0) {
        $('#newsList').html('<div id="noNews">There are no news</div>');
        setFeedAsRead(feed.id);
        return;
    }
    if(feed.items[0].date) {
        var today = new Date(); 
        var todayDate = today.getDate()+', '+month[today.getMonth()]+' '+today.getFullYear();
        var prev = new Date(feed.items[0].date);
        var prevDate = prev.getDate()+', '+month[prev.getMonth()]+' '+prev.getFullYear();
    }
    
    var html = '<li class="newsPerDate">'+
        '<span class="dateHeader">'+ ((prevDate == todayDate || !todayDate)? 'Today' : prevDate) +'</span>'+
        '<ul class="newsPerDateList">';

    var virtDiv = $('<div></div>');
    
    //console.log(feed.items);
    
    for(var i = 0; i < feed.items.length; i++) {
        
        var itemTime = '--:--'
        if(feed.items[i].date) {
            var itemdt = new Date(feed.items[i].date);
            var itemDate = itemdt.getDate() +', '+month[itemdt.getMonth()]+' '+itemdt.getFullYear();
            var itemHours = itemdt.getHours();
            var itemMinutes = itemdt.getMinutes();
            itemTime = ((itemHours < 10) ? '0'+itemHours : itemHours) + ':' + ((itemMinutes < 10) ? '0'+itemMinutes : itemMinutes);
        }
        
        var newsTimeClass = (i%2 == 0)? 'odd' : '';
        var isNew = (feed.items[i].isNew == '1')?'new' : '';
        
        if(typeof feed.items[i].link != 'string') {
            var itemLink = false;
        } else {
            var itemLink = feed.items[i].link;
        }
        
        virtDiv.html(feed.items[i].descr);
        
        if(prevDate == itemDate || !itemDate) {
            html += '<li id="item'+feed.items[i].date+'" class="newsItem '+newsTimeClass+' '+isNew+'" onclick="newsItemClick(\''+itemLink+'\', \''+feed.id+'\')">'+
                    '<div class="newsTimeLine"></div>'+
                    '<div class="newsTime">' + itemTime + '</div>'+
                    '<div class="newsTitle">' + feed.items[i].title + '</div>'+
                    '<div class="newsText">';
                    //var text = feed.items[i].descr;
                    var text = virtDiv.text();
                    if(text.length > 200) {
                        html += text.slice(0, 200)+'...';
                    } else {
                        html += text;
                    }
            html += '</div>'+
                '</li>';
        } else {
            html += '</ul></li>'+
                '<li class="newsPerDate">'+
                    '<span class="dateHeader">'+ itemDate +'</span>'+
                    '<ul class="newsPerDateList">'+
                        '<li id="item'+feed.items[i].date+'" class="newsItem '+newsTimeClass+' '+isNew+'" onclick="newsItemClick(\''+itemLink+'\',\''+feed.id+'\')">'+
                            '<div class="newsTimeLine"></div>'+
                            '<div class="newsTime">' + itemTime + '</div>'+
                            '<div class="newsTitle">' + feed.items[i].title + '</div>'+
                            '<div class="newsText">';
                        //var text = feed.items[i].descr;
                        var text = virtDiv.text();
                        if(text.length > 200) {
                            html += text.slice(0, 200)+'...';
                        } else {
                            html += text;
                        }
                    html += '</div>'+
                        '</li>';
            prevDate = itemDate;
        }
    }
    html += '</ul></li>';
    $('#newsList').html(html);//.scrollTop(0);
    
    setFeedAsRead(feed.id);
}

function mergeAllNews() {
    var feed = {title : 'Mix', icon : 'img/allFeeds.png', items : [], id : 'all'}
    for(var i = 0; i < allFeedsData.length; i++) {
        for(var j = 0; j < allFeedsData[i].items.length; j++) {
            feed.items.push(allFeedsData[i].items[j]);
        }
    }
    feed.items = feed.items.sort(sortNews);
    return feed;
}

function sortNews(a, b) {
if(a.date > b.date)
    return -1;
if(a.date < b.date)
    return 1;
return 0;
}

function setPriorityToItem(feedId, itemLink, priority){
    var items = localStorage['ReaderAppFeed_' + feedId] ? JSON.parse(localStorage['ReaderAppFeed_' + feedId]) : '';
    if (itemLink){
        for (var i = 0; i < items.length; i++){
            if (items[i].link == itemLink){
                items[i].isNew = priority;
            }
        }
    } else {
        for (var i = 0; i < items.length; i++){
            if (items[i].isNew != '3'){
                items[i].isNew = '2';
            }
        }
    }
    if (items){
        localStorage['ReaderAppFeed_' + feedId] = JSON.stringify(items);
    }
}

function setFeedAsRead(feedId) {
    for(var i = 0; i < allFeedsData.length; i++) {
        if(allFeedsData[i].id == feedId || feedId == 'all') {
            allFeedsData[i].isNewsInFeed = false;
        }
    }
    
    var feeds = JSON.parse(localStorage['ReaderAppStoredFeeds']);
    
    for(var i = 0; i < feeds.length; i++) {
        if(feeds[i].id == feedId || feedId == 'all') {
            feeds[i].isNewsInFeed = false;
        }
    }
    localStorage['ReaderAppStoredFeeds'] = JSON.stringify(feeds);
}

function setFocused(itemDate) {
    $('#item'+itemDate).addClass('focused');
    setTimeout(function(){
        $('#item'+itemDate).removeClass('focused');
    }, 3000);
}

function get_hostname_from_url(url) {
    return url.match(/:\/\/(.[^/]+)/)[1];
}