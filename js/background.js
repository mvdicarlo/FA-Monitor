const dateFormat = "MMM Do, YYYY HH:mm a";
const refreshTimer = 45000;
const defaultUrl = 'https://www.furaffinity.net';

const NOTIFICATION_TYPES = {
    COMMENTS: 'comments-submission',
    FAVORITES: 'favorites',
    JOURNALS: 'journals',
    PMS: 'pms',
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
                    journals: true,
                    comments: true,
                    favorites: true,
                    shouts: true,
                    pms: true,
                    online: false,
                    loggedIn: false,
                    stats: {},
                    appEnabled: true,
                    usingBetaLayout: false
                });
            }

            callback();
        });
    }

    function getEnabledNotificationFields() {
        return new Promise((resolve) => {
            const enabledOptions = [];

            chrome.storage.local.get(['watchers', 'comments', 'shouts', 'favorites', 'journals', 'pms', 'appEnabled'], (result) => {
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

                if (result.journals === true) {
                    enabledOptions.push(NOTIFICATION_TYPES.JOURNALS);
                }

                if (result.pms === true) {
                    enabledOptions.push(NOTIFICATION_TYPES.PMS);
                }

                resolve(result.appEnabled ? enabledOptions : []);
            });
        });
    }

    function check() {
        getEnabledNotificationFields().then(enabled => {
            checkNotifications(enabled);
        });

        // Clear old notifications
        chrome.notifications.getAll((notifications) => {
          const now = moment();
          Object.keys(notifications).forEach((notification) => {
            try {
              const n = JSON.parse(notification);
              if (!n.eventTime || now.diff(moment(n.eventTime), 'minutes') >= 2) {
                chrome.notifications.clear(notification);
              }
            } catch (e) {
              chrome.notifications.clear(notification);
            }
          });
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

                    if (faPage.includes('loggedin_user_avatar')) {
                        chrome.storage.local.set({
                            usingBetaLayout: true
                        });
                    } else {
                        chrome.storage.local.set({
                            usingBetaLayout: false
                        });
                    }

                    if (faPage.includes('You currently do not have any notifications.') || !faPage.includes('messages-form')) {
                      return;
                    }

                    const sections = getSections(enabledOptions, faPage);
                    let notifications = [];

                    if (enabledOptions.includes(NOTIFICATION_TYPES.WATCHERS)) {
                        handleWatches($(sections).find('#messages-watches'))
                            .then((watches) => {
                                showNotifications(filter(watches, now));
                            });
                    }

                    if (enabledOptions.includes(NOTIFICATION_TYPES.PMS)) {
                        $.get(`${defaultUrl}/msg/pms/`).done((notePage) => {
                            handlePersonalMessages($($.parseHTML(notePage)).find('.message-center-pms-note-list-view'))
                                .then((pms) => {
                                    showNotifications(filter(pms, now));
                                });
                        })
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

                    if (enabledOptions.includes(NOTIFICATION_TYPES.JOURNALS)) {
                        handleJournals($(sections).find('#messages-journals'))
                            .then((journals) => {
                                showNotifications(filter(journals, now));
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
        for (var i = 0; i < notifications.length; i++) {
            const n = notifications[i];

            let url = '';
            if (n.type === NOTIFICATION_TYPES.WATCHERS) {
              url = `http:${n.iconUrl}`;
            } else {
              url = await getUserIconLink(n.iconUrl);
            }

            getImgData(url).then(data => {
                const opts = generateNotificationFields(n);
                opts.iconUrl = data;
                n.eventTime = Date.now();
                chrome.notifications.create(JSON.stringify(n), opts, (id) => {
                    notificationsMap.set(id, n);
                });
            });
        }
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
            n.message = `${notification.username} has watched you`;
        } else if (notification.type === NOTIFICATION_TYPES.COMMENTS) {
            n.title = 'New Comment';
            n.message = `You have received a comment from ${notification.username} on "${notification.submissionName}"`;
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
            n.message = `You have received a favorite from ${notification.username} on "${notification.submissionName}"`;
            n.buttons.push({
                title: 'View user'
            });
        } else if (notification.type === NOTIFICATION_TYPES.JOURNALS) {
            n.title = 'New Journal';
            n.message = `${notification.username} has posted a new journal "${notification.journalName}"`;
            n.buttons.push({
                title: 'View journal'
            });
        } else if (notification.type === NOTIFICATION_TYPES.PMS) {
            n.title = 'New Personal Message';
            n.message = `New message from ${notification.username} (${notification.noteName})`;
            n.buttons.push({
                title: 'View note'
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
            submissions: $(stats$).text().match(/\d+S/),
            comments: $(stats$).text().match(/\d+C/),
            journals: $(stats$).text().match(/\d+J/),
            favorites: $(stats$).text().match(/\d+F/),
            watches: $(stats$).text().match(/\d+W/),
            pms: $(stats$).text().match(/\d+N/)
        }

        chrome.storage.local.set({
            stats
        });
    }

    async function handlePersonalMessages(sections) {
        if (!sections) return [];

        const list = [];
        const div = sections;

        for (var i = 0; i < div.length; i++) {
            const el = div[i];

            const obj = {
                type: NOTIFICATION_TYPES.PMS,
                noteUrl: $($(el).find('a')[0]).attr('href'),
                noteName: $($(el).find('a')[0]).text().trim(),
                username: $($(el).find('a')[1]).text().trim(),
                iconUrl: $($(el).find('a')[1]).attr('href'),
                posted: moment($(el).find('.popup_date').attr('title'), dateFormat)
            };

            list.push(obj);
        }

        return list;
    }

    async function handleWatches(section) {
        if (!section) return [];

        const list = [];
        const li = $(section.find('li'));

        for (var i = 0; i < li.length; i++) {
            const el = $(li[i]);

            const obj = {
                type: NOTIFICATION_TYPES.WATCHERS
            };

            const children = el.find('.info')[0].children;
            obj.username = children[0].innerText
            obj.posted = moment(children[1].firstChild.title, dateFormat);
            obj.iconUrl = $(el.find('img')[0]).attr('src');

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
                iconUrl: $($(el).find('a')[0]).attr('href')
            };

            list.push(obj);
        }

        return list;
    }

    async function handleJournals(section) {
        if (!section) return [];

        const list = [];
        const li = $(section.find('li'));

        for (var i = 0; i < li.length; i++) {
            const el = $(li[i]);

            if (el.text().includes('deleted') || el.text().includes('removed')) continue;

            const obj = {
                type: NOTIFICATION_TYPES.JOURNALS,
                username: $($(el).find('a')[1]).text(),
                posted: moment($(el).find('span').attr('title').replace('on ', ''), dateFormat),
                journalName: $($(el).find('a')[0]).text(),
                journalUrl: $($(el).find('a')[0]).attr('href'),
                iconUrl: $($(el).find('a')[1]).attr('href')
            };

            list.push(obj);
        }

        return list;
    }

    function getUserIconLink(pageLink) {
        return new Promise((resolve) => {
            $.get(`${defaultUrl}${pageLink}`).done(page => {
                const html = $.parseHTML(page);
                let link = '';
                if ($(html).find('.user-nav-avatar').length > 0) {
                    link = $(html).find('.user-nav-avatar').attr('src')
                } else {
                    link = $(html).find('.avatar').attr('src');
                }
                resolve('http:' + link);
            });
        });
    }

    function filter(notifications, now) {
        const list = [];

        notifications.forEach((n) => {
            if (n.posted && n.posted.isValid()) {
                if (now.diff(n.posted, 'minutes') < 1) {
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
                url = `${defaultUrl}${notification.commentUrl}`;
            } else if (notification.type === NOTIFICATION_TYPES.JOURNALS) {
                url = `${defaultUrl}${notification.journalUrl}`;
            } else if (notification.type === NOTIFICATION_TYPES.PMS) {
                url = `${defaultUrl}${notification.noteUrl}`;
            }

            chrome.tabs.create({
                url
            });
        }
    });

    chrome.notifications.onClosed.addListener((id, byUser) => {
        notificationsMap.delete(id);
    });

    initialize(() => {
        check();
        setInterval(check, refreshTimer);
    });
});
