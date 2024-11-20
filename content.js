class ContentScript {
    constructor() {
        this.overlayManager = null;
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
                    if (this.overlayManager) {
                        this.overlayManager.updateState(message.state);
                    }
                    break;
                case 'windowClosed':
                    this.removeOverlay();
                    break;
                case 'updateOverlayVisibility':
                    if (message.show) {
                        this.createOrShowOverlay();
                    } else {
                        this.removeOverlay();
                    }
                    break;
            }
        });

        // 초기 상태 확인 및 설정
        this.checkInitialState();

        // 연결 상태 주기적 체크
        this.startStatusCheck();
    }

    async checkInitialState() {
        try {
            const response = await this.sendMessage({ action: 'getUrlSyncState' });
            if (response && response.showOverlay) {
                this.createOrShowOverlay();
            }
        } catch (error) {
            console.error('Initial state check failed:', error);
        }
    }

    createOrShowOverlay() {
        if (!this.overlayManager) {
            this.overlayManager = new OverlayManager();
            this.overlayManager.createOverlay();
        } else if (this.overlayManager.overlay) {
            this.overlayManager.showOverlay();
        }
    }

    removeOverlay() {
        if (this.overlayManager) {
            this.overlayManager.removeOverlay();
            this.overlayManager = null;
        }
    }

    startStatusCheck() {
        setInterval(() => {
            if (this.overlayManager) {
                this.sendMessage({ action: 'getUrlSyncState' })
                    .then(response => {
                        if (response) {
                            this.overlayManager.updateSyncStatus(response.isConnected);
                        }
                    })
                    .catch(error => console.error('Status check failed:', error));
            }
        }, 5000);
    }

    sendMessage(message) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(message, response => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(response);
                }
            });
        });
    }
}

// 스크립트 시작
new ContentScript();