const dateFormat = "MMM Do, YYYY HH:mm a";
const refreshTimer = 45000;
const defaultUrl = 'https://www.furaffinity.net';

const NOTIFICATION_TYPES = {
    COMMENTS: 'comments-submission',
    FAVORITES: 'favorites',
    SHOUTS: 'shouts',
    WATCHERS: 'watches',
};

$(document).ready(function() {

    const notificationsMap = new Map();

    function initialize(callback) {
        chrome.storage.local.get(['initialized'], (result) => {
            if (result.initialized !== true) {
                chrome.storage.local.set({
                    initialized: true,
                    watchers: true,
                    comments: true,
                    favorites: true,
                    shouts: true,
                    online: false,
                    loggedIn: false,
                    stats: {}
                });
            }

            callback();
        });
    }

    function getEnabledNotificationFields() {
        return new Promise((resolve) => {
            const enabledOptions = [];

            chrome.storage.local.get(['watchers', 'comments', 'shouts', 'favorites'], (result) => {
                if (result.watchers === true) {
                    enabledOptions.push(NOTIFICATION_TYPES.WATCHERS);
                }

                if (result.comments === true) {
                    enabledOptions.push(NOTIFICATION_TYPES.COMMENTS);
                }

                if (result.shouts === true) {
                    enabledOptions.push(NOTIFICATION_TYPES.SHOUTS);
                }

                if (result.favorites === true) {
                    enabledOptions.push(NOTIFICATION_TYPES.FAVORITES);
                }
            });

            resolve(enabledOptions);
        });
    }

    function check() {
        getEnabledNotificationFields().then(enabled => {
            checkNotifications(enabled);
        });
    }

    function checkNotifications(enabledOptions = []) {
        const now = moment();
        getNotifications()
            .then((faPage) => {
                chrome.storage.local.set({
                    online: true
                });

                if (!faPage.includes('Log in')) {
                    updateStats(faPage);
                    chrome.storage.local.set({
                        loggedIn: true
                    });

                    const sections = getSections(enabledOptions, faPage);
                    let notifications = [];

                    if (enabledOptions.includes(NOTIFICATION_TYPES.WATCHERS)) {
                        handleWatches($(sections).find('#messages-watches'))
                            .then((watches) => {
                                showNotifications(filter(watches, now));
                            });
                    }

                    if (enabledOptions.includes(NOTIFICATION_TYPES.COMMENTS)) {
                        handleComments($(sections).find('#messages-comments-submission'), NOTIFICATION_TYPES.COMMENTS)
                            .then((comments) => {
                                showNotifications(filter(comments, now));
                            });
                    }

                    if (enabledOptions.includes(NOTIFICATION_TYPES.SHOUTS)) {
                        handleComments($(sections).find('#messages-shouts'), NOTIFICATION_TYPES.SHOUTS)
                            .then((shouts) => {
                                showNotifications(filter(shouts, now));
                            });
                    }

                    if (enabledOptions.includes(NOTIFICATION_TYPES.FAVORITES)) {
                        handleComments($(sections).find('#messages-favorites'), NOTIFICATION_TYPES.FAVORITES)
                            .then((favorites) => {
                                showNotifications(filter(favorites, now));
                            });
                    }
                } else {
                    chrome.storage.local.set({
                        loggedIn: false,
                        stats: {},
                    });
                }
            })
            .catch(() => {
                chrome.storage.local.set({
                    online: false,
                    loggedIn: false,
                    stats: {}
                });
            });
    }

    async function showNotifications(notifications = []) {
        notifications.forEach((n) => {
            getImgData(n.iconUrl).then(data => {
                const opts = generateNotificationFields(n);
                opts.iconUrl = data;
                chrome.notifications.create(opts, (id) => {
                    notificationsMap.set(id, n);
                });
            });
        });
    }

    function generateNotificationFields(notification) {
        const n = {
            type: 'basic',
            title: '',
            message: '',
            buttons: [{
                title: 'View all notifications'
            }]
        };

        if (notification.type === NOTIFICATION_TYPES.WATCHERS) {
            n.title = 'New Watcher'
            n.msg = `${notification.username} has watched you`;
        } else if (notification.type === NOTIFICATION_TYPES.COMMENTS) {
            n.title = 'New Comment';
            n.message = `You have received a comment from ${notification.username} on ${notification.submissionName}`;
            n.buttons.push({
                title: 'View comment'
            });
        } else if (notification.type === NOTIFICATION_TYPES.SHOUTS) {
            n.title = 'New Shout';
            n.message = `You have received a new shout from ${notification.username}`;
            n.buttons.push({
                title: 'View user'
            });
        } else if (notification.type === NOTIFICATION_TYPES.FAVORITES) {
            n.title = 'New Favorite';
            n.message = `You have received a favorite from ${notification.username} on ${notification.submissionName}`;
            n.buttons.push({
                title: 'View user'
            });
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
        return new Promise((resolve, reject) => {
            $.get(`${defaultUrl}/msg/others`)
                .done((res) => {
                    resolve(res);
                }).fail(err => {
                    reject(err)
                });
        });
    }

    function getSections(sections = [], page = '') {
        const cut = page.match(/\<form id="messages-form" method="post" action="\/msg\/others\/">(\s|.)*?<\/form\>/g)[0];
        const html = $.parseHTML(cut);
        return $(html).find('section');
    }

    function updateStats(page) {
        if (!page) {
            chrome.storage.local.set({
                stats: {}
            });
            return;
        }

        const stats$ = $($.parseHTML(page)).find('.message-bar-desktop').children();

        const stats = {
            submissions: $(stats$[0]).text(),
            comments: $(stats$[1]).text(),
            journals: $(stats$[2]).text(),
            favorites: $(stats$[3]).text(),
            watches: $(stats$[4]).text(),
            notes: stats$.length > 4 ? $(stats$[5]).text() : ''
        }

        chrome.storage.local.set({
            stats
        });
    }

    async function handleWatches(section) {
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

    async function handleComments(section, type) {
        if (!section) return [];

        const list = [];
        const li = $(section.find('li'));

        for (var i = 0; i < li.length; i++) {
            const el = $(li[i]);

            if (el.text().includes('deleted') || el.text().includes('removed')) continue;

            const obj = {
                type,
                username: $($(el).find('a')[0]).text(),
                posted: moment($(el).find('span').attr('title').replace('on ', ''), dateFormat),
                msg: $(el).text(),
                userUrl: $($(el).find('a')[0]).attr('href'),
                commentUrl: $($(el).find('a')[1]).attr('href'),
                submissionName: $($(el).find('a')[1]).text(),
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
                resolve('http:' + $(html).find('.user-nav-avatar').attr('src'));
            });
        });
    }

    function filter(notifications, now) {
        const list = [];

        notifications.forEach((n) => {
            if (n.posted && n.posted.isValid()) {
                if (now.diff(n.posted, 'seconds') <= (refreshTimer / 1000) + 10000000) {
                    list.push(n);
                }
            }
        });

        return list;
    }

    chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
        if (buttonIndex === 0) {
            chrome.tabs.create({
                url: `${defaultUrl}/msg/others`
            });
        } else {
            const notification = notificationsMap.get(notificationId);
            let url = `${defaultUrl}/msg/others`;

            if (notification.type === NOTIFICATION_TYPES.SHOUTS || notification.type === NOTIFICATION_TYPES.FAVORITES) {
                url = `${defaultUrl}${notification.userUrl}`;
            } else if (notification.type === NOTIFICATION_TYPES.COMMENTS) {
                url = `${defaultUrl}${commentUrl}`;
            }

            chrome.tabs.create({
                url
            });
        }

        console.log(notificationObj, buttonIndex);
    });

    chrome.notifications.onClosed.addListener((id, byUser) => {
        notificationsMap.delete(id);
    });

    initialize(() => {
        check();
        setInterval(check, refreshTimer);
    });
});
