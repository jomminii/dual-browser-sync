class OverlayManager {
    constructor() {
        this.overlay = null;
        this.toggleButton = null;
        this.isConnected = false;
        this.currentUrl = window.location.href;
        this.dragState = {
            isDragging: false,
            startX: 0,
            startY: 0,
            elementX: 0,
            elementY: 0,
            element: null
        };
    }

    createOverlay() {
        this.createOverlayElement();
        this.createToggleButton();
        this.setupListeners();
        this.setupDragListeners();
        this.loadElementPositions();
    }

    getMessage(messageKey) {
        return chrome.i18n.getMessage(messageKey) || messageKey;
    }

    createOverlayElement() {
        this.overlay = document.createElement('div');
        this.overlay.id = 'sync-overlay';
        
        // 초기 위치 설정
        this.overlay.style.right = '20px';
        this.overlay.style.top = '20px';
        
        this.overlay.innerHTML = `
            <div class="sync-controls">
                <div class="header">
                    <span class="title">${this.getMessage('syncControl')}</span>
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
                    <span>${this.getMessage('urlSync')}</span>
                </div>
                <div class="toggle-container">
                    <label class="switch">
                        <input type="checkbox" id="scrollSyncToggle">
                        <span class="slider"></span>
                    </label>
                    <span>${this.getMessage('scrollSync')}</span>
                </div>
                <div class="sync-status-container">
                    <div class="sync-status">
                        <span id="syncStatusDot"></span>
                        <span id="syncStatusText">${this.getMessage('connected')}</span>
                    </div>
                    <button id="reconnectButton" class="reconnect-button hidden">
                        ${this.getMessage('reconnect')}
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(this.overlay);
    }

    createToggleButton() {
        this.toggleButton = document.createElement('div');
        this.toggleButton.id = 'sync-toggle-button';
        
        // 초기 위치 설정
        this.toggleButton.style.right = '20px';
        this.toggleButton.style.top = '20px';
        
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
        const reconnectButton = document.getElementById('reconnectButton');

        // 초기 상태 로드
        chrome.runtime.sendMessage({ action: 'getUrlSyncState' }, (response) => {
            if (response) {
                urlSyncToggle.checked = response.urlSyncEnabled;
                scrollSyncToggle.checked = response.scrollSyncEnabled;
                this.updateSyncStatus(response.isConnected);
                this.isConnected = response.isConnected;
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
        reconnectButton.addEventListener('click', () => this.handleReconnect());

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

    setupDragListeners() {
        const handleDragStart = (e, element) => {
            // 버튼이나 입력 요소 클릭 시 드래그 방지
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || 
                e.target.tagName === 'LABEL' || e.target.closest('.switch')) {
                return;
            }
            
            const rect = element.getBoundingClientRect();
            
            this.dragState = {
                isDragging: true,
                startX: e.clientX,
                startY: e.clientY,
                initialLeft: rect.left,
                initialTop: rect.top,
                element: element
            };
            
            element.classList.add('dragging');
        };
    
        const handleDragMove = (e) => {
            if (!this.dragState.isDragging) return;
    
            e.preventDefault();
            
            const dx = e.clientX - this.dragState.startX;
            const dy = e.clientY - this.dragState.startY;
            
            const newLeft = this.dragState.initialLeft + dx;
            const newTop = this.dragState.initialTop + dy;
            
            // 화면 경계 체크
            const element = this.dragState.element;
            const rect = element.getBoundingClientRect();
            const maxX = window.innerWidth - rect.width;
            const maxY = window.innerHeight - rect.height;
            
            // 위치 제한
            const boundedLeft = Math.max(0, Math.min(maxX, newLeft));
            const boundedTop = Math.max(0, Math.min(maxY, newTop));
            
            // 위치 업데이트
            element.style.left = `${boundedLeft}px`;
            element.style.top = `${boundedTop}px`;
        };
    
        const handleDragEnd = () => {
            if (!this.dragState.isDragging) return;
            
            this.dragState.element.classList.remove('dragging');
            
            // 현재 위치 저장
            const positions = {
                overlayPosition: {
                    left: this.overlay ? this.overlay.style.left : null,
                    top: this.overlay ? this.overlay.style.top : null
                },
                togglePosition: {
                    left: this.toggleButton ? this.toggleButton.style.left : null,
                    top: this.toggleButton ? this.toggleButton.style.top : null
                }
            };
            
            chrome.storage.local.set({ elementPositions: positions });
            
            this.dragState = {
                isDragging: false,
                startX: 0,
                startY: 0,
                initialLeft: 0,
                initialTop: 0,
                element: null
            };
        };
    
        // 이벤트 리스너 설정
        [this.overlay, this.toggleButton].forEach(element => {
            if (element) {
                element.addEventListener('mousedown', e => handleDragStart(e, element));
            }
        });
        
        document.addEventListener('mousemove', handleDragMove);
        document.addEventListener('mouseup', handleDragEnd);
    }
    async loadElementPositions() {
        try {
            const result = await chrome.storage.local.get('elementPositions');
            const positions = result.elementPositions;
            
            if (positions) {
                if (positions.overlayPosition && this.overlay) {
                    this.overlay.style.left = positions.overlayPosition.left;
                    this.overlay.style.top = positions.overlayPosition.top;
                }
                
                if (positions.togglePosition && this.toggleButton) {
                    this.toggleButton.style.left = positions.togglePosition.left;
                    this.toggleButton.style.top = positions.togglePosition.top;
                }
            }
        } catch (error) {
            console.error('Failed to load element positions:', error);
        }
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

    async handleReconnect() {
        try {
            // 재연결 버튼 비활성화
            const reconnectButton = document.getElementById('reconnectButton');
            if (reconnectButton) {
                reconnectButton.disabled = true;
                reconnectButton.textContent = '연결 중...';
            }

            await chrome.runtime.sendMessage({
                action: 'createSplitWindows',
                url: this.currentUrl
            });

            // 상태 업데이트는 background에서 오는 메시지를 통해 처리됨
        } catch (error) {
            console.error('Reconnection failed:', error);
            // 재연결 실패 시 버튼 상태 복구
            if (reconnectButton) {
                reconnectButton.disabled = false;
                reconnectButton.textContent = '재연결';
            }
        }
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
        const reconnectButton = document.getElementById('reconnectButton');

        if (statusDot && statusText && reconnectButton) {
            this.isConnected = isConnected;

            if (isConnected) {
                statusDot.classList.remove('disconnected');
                statusText.textContent = this.getMessage('connected');
                reconnectButton.classList.add('hidden');
            } else {
                statusDot.classList.add('disconnected');
                statusText.textContent = this.getMessage('disconnected');
                reconnectButton.classList.remove('hidden');
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
            this.overlay = null;
        }
        if (this.toggleButton) {
            this.toggleButton.remove();
            this.toggleButton = null;
        }
    }
}

window.OverlayManager = OverlayManager;