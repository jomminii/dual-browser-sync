let isScrolling = false;

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

let scrollTimeout;
window.addEventListener('scroll', () => {
    if (!scrollTimeout) {
        scrollTimeout = setTimeout(() => {
            handleScroll();
            scrollTimeout = null;
        }, 50);
    }
}, { passive: true });

chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'scrollTo') {
        executeScroll(message.data);
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