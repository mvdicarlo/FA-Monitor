$(document).ready(function() {

    function loadStats() {
        chrome.storage.local.get(['stats', 'online', 'loggedIn'], (results) => {
            results.loggedIn === true ? $('#login_error').hide() : $('#login_error').show();
            results.online === true ? $('#connection_error').hide() : $('#connection_error').show();

            if (results.stats) {
                const stats = results.stats;
                $('#submission_count').text(stats.submissions || 0);
                $('#comment_count').text(stats.comments || 0);
                $('#journal_count').text(stats.journals || 0);
                $('#watch_count').text(stats.watches || 0);
                $('#favorite_count').text(stats.favorites || 0);
                $('#message_count').text(status.notes || 0);
            }
        });
    }

    //Inits
    loadStats();
    setInterval(loadStats, 45000);
});
