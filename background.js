// WindowManager 클래스 정의
class WindowManager {
    constructor() {
        this.pairs = new Map();
        this.activeWindows = new Set();

        // 이벤트 리스너 바인딩
        this.handleWindowRemoved = this.handleWindowRemoved.bind(this);
        this.handleUrlChange = this.handleUrlChange.bind(this);
        this.synchronizeScroll = this.synchronizeScroll.bind(this);
        this.isPaired = this.isPaired.bind(this);

        // 이벤트 리스너 등록
        chrome.windows.onRemoved.addListener(this.handleWindowRemoved);
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.url && syncManager.isUrlSyncEnabled()) {
                this.handleUrlChange(tab.windowId, changeInfo.url);
            }
        });
    }

    async createSplitWindows(url) {
        try {
            // 현재 창의 정보를 가져옴
            const currentWindow = await chrome.windows.getCurrent();

            // 모든 디스플레이 정보를 가져옴
            const displays = await chrome.system.display.getInfo();

            // 현재 창의 위치를 기반으로 현재 모니터 찾기
            const currentDisplay = this.getCurrentDisplay(displays, currentWindow);

            if (!currentDisplay) {
                console.error('현재 디스플레이를 찾을 수 없습니다.');
                return;
            }

            const workArea = currentDisplay.workArea;
            const width = Math.floor(workArea.width / 2);

            // 현재 창을 왼쪽으로 이동 및 크기 조정
            await chrome.windows.update(currentWindow.id, {
                left: workArea.left,
                top: workArea.top,
                width: width,
                height: workArea.height,
                state: 'normal'
            });

            // 새 창을 오른쪽에 생성
            const rightWindow = await chrome.windows.create({
                url: url,
                width: width,
                height: workArea.height,
                left: workArea.left + width,
                top: workArea.top,
                focused: true,
                type: 'normal'
            });

            // 활성화된 윈도우 추가
            this.activeWindows.add(currentWindow.id);
            this.activeWindows.add(rightWindow.id);

            this.pairs.set(currentWindow.id, rightWindow.id);
            this.pairs.set(rightWindow.id, currentWindow.id);

            // 활성화된 윈도우들에 overlay 표시 메시지 전송
            this.notifyOverlayStatus(currentWindow.id, true);
            this.notifyOverlayStatus(rightWindow.id, true);

        } catch (error) {
            console.error('Window creation error:', error);
        }
    }

    // 현재 창이 위치한 디스플레이를 찾는 메서드
    getCurrentDisplay(displays, currentWindow) {
        // 현재 창의 중심점 계산
        const windowCenterX = currentWindow.left + (currentWindow.width / 2);
        const windowCenterY = currentWindow.top + (currentWindow.height / 2);

        // 창의 중심점이 포함된 디스플레이를 찾음
        return displays.find(display => {
            const bounds = display.bounds;
            return windowCenterX >= bounds.left &&
                   windowCenterX <= bounds.left + bounds.width &&
                   windowCenterY >= bounds.top &&
                   windowCenterY <= bounds.top + bounds.height;
        }) || displays[0]; // 찾지 못한 경우 기본 디스플레이 반환
    }

    async notifyOverlayStatus(windowId, show) {
        try {
            const tabs = await chrome.tabs.query({ windowId });
            for (const tab of tabs) {
                await chrome.tabs.sendMessage(tab.id, {
                    action: 'updateOverlayVisibility',
                    show: show
                }).catch(() => {});
            }
        } catch (error) {
            console.error('Overlay notification error:', error);
        }
    }

    synchronizeScroll = async (scrollData, sourceWindowId) => {
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

    isPaired = (windowId) => {
        return this.pairs.has(windowId);
    }

    isActiveWindow = (windowId) => {
        return this.activeWindows.has(windowId);
    }

    getPairedWindowId = (windowId) => {
        return this.pairs.get(windowId);
    }

    handleUrlChange = async (windowId, newUrl) => {
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
            // 활성화된 윈도우에서 제거
            this.activeWindows.delete(windowId);
            this.activeWindows.delete(pairedWindowId);
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

    handleWindowRemoved = (windowId) => {
        this.closeSyncConnection(windowId);
    }
}
// 메시지 리스너 수정
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
        switch (message.action) {
            case 'getUrlSyncState':
                const windowId = sender.tab?.windowId;
                sendResponse({
                    urlSyncEnabled: syncManager.isUrlSyncEnabled(),
                    scrollSyncEnabled: syncManager.isScrollSyncEnabled(),
                    isConnected: windowId ? windowManager.isPaired(windowId) : false,
                    // 오버레이 표시 여부 추가
                    showOverlay: windowId ? windowManager.isActiveWindow(windowId) : false
                });
                break;
            // ... 나머지 case문들은 그대로 유지
        }
        sendResponse({ success: true });
    } catch (error) {
        console.error('Background script error:', error);
        sendResponse({ success: false, error: error.message });
    }
    return true;
});

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
                    isConnected: windowId ? windowManager.isPaired(windowId) : false,
                    showOverlay: windowId ? windowManager.isActiveWindow(windowId) : false
                });
                return true;
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