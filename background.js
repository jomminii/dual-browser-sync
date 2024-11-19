const windowState = {
    pairs: new Map(),
    urlSyncEnabled: true
};

// 스토리지에서 설정 로드
chrome.storage.local.get(['urlSyncEnabled'], (result) => {
    if (result.urlSyncEnabled !== undefined) {
        windowState.urlSyncEnabled = result.urlSyncEnabled;
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
        if (message.action === 'createSplitWindows') {
            createSplitWindows(message.url, message.urlSync);
            sendResponse({ success: true });
        }
        else if (message.action === 'scroll') {
            synchronizeScroll(message.data, sender.tab.windowId);
            sendResponse({ success: true });
        }
        else if (message.action === 'toggleUrlSync') {
            toggleUrlSync(message.enabled);
            // 모든 탭에 상태 변경 알림
            broadcastUrlSyncState(message.enabled);
            sendResponse({ success: true });
        }
        else if (message.action === 'getUrlSyncState') {
            sendResponse({ urlSyncEnabled: windowState.urlSyncEnabled });
        }
        else if (message.action === 'checkConnection') {
            const windowId = sender.tab?.windowId;
            const isConnected = windowId ? windowState.pairs.has(windowId) : false;
            sendResponse({
                isConnected,
                urlSyncEnabled: windowState.urlSyncEnabled
            });
        }
    } catch (error) {
        console.log('Background script:', error);
        sendResponse({ success: false, error: error.message });
    }
    return true;
});

// URL 동기화 상태 변경 함수
function toggleUrlSync(enabled) {
    windowState.urlSyncEnabled = enabled;
    chrome.storage.local.set({ urlSyncEnabled: enabled });
}

// 모든 탭에 상태 변경을 알리는 함수
async function broadcastUrlSyncState(enabled) {
    try {
        const tabs = await chrome.tabs.query({});
        for (const tab of tabs) {
            try {
                await chrome.tabs.sendMessage(tab.id, {
                    action: 'urlSyncStateChanged',
                    enabled: enabled
                });
            } catch (err) {
                // 일부 탭에서 오류가 발생해도 계속 진행
                console.log('Failed to send message to tab:', tab.id, err);
            }
        }
    } catch (error) {
        console.log('Broadcasting error:', error);
    }
}

async function createSplitWindows(url) {
    try {
        const currentWindow = await chrome.windows.getCurrent();
        const width = Math.floor(currentWindow.width / 2);

        const leftWindow = await chrome.windows.create({
            url: url,
            width: width,
            height: currentWindow.height,
            left: currentWindow.left,
            top: currentWindow.top,
            focused: true,
            type: 'normal'
        });

        const rightWindow = await chrome.windows.create({
            url: url,
            width: width,
            height: currentWindow.height,
            left: currentWindow.left + width,
            top: currentWindow.top,
            focused: false,
            type: 'normal'
        });

        windowState.pairs.set(leftWindow.id, rightWindow.id);
        windowState.pairs.set(rightWindow.id, leftWindow.id);

    } catch (error) {
        console.log('Window creation:', error);
    }
}

async function synchronizeScroll(scrollData, sourceWindowId) {
    try {
        const targetWindowId = windowState.pairs.get(sourceWindowId);
        if (!targetWindowId) return;

        const tabs = await chrome.tabs.query({ windowId: targetWindowId, active: true });
        if (tabs.length === 0) return;

        chrome.tabs.sendMessage(tabs[0].id, {
            action: 'scrollTo',
            data: scrollData
        });
    } catch (error) {
        console.log('Scroll sync:', error);
    }
}

// 창이 닫힐 때 정리
chrome.windows.onRemoved.addListener((windowId) => {
    if (windowState.pairs.has(windowId)) {
        const pairedWindowId = windowState.pairs.get(windowId);
        windowState.pairs.delete(pairedWindowId);
        windowState.pairs.delete(windowId);
    }
});

// URL 변경 감지 및 동기화
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.url && windowState.urlSyncEnabled) {
        const windowId = tab.windowId;
        const pairedWindowId = windowState.pairs.get(windowId);

        if (pairedWindowId) {
            try {
                const tabs = await chrome.tabs.query({ windowId: pairedWindowId, active: true });
                if (tabs.length > 0) {
                    await chrome.tabs.update(tabs[0].id, { url: changeInfo.url });
                }
            } catch (error) {
                console.log('URL sync:', error);
            }
        }
    }
});