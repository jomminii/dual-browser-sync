// WindowManager 클래스 정의
class WindowManager {
    constructor() {
        this.pairs = new Map();
    }

    async createSplitWindows(url) {
        try {
            const currentWindow = await chrome.windows.getCurrent();
            const displays = await chrome.system.display.getInfo();
            const display = displays[0];  // 주 디스플레이 사용

            const workArea = display.workArea;
            const width = Math.floor(workArea.width / 2);

            await chrome.windows.update(currentWindow.id, {
                left: workArea.left,
                top: workArea.top,
                width: width,
                height: workArea.height,
                state: 'normal'
            });

            const rightWindow = await chrome.windows.create({
                url: url,
                width: width,
                height: workArea.height,
                left: workArea.left + width,
                top: workArea.top,
                focused: true,
                type: 'normal'
            });

            this.pairs.set(currentWindow.id, rightWindow.id);
            this.pairs.set(rightWindow.id, currentWindow.id);

        } catch (error) {
            console.error('Window creation error:', error);
        }
    }

    async synchronizeScroll(scrollData, sourceWindowId) {
        try {
            const targetWindowId = this.pairs.get(sourceWindowId);
            if (!targetWindowId) return;

            const tabs = await chrome.tabs.query({ windowId: targetWindowId, active: true });
            if (tabs.length === 0) return;

            await chrome.tabs.sendMessage(tabs[0].id, {
                action: 'scrollTo',
                data: scrollData
            });
        } catch (error) {
            console.error('Scroll sync error:', error);
        }
    }

    isPaired(windowId) {
        return this.pairs.has(windowId);
    }

    getPairedWindowId(windowId) {
        return this.pairs.get(windowId);
    }

    async handleUrlChange(windowId, newUrl) {
        const pairedWindowId = this.pairs.get(windowId);
        if (!pairedWindowId) return;

        try {
            const tabs = await chrome.tabs.query({ windowId: pairedWindowId, active: true });
            if (tabs.length > 0) {
                await chrome.tabs.update(tabs[0].id, { url: newUrl });
            }
        } catch (error) {
            console.error('URL sync error:', error);
        }
    }

    closeSyncConnection(windowId) {
        if (this.pairs.has(windowId)) {
            const pairedWindowId = this.pairs.get(windowId);
            this.notifyWindowClosed(windowId);
            this.notifyWindowClosed(pairedWindowId);
            this.pairs.delete(pairedWindowId);
            this.pairs.delete(windowId);
        }
    }

    async notifyWindowClosed(windowId) {
        try {
            const tabs = await chrome.tabs.query({ windowId });
            for (const tab of tabs) {
                await chrome.tabs.sendMessage(tab.id, {
                    action: 'windowClosed'
                }).catch(() => {});
            }
        } catch (error) {
            console.error('Window closed notification error:', error);
        }
    }

    handleWindowRemoved(windowId) {
        this.closeSyncConnection(windowId);
    }
}

// SyncManager 클래스 정의
class SyncManager {
    constructor() {
        this.urlSyncEnabled = true;
        this.scrollSyncEnabled = true;
        this.loadState();
    }

    async loadState() {
        const result = await chrome.storage.local.get([
            'urlSyncEnabled',
            'scrollSyncEnabled'
        ]);

        if (result.urlSyncEnabled !== undefined) {
            this.urlSyncEnabled = result.urlSyncEnabled;
        }
        if (result.scrollSyncEnabled !== undefined) {
            this.scrollSyncEnabled = result.scrollSyncEnabled;
        }
    }

    async toggleUrlSync(enabled) {
        this.urlSyncEnabled = enabled;
        await chrome.storage.local.set({ urlSyncEnabled: enabled });
        await this.broadcastState();
    }

    async toggleScrollSync(enabled) {
        this.scrollSyncEnabled = enabled;
        await chrome.storage.local.set({ scrollSyncEnabled: enabled });
        await this.broadcastState();
    }

    isUrlSyncEnabled() {
        return this.urlSyncEnabled;
    }

    isScrollSyncEnabled() {
        return this.scrollSyncEnabled;
    }

    async broadcastState() {
        try {
            const tabs = await chrome.tabs.query({});
            const state = {
                urlSyncEnabled: this.urlSyncEnabled,
                scrollSyncEnabled: this.scrollSyncEnabled
            };

            for (const tab of tabs) {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'stateChanged',
                    state: state
                }).catch(() => {});
            }
        } catch (error) {
            console.error('Broadcasting error:', error);
        }
    }
}

// 인스턴스 생성
const windowManager = new WindowManager();
const syncManager = new SyncManager();

// 메시지 리스너
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
        switch (message.action) {
            case 'createSplitWindows':
                windowManager.createSplitWindows(message.url);
                break;
            case 'scroll':
                if (syncManager.isScrollSyncEnabled()) {
                    windowManager.synchronizeScroll(message.data, sender.tab.windowId);
                }
                break;
            case 'toggleUrlSync':
                syncManager.toggleUrlSync(message.enabled);
                break;
            case 'toggleScrollSync':
                syncManager.toggleScrollSync(message.enabled);
                break;
            case 'getUrlSyncState':
                const windowId = sender.tab?.windowId;
                sendResponse({
                    urlSyncEnabled: syncManager.isUrlSyncEnabled(),
                    scrollSyncEnabled: syncManager.isScrollSyncEnabled(),
                    isConnected: windowId ? windowManager.isPaired(windowId) : false
                });
                break;
            case 'closeSyncConnection':
                windowManager.closeSyncConnection(sender.tab.windowId);
                break;
        }
        sendResponse({ success: true });
    } catch (error) {
        console.error('Background script error:', error);
        sendResponse({ success: false, error: error.message });
    }
    return true;
});

// 이벤트 리스너
chrome.windows.onRemoved.addListener((windowId) => {
    windowManager.handleWindowRemoved(windowId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url && syncManager.isUrlSyncEnabled()) {
        windowManager.handleUrlChange(tab.windowId, changeInfo.url);
    }
});