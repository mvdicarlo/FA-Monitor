$('#watchers').click((e) => {
    chrome.storage.local.set({
        watchers: e.target.checked
    });

    if (e.target.checked) addWatchSection('watches');
    else removeWatchSection('watches');
});

$('#comments').click((e) => {
    chrome.storage.local.set({
        comments: e.target.checked
    });

    if (e.target.checked) addWatchSection('comments-submission');
    else removeWatchSection('comments-submission');
});

chrome.storage.local.get(['watchers', 'comments'], (result) => {
    if (result.watchers === false) {
        $('#watchers').attr('checked', false);
    }

    if (result.comments === false) {
        $('#comments').attr('checked', false);
    }
});
