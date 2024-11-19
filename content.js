let isScrolling = false;

function createOverlay() {
    // 메인 오버레이 생성
    const overlay = document.createElement('div');
    overlay.id = 'sync-overlay';
    overlay.innerHTML = `
        <div class="sync-controls">
            <div class="header">
                <span class="title">Sync Control</span>
                <button id="toggleOverlay">━</button>
            </div>
            <div class="toggle-container">
                <label class="switch">
                    <input type="checkbox" id="urlSyncToggle">
                    <span class="slider"></span>
                </label>
                <span>URL Sync</span>
            </div>
            <div class="sync-status">
                <span id="syncStatusDot"></span>
                <span id="syncStatusText">Connected</span>
            </div>
        </div>
    `;

    // 토글 버튼 오버레이 생성
    const toggleButton = document.createElement('div');
    toggleButton.id = 'sync-toggle-button';
    toggleButton.innerHTML = `
        <button id="showOverlay">≡</button>
    `;

    // 스타일 추가
    const style = document.createElement('style');
    style.textContent = `
        #sync-overlay {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            background: #2c3e50;
            color: #ecf0f1;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            transition: transform 0.3s ease;
            min-width: 200px;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 1px solid #34495e;
        }

        .title {
            font-weight: 600;
            font-size: 14px;
            color: #fff;
        }

        #sync-overlay.hidden {
            transform: translateX(150%);
        }

        .sync-controls {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .toggle-container {
            display: flex;
            align-items: center;
            gap: 12px;
            color: #fff;
            font-size: 14px;
        }

        .switch {
            position: relative;
            display: inline-block;
            width: 44px;
            height: 24px;
        }

        .switch input {
            opacity: 0;
            width: 0;
            height: 0;
        }

        .slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: #475669;
            transition: .4s;
            border-radius: 24px;
        }

        .slider:before {
            position: absolute;
            content: "";
            height: 18px;
            width: 18px;
            left: 3px;
            bottom: 3px;
            background-color: white;
            transition: .4s;
            border-radius: 50%;
        }

        input:checked + .slider {
            background-color: #3498db;
        }

        input:checked + .slider:before {
            transform: translateX(20px);
        }

        .sync-status {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            color: #bdc3c7;
        }

        #syncStatusDot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background-color: #2ecc71;
        }

        #syncStatusDot.disconnected {
            background-color: #e74c3c;
        }

        #toggleOverlay, #showOverlay {
            border: none;
            background: transparent;
            color: #bdc3c7;
            padding: 4px 8px;
            cursor: pointer;
            font-size: 16px;
            transition: color 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        #toggleOverlay:hover, #showOverlay:hover {
            color: #fff;
        }

        /* 항상 표시되는 토글 버튼 스타일 */
        #sync-toggle-button {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: none;
        }

        #sync-toggle-button.visible {
            opacity: 1;
            pointer-events: auto;
        }

        #showOverlay {
            background: #2c3e50;
            padding: 8px 12px;
            border-radius: 4px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
            font-size: 18px;
        }
    `;

    document.head.appendChild(style);
    document.body.appendChild(overlay);
    document.body.appendChild(toggleButton);

    setupOverlayListeners();
}

function setupOverlayListeners() {
    const urlSyncToggle = document.getElementById('urlSyncToggle');
    const toggleOverlay = document.getElementById('toggleOverlay');
    const showOverlay = document.getElementById('showOverlay');
    const overlay = document.getElementById('sync-overlay');
    const toggleButton = document.getElementById('sync-toggle-button');

    // URL 동기화 상태 로드
    chrome.runtime.sendMessage({ action: 'getUrlSyncState' }, (response) => {
        if (response && response.urlSyncEnabled !== undefined) {
            urlSyncToggle.checked = response.urlSyncEnabled;
            updateSyncStatus(response.urlSyncEnabled);
        }
    });

    // URL 동기화 토글 이벤트
    urlSyncToggle.addEventListener('change', (e) => {
        const isEnabled = e.target.checked;
        chrome.runtime.sendMessage({
            action: 'toggleUrlSync',
            enabled: isEnabled
        }, (response) => {
            if (response && response.success) {
                updateSyncStatus(isEnabled);
            } else {
                e.target.checked = !isEnabled;
                updateSyncStatus(!isEnabled);
                console.error('Failed to toggle URL sync');
            }
        });
    });

    // 오버레이 숨기기
    toggleOverlay.addEventListener('click', () => {
        overlay.classList.add('hidden');
        toggleButton.classList.add('visible');
        chrome.storage.local.set({ overlayHidden: true });
    });

    // 오버레이 보이기
    showOverlay.addEventListener('click', () => {
        overlay.classList.remove('hidden');
        toggleButton.classList.remove('visible');
        chrome.storage.local.set({ overlayHidden: false });
    });

    // 저장된 오버레이 상태 로드
    chrome.storage.local.get(['overlayHidden'], (result) => {
        if (result.overlayHidden) {
            overlay.classList.add('hidden');
            toggleButton.classList.add('visible');
        }
    });
}

function updateSyncStatus(isConnected) {
    const statusDot = document.getElementById('syncStatusDot');
    const statusText = document.getElementById('syncStatusText');

    if (isConnected) {
        statusDot.classList.remove('disconnected');
        statusText.textContent = 'Connected';
    } else {
        statusDot.classList.add('disconnected');
        statusText.textContent = 'Disconnected';
    }
}

// 스크롤 이벤트 핸들러
function handleScroll() {
    if (!isScrolling) {
        isScrolling = true;

        const scrollData = calculateScrollData();

        try {
            chrome.runtime.sendMessage({
                action: 'scroll',
                data: scrollData
            });
        } catch (error) {
            console.log('Scroll sync:', error);
        }

        setTimeout(() => {
            isScrolling = false;
        }, 50);
    }
}

function calculateScrollData() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = document.documentElement.clientHeight;

    return {
        scrollTop,
        scrollHeight,
        clientHeight,
        percentage: (scrollTop / (scrollHeight - clientHeight)) * 100
    };
}

// 스크롤 이벤트 리스너 (쓰로틀링 적용)
let scrollTimeout;
window.addEventListener('scroll', () => {
    if (!scrollTimeout) {
        scrollTimeout = setTimeout(() => {
            handleScroll();
            scrollTimeout = null;
        }, 50);
    }
}, { passive: true });

// 메시지 리스너
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'scrollTo') {
        executeScroll(message.data);
    }
    else if (message.action === 'urlSyncStateChanged') {
        // URL 동기화 상태가 변경되었을 때 UI 업데이트
        const urlSyncToggle = document.getElementById('urlSyncToggle');
        if (urlSyncToggle) {
            urlSyncToggle.checked = message.enabled;
            updateSyncStatus(message.enabled);
        }
    }
});

function executeScroll(scrollData) {
    if (!isScrolling) {
        isScrolling = true;

        const targetScroll = (scrollData.percentage / 100) *
            (document.documentElement.scrollHeight - document.documentElement.clientHeight);

        window.scrollTo({
            top: targetScroll,
            behavior: 'auto'
        });

        setTimeout(() => {
            isScrolling = false;
        }, 50);
    }
}

// 페이지 로드 시 오버레이 생성
createOverlay();

// 연결 상태 주기적 체크
setInterval(() => {
    chrome.runtime.sendMessage({ action: 'checkConnection' }, (response) => {
        if (response) {
            updateSyncStatus(response.isConnected);
        }
    });
}, 5000);