document.addEventListener('DOMContentLoaded', () => {
    // 현재 동기화 상태 로드
    chrome.runtime.sendMessage({ action: 'getUrlSyncState' }, (response) => {
        if (response) {
            document.getElementById('urlSyncToggle').checked = response.urlSyncEnabled;
            document.getElementById('scrollSyncToggle').checked = response.scrollSyncEnabled;
        }
    });

    // URL 동기화 토글
    document.getElementById('urlSyncToggle').addEventListener('change', (e) => {
        chrome.runtime.sendMessage({
            action: 'toggleUrlSync',
            enabled: e.target.checked
        });
    });

    // 스크롤 동기화 토글
    document.getElementById('scrollSyncToggle').addEventListener('change', (e) => {
        chrome.runtime.sendMessage({
            action: 'toggleScrollSync',
            enabled: e.target.checked
        });
    });

    // Split Window 버튼
    document.getElementById('splitButton').addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.runtime.sendMessage({
                    action: 'createSplitWindows',
                    url: tabs[0].url
                });
            }
        });
    });
});