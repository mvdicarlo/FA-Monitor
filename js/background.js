const dateFormat = "MMM Do, YYYY HH:mm a";
const refreshTimer = 60000;

$(document).ready(function() {

function getEnabledNotificationFields() {
  return new Promise((resolve) => {
    const enabledOptions = [];

    chrome.storage.local.get(['watchers', 'comments'], (result) => {
        if (result.watchers === true) {
          enabledOptions.push('watches');
        }

        if (result.comments === true) {
            enabledOptions.push('comments-submission');
        }
    });

    resolve(enabledOptions);
  });
}

function check() {
  getEnabledNotificationFields().then(enabled => {
    checkNotifications(enabled).then(() => {});
  });
}

async function checkNotifications(enabledOptions = []) {
    const now = moment();
    const faPage = await getNotifications();

    if (!faPage.includes('Log in')) {
        const sections = getSections(enabledOptions, faPage);
        let notifications = [];

        if (enabledOptions.includes('watches')) {
            notifications = [...handleWatches($(sections).find('#messages-watches'))];
        }

        if (enabledOptions.includes('comments-submission')) {
            const comments = await handleComments($(sections).find('#messages-comments-submission'))
            notifications = [...notifications, ...comments];
        }

        const filtered = filter(notifications, now);
        showNotifications(filtered);
    }
}

async function showNotifications(notifications = []) {
    if (notifications.length === 1) {
        const n = notifications[0];
        getImgData(n.iconUrl).then(data => {
            const opts = generateNotificationFields(n);
            opts.iconUrl = data;
            chrome.notifications.create(opts, () => {});
        });
    } else if (notifications.length > 1) {
        const listOptions = {
            type: 'list',
            title: 'FA Notifications',
            message: '',
            items: [],
            iconUrl: await getImgData(notifications[0].iconUrl)
        };

        for (var i = 0; i < notifications.length; i++) {
            const n = notifications[i]
            const opts = generateNotificationFields(n);
            delete opts.type;

            listOptions.items.push(opts);
        }

        chrome.notifications.create('fa-notifications', listOptions, () => {});
    }
}

function generateNotificationFields(notification) {
    const n = {
        type: 'basic',
        title: '',
        message: ''
    };

    if (notification.type === 'watch') {
        n.title = `New watcher: ${notification.username}`
    } else if (notification.type === 'comment') {
        n.message = notification.msg;
        n.title = `New comment`;
    }

    return n;
}

function getImgData(url) {
    return new Promise((resolve) => {
        if (!url) resolve(null);

        $.ajax({
            url,
            cache: false,
            xhr() { // Seems like the only way to get access to the xhr object
                var xhr = new XMLHttpRequest();
                xhr.responseType = 'blob'
                return xhr;
            },
            success(data) {
                var url = window.URL || window.webkitURL;
                resolve(url.createObjectURL(data));
            },
            error() {
                resolve('');
            }
        });
    });
}

function getNotifications() {
    return new Promise((resolve) => {
        $.get('https://www.furaffinity.net/msg/others')
            .done((res) => {
                resolve(res);
            }).fail(err => {
                resolve('')
            });
    });
}

function getSections(sections = [], page = '') {
    const cut = page.match(/\<form id="messages-form" method="post" action="\/msg\/others\/">(\s|.)*?<\/form\>/g)[0];
    const html = $.parseHTML(cut);
    return $(html).find('section');
}

function handleWatches(section) {
    if (!section) return [];

    const list = [];
    const li = $(section.find('li'));

    for (var i = 0; i < li.length; i++) {
        const el = $(li[i]);

        const obj = {
            type: 'watch'
        };
        const children = el.find('.info')[0].children;
        obj.username = children[0].innerText
        obj.posted = moment(children[1].firstChild.title, dateFormat);
        obj.iconUrl = el.find('img')[0].src.replace('chrome-extension', 'http');

        list.push(obj);
    }

    return list;
}

async function handleComments(section) {
    if (!section) return [];

    const list = [];
    const li = $(section.find('li'));

    for (var i = 0; i < li.length; i++) {
        const el = $(li[i]);

        if (el.text().includes('deleted')) continue;

        const obj = {
            type: 'comment',
            username: $($(el).find('a')[0]).text(),
            posted: moment($(el).find('span').attr('title').replace('on ', ''), dateFormat),
            msg: $(el).text(),
            commentUrl: 'www.furaffinity.net' + $($(el).find('a')[1]).attr('href'),
            iconUrl: await getUserIconLink($($(el).find('a')[0]).attr('href'))
        };

        list.push(obj);
    }

    return list;
}

function getUserIconLink(pageLink) {
    return new Promise((resolve) => {
        $.get(`http://www.furaffinity.net${pageLink}`).done(page => {
            const html = $.parseHTML(page);
            resolve('http://' + $(html).find('.user-nav-avatar').attr('src'));
        });
    });
}

function filter(notifications, now) {
    const list = [];

    notifications.forEach((n) => {
        if (n.posted && n.posted.isValid()) {
            if (now.diff(n.posted, 'seconds') <= (refreshTimer / 1000) + 5) {
                list.push(n);
            }
        }
    });

    return list;
}

chrome.notifications.onClicked.addListener((id) => {
    chrome.tabs.create({
        url: 'https://www.furaffinity.net/msg/others'
    });
});

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
        removeWatchSection('watches');
    }

    if (result.comments === false) {
        $('#comments').attr('checked', false);
        removeWatchSection('comments-submission');
    }
});

check();

setInterval(check, refreshTimer);

});
