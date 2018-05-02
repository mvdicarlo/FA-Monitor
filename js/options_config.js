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

    chrome.storage.local.get(['watchers', 'comments', 'shouts'], (result) => {
        if (result.watchers === false) {
            $('#watchers').attr('checked', false);
        }

        if (result.comments === false) {
            $('#comments').attr('checked', false);
        }

        if (result.shouts === false) {
            $('#shouts').attr('checked', false);
        }
    });

});
