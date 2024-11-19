let isScrolling = false;

// 스크롤 이벤트 핸들러
function handleScroll() {
    if (!isScrolling) {
        isScrolling = true;

        const scrollData = calculateScrollData();

        // 메시지 전송 방식 수정
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

// 스크롤 위치 계산
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

// 메시지 리스너 수정
chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'scrollTo') {
        executeScroll(message.data);
    }
});

// 스크롤 실행
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