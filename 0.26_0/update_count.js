var str = document.documentElement.innerHTML;

var addresses = str.match(/[\s>&"][13][1-9A-HJ-NP-Za-km-z]{26,33}[\s<&"]/g);

chrome.browserAction.setBadgeText({text: "a" + addresses.length }); // We have 10+ unread items.