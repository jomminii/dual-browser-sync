const windowState = {
    pairs: new Map(),
    urlSyncEnabled: true,
    scrollSyncEnabled: true
};

// 스토리지에서 설정 로드
chrome.storage.local.get(['urlSyncEnabled', 'scrollSyncEnabled'], (result) => {
    if (result.urlSyncEnabled !== undefined) {
        windowState.urlSyncEnabled = result.urlSyncEnabled;
    }
    if (result.scrollSyncEnabled !== undefined) {
        windowState.scrollSyncEnabled = result.scrollSyncEnabled;
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
        if (message.action === 'createSplitWindows') {
            createSplitWindows(message.url);
            sendResponse({ success: true });
        }
        else if (message.action === 'scroll' && windowState.scrollSyncEnabled) {
            synchronizeScroll(message.data, sender.tab.windowId);
            sendResponse({ success: true });
        }
        else if (message.action === 'toggleUrlSync') {
            toggleUrlSync(message.enabled);
            broadcastState();
            sendResponse({ success: true });
        }
        else if (message.action === 'toggleScrollSync') {
            toggleScrollSync(message.enabled);
            broadcastState();
            sendResponse({ success: true });
        }
        else if (message.action === 'getUrlSyncState' || message.action === 'getScrollSyncState') {
            const windowId = sender.tab?.windowId;
            sendResponse({
                urlSyncEnabled: windowState.urlSyncEnabled,
                scrollSyncEnabled: windowState.scrollSyncEnabled,
                isConnected: windowId ? windowState.pairs.has(windowId) : false
            });
        }
        else if (message.action === 'closeSyncConnection') {
            closeSyncConnection(sender.tab.windowId);
            sendResponse({ success: true });
        }
    } catch (error) {
        console.log('Background script:', error);
        sendResponse({ success: false, error: error.message });
    }
    return true;
});

function toggleUrlSync(enabled) {
    windowState.urlSyncEnabled = enabled;
    chrome.storage.local.set({ urlSyncEnabled: enabled });
}

function toggleScrollSync(enabled) {
    windowState.scrollSyncEnabled = enabled;
    chrome.storage.local.set({ scrollSyncEnabled: enabled });
}

async function broadcastState() {
    try {
        const tabs = await chrome.tabs.query({});
        for (const tab of tabs) {
            try {
                await chrome.tabs.sendMessage(tab.id, {
                    action: 'stateChanged',
                    state: {
                        urlSyncEnabled: windowState.urlSyncEnabled,
                        scrollSyncEnabled: windowState.scrollSyncEnabled
                    }
                });
            } catch (err) {
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

function closeSyncConnection(windowId) {
    if (windowState.pairs.has(windowId)) {
        const pairedWindowId = windowState.pairs.get(windowId);

        // 양쪽 창 모두에 창 닫힘 메시지 전송
        notifyWindowClosed(windowId);
        notifyWindowClosed(pairedWindowId);

        // 연결 상태 제거
        windowState.pairs.delete(pairedWindowId);
        windowState.pairs.delete(windowId);
    }
}

async function notifyWindowClosed(windowId) {
    try {
        const tabs = await chrome.tabs.query({ windowId });
        for (const tab of tabs) {
            try {
                await chrome.tabs.sendMessage(tab.id, { action: 'windowClosed' });
            } catch (err) {
                console.log('Failed to send window closed message:', err);
            }
        }
    } catch (error) {
        console.log('Notify window closed error:', error);
    }
}

chrome.windows.onRemoved.addListener((windowId) => {
    if (windowState.pairs.has(windowId)) {
        closeSyncConnection(windowId);
    }
});

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