document.addEventListener('DOMContentLoaded', () => {
    // 현재 URL 동기화 상태 로드
    chrome.runtime.sendMessage({ action: 'getUrlSyncState' }, (response) => {
        if (response && response.urlSyncEnabled !== undefined) {
            document.getElementById('urlSyncToggle').checked = response.urlSyncEnabled;
        }
    });
});

document.getElementById('urlSyncToggle').addEventListener('change', (e) => {
    chrome.runtime.sendMessage({
        action: 'toggleUrlSync',
        enabled: e.target.checked
    }, (response) => {
        if (!response || !response.success) {
            console.error('Failed to toggle URL sync');
        }
    });
});

document.getElementById('splitButton').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            const urlSyncEnabled = document.getElementById('urlSyncToggle').checked;

            chrome.runtime.sendMessage({
                action: 'createSplitWindows',
                url: tabs[0].url,
                urlSync: urlSyncEnabled
            }, (response) => {
                if (!response || !response.success) {
                    console.error('Failed to create split windows');
                }
            });
        }
    });
});