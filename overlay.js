class OverlayManager {
    constructor() {
        this.overlay = null;
        this.toggleButton = null;
    }

    createOverlay() {
        this.createOverlayElement();
        this.createToggleButton();
        this.setupListeners();
    }

    createOverlayElement() {
        this.overlay = document.createElement('div');
        this.overlay.id = 'sync-overlay';
        this.overlay.innerHTML = `
            <div class="sync-controls">
                <div class="header">
                    <span class="title">Sync Control</span>
                    <div class="header-buttons">
                        <button id="toggleOverlay" class="icon-button">━</button>
                        <button id="closeSync" class="icon-button">×</button>
                    </div>
                </div>
                <div class="toggle-container">
                    <label class="switch">
                        <input type="checkbox" id="urlSyncToggle">
                        <span class="slider"></span>
                    </label>
                    <span>URL Sync</span>
                </div>
                <div class="toggle-container">
                    <label class="switch">
                        <input type="checkbox" id="scrollSyncToggle">
                        <span class="slider"></span>
                    </label>
                    <span>Scroll Sync</span>
                </div>
                <div class="sync-status">
                    <span id="syncStatusDot"></span>
                    <span id="syncStatusText">Connected</span>
                </div>
            </div>
        `;
        document.body.appendChild(this.overlay);
    }

    createToggleButton() {
        this.toggleButton = document.createElement('div');
        this.toggleButton.id = 'sync-toggle-button';
        this.toggleButton.innerHTML = `
            <button id="showOverlay">≡</button>
        `;
        document.body.appendChild(this.toggleButton);
    }

    setupListeners() {
        const urlSyncToggle = document.getElementById('urlSyncToggle');
        const scrollSyncToggle = document.getElementById('scrollSyncToggle');
        const toggleOverlay = document.getElementById('toggleOverlay');
        const closeSync = document.getElementById('closeSync');
        const showOverlay = document.getElementById('showOverlay');

        // 초기 상태 로드
        chrome.runtime.sendMessage({ action: 'getUrlSyncState' }, (response) => {
            if (response) {
                urlSyncToggle.checked = response.urlSyncEnabled;
                scrollSyncToggle.checked = response.scrollSyncEnabled;
                this.updateSyncStatus(response.isConnected);
            }
        });

        urlSyncToggle.addEventListener('change', (e) => {
            this.handleSyncToggle('toggleUrlSync', e.target);
        });

        scrollSyncToggle.addEventListener('change', (e) => {
            this.handleSyncToggle('toggleScrollSync', e.target);
        });

        toggleOverlay.addEventListener('click', () => this.hideOverlay());
        showOverlay.addEventListener('click', () => this.showOverlay());

        closeSync.addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: 'closeSyncConnection' }, () => {
                this.removeOverlay();
            });
        });

        // 저장된 오버레이 상태 로드
        chrome.storage.local.get(['overlayHidden'], (result) => {
            if (result.overlayHidden) {
                this.hideOverlay();
            }
        });
    }

    handleSyncToggle(action, target) {
        const isEnabled = target.checked;
        chrome.runtime.sendMessage({
            action: action,
            enabled: isEnabled
        }, (response) => {
            if (!response?.success) {
                target.checked = !isEnabled;
                console.error(`Failed to toggle ${action}`);
            }
        });
    }

    hideOverlay() {
        this.overlay.classList.add('hidden');
        this.toggleButton.classList.add('visible');
        chrome.storage.local.set({ overlayHidden: true });
    }

    showOverlay() {
        this.overlay.classList.remove('hidden');
        this.toggleButton.classList.remove('visible');
        chrome.storage.local.set({ overlayHidden: false });
    }

    updateSyncStatus(isConnected) {
        const statusDot = document.getElementById('syncStatusDot');
        const statusText = document.getElementById('syncStatusText');

        if (statusDot && statusText) {
            if (isConnected) {
                statusDot.classList.remove('disconnected');
                statusText.textContent = 'Connected';
            } else {
                statusDot.classList.add('disconnected');
                statusText.textContent = 'Disconnected';
            }
        }
    }

    updateState(state) {
        const urlSyncToggle = document.getElementById('urlSyncToggle');
        const scrollSyncToggle = document.getElementById('scrollSyncToggle');

        if (urlSyncToggle && state.urlSyncEnabled !== undefined) {
            urlSyncToggle.checked = state.urlSyncEnabled;
        }
        if (scrollSyncToggle && state.scrollSyncEnabled !== undefined) {
            scrollSyncToggle.checked = state.scrollSyncEnabled;
        }
    }

    removeOverlay() {
        if (this.overlay) {
            this.overlay.remove();
        }
        if (this.toggleButton) {
            this.toggleButton.remove();
        }
    }
}

window.OverlayManager = OverlayManager;