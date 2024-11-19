// 창 관리를 위한 상태 객체
const windowState = {
    pairs: new Map()
};

// 메시지 리스너 수정
chrome.runtime.onMessage.addListener((message, sender) => {
    try {
        if (message.action === 'createSplitWindows') {
            createSplitWindows(message.url);
        }
        else if (message.action === 'scroll') {
            synchronizeScroll(message.data, sender.tab.windowId);
        }
    } catch (error) {
        console.log('Background script:', error);
    }
});

// 분할 창 생성
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

// 스크롤 동기화 수정
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

// 탭 업데이트 감지
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.url) {
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