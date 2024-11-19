class ScrollManager {
    constructor() {
        this.isScrolling = false;
        this.setupScrollListener();
    }

    setupScrollListener() {
        let scrollTimeout;
        window.addEventListener('scroll', () => {
            if (!scrollTimeout) {
                scrollTimeout = setTimeout(() => {
                    this.handleScroll();
                    scrollTimeout = null;
                }, 50);
            }
        }, { passive: true });
    }

    handleScroll() {
        if (!this.isScrolling) {
            this.isScrolling = true;
            const scrollData = this.calculateScrollData();

            try {
                chrome.runtime.sendMessage({
                    action: 'scroll',
                    data: scrollData
                });
            } catch (error) {
                console.error('Scroll sync:', error);
            }

            setTimeout(() => {
                this.isScrolling = false;
            }, 50);
        }
    }

    calculateScrollData() {
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

    executeScroll(scrollData) {
        if (!this.isScrolling) {
            this.isScrolling = true;

            const targetScroll = (scrollData.percentage / 100) *
                (document.documentElement.scrollHeight - document.documentElement.clientHeight);

            window.scrollTo({
                top: targetScroll,
                behavior: 'auto'
            });

            setTimeout(() => {
                this.isScrolling = false;
            }, 50);
        }
    }
}

window.ScrollManager = ScrollManager;