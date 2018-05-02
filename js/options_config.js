$(document).ready(function() {

    $('#watchers').click((e) => {
        chrome.storage.local.set({
            watchers: e.target.checked
        });
    });

    $('#comments').click((e) => {
        chrome.storage.local.set({
            comments: e.target.checked
        });
    });

    $('#shouts').click((e) => {
        chrome.storage.local.set({
            shouts: e.target.checked
        });
    });

    $('#favorites').click((e) => {
        chrome.storage.local.set({
            favorites: e.target.checked
        });
    });

    $('#appEnabled').click((e) => {
        chrome.storage.local.get(['appEnabled'], (result) => {
            chrome.storage.local.set({ appEnabled: !result.appEnabled});
            showAppEnabledState(!result.appEnabled);
        });

    });

    chrome.storage.local.get(['watchers', 'comments', 'shouts', 'favorites', 'appEnabled'], (result) => {

        showAppEnabledState(result.appEnabled);

        if (result.watchers === false) {
            $('#watchers').attr('checked', false);
        }

        if (result.comments === false) {
            $('#comments').attr('checked', false);
        }

        if (result.shouts === false) {
            $('#shouts').attr('checked', false);
        }

        if (result.favorites === false) {
            $('#favorites').attr('checked', false);
        }
    });

    function showAppEnabledState(enabled) {
        if(!enabled) {
            $('#appEnabled').removeClass('btn-danger');
            $('#appEnabled').addClass('btn-success');
            $('#appEnabled').text('Enable Notifications');
        } else {
            $('#appEnabled').removeClass('btn-success');
            $('#appEnabled').addClass('btn-danger');
            $('#appEnabled').text('Disable Notifications');
        }
    }

});
