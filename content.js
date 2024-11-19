class ContentScript {
    constructor() {
        this.overlay = new OverlayManager();
        this.scrollManager = new ScrollManager();
        this.initialize();
    }

    initialize() {
        // 메시지 리스너 설정
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            switch (message.action) {
                case 'scrollTo':
                    this.scrollManager.executeScroll(message.data);
                    break;
                case 'stateChanged':
                    this.overlay.updateState(message.state);
                    break;
                case 'windowClosed':
                    this.overlay.removeOverlay();
                    break;
                case 'updateOverlayVisibility':
                    if (message.show) {
                        this.overlay.createOverlay();
                    } else {
                        this.overlay.removeOverlay();
                    }
                    break;
            }
        });

        // 초기 상태 확인
        chrome.runtime.sendMessage({ action: 'getUrlSyncState' }, (response) => {
            if (response && response.showOverlay) {
                this.overlay.createOverlay();
            }
        });

        // 연결 상태 주기적 체크
        setInterval(() => {
            chrome.runtime.sendMessage({ action: 'getUrlSyncState' }, (response) => {
                if (response) {
                    this.overlay.updateSyncStatus(response.isConnected);
                }
            });
        }, 5000);
    }
}

// 스크립트 시작
new ContentScript();