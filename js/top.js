var feedsPage = 1;
var foundFeeds = [];
function init() {
    addListeners();
    getStoredFeeds();
}

function addListeners() {
    chrome.tabs.getCurrent(function(tab){
        foundFeeds = JSON.parse(localStorage['RSSfeedsFromPage'+tab.id]);
        localStorage.removeItem('RSSfeedsFromPage'+tab.id);
        showFeeds(foundFeeds);
    });
    /*chrome.extension.onRequest.addListener(function(request, sender) {
        if (request.msg == "ReaderAppInfobarFeeds") {
            console.log(request.feeds);
            foundFeeds = request.feeds;
            showFeeds(request.feeds);
        }
    });*/
}

function initEvents() {
    $('#rightArr').click(function(){
        var num = $('#tableWrapper').find('.group').size();
        if(feedsPage < num) {
            feedsPage++;
            
            $('#leftArr').css('visibility', 'visible');
            
            $('#tableWrapper').stop().animate({left:'-=500px'},1000,'easeInOutBack');
        } else {
            $(this).css('visibility', 'hidden');
        }
        
        if(feedsPage == num) {
            $(this).css('visibility', 'hidden');
        }
    });

    $('#leftArr').click(function(){
        if(feedsPage > 1) {
            feedsPage--;
            
            $('#rightArr').css('visibility', 'visible');
            
            $('#tableWrapper').stop().animate({left:'+=500px'},1000,'easeInOutBack');
            
            if(feedsPage == 1) {
                $(this).css('visibility', 'hidden');
            }
        } 
    });
    
    $('.groupItem:not(.added)').mouseenter(function(){
        var followButt = $(this).find('.followIt').first();
        followButt.fadeIn();
        //alert(followButt);
    }).mouseleave(function(){
        var followButt = $(this).find('.followIt').first();
        followButt.fadeOut();
    });
    
    $('.followIt').click(function(){
        $(this).parent().unbind('mouseenter').addClass('added');
        $(this).fadeOut(function(){
            
        });
        var i = parseInt($(this).attr('rel'));
        foundFeeds[i].id = new Date().getTime();
        chrome.extension.sendRequest({msg: "ReaderAppNewFeed", feed: foundFeeds[i]});
        if($('.groupItem').size() == $('.added').size()) {
            setTimeout('window.close()', 1000);
        }
        //chrome.extension.sendRequest({msg: "showPopUp", feed: foundFeeds[i]});
    });
}

function getStoredFeeds() {
    var feeds = localStorage['ReaderAppStoredFeeds'] || [];
    if(feeds.length > 0) {
        feeds = JSON.parse(feeds);
    }
    return feeds;
}

function isAdded(feed, stored) {
    for (var i = 0; i < stored.length; i++) {
        if(stored[i].href == feed.href) return true;
    }
    return false;
}

function showFeeds(feeds) {
    var stored = getStoredFeeds();
    if(feeds.length > 4) {
        $('#rightArr').css('visibility', 'visible');
    }
    var count = 0;
    var html = ' <div class="group">';
    for(var i = 0; i < feeds.length; i++) {
        var addClass = (isAdded(feeds[i], stored))? 'added' : '';
        
        if(feeds[i].title.length > 0) {
            var title = feeds[i].title;
        } else {
            var title = feeds[i].href;
        }
        
        if(count < 4) {
            html += '<div class="groupItem '+addClass+'" title="'+title+'">'+
                        '<div class="itemCont">'+
                        '<div class="itemContIn">'+
                        '<img width="16" height="16" align="left" class="icon" src="'+config.icoConvertURL+feeds[i].icon+'">'+
                            title+
                        '</div>'+
                        '<div class="v"></div>'+
                        '</div>'+
                        '<div class="followIt" rel="'+i+'">Follow it!</div>'+
                    '</div>';
                        
            count++;
        } else {
            html += '</div><div class="group"><div class="groupItem '+addClass+'" title="'+title+'">'+
                        '<div class="itemCont">'+
                        '<div class="itemContIn">'+
                        '<img width="16" height="16" align="left" class="icon" src="'+config.icoConvertURL+feeds[i].icon+'">'+
                            title+
                        '</div>'+
                        '<div class="v"></div>'+
                        '</div>'+
                        '<div class="followIt" rel="'+i+'">Follow it!</div>'+
                        '</div>';
            count = 0;
        }
    }
    html += '</div>';
    
    //console.log(html);
    $('#tableWrapper').html(html);
    $('.itemContIn').ellipsis();
    initEvents();
}