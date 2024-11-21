class ScrollManager {
    constructor() {
        this.isScrolling = false;
        this.lastScrollTop = 0;
        this.scrollEndTimeout = null;
        this.setupScrollListener();
    }

    setupScrollListener() {
        let scrollTimeout;

        window.addEventListener('scroll', () => {
            // 자동 스크롤 중이면 이벤트 무시
            if (this.isScrolling) {
                return;
            }

            // 이전 타임아웃 취소
            if (scrollTimeout) {
                clearTimeout(scrollTimeout);
            }

            // 새로운 스크롤 타임아웃 설정
            scrollTimeout = setTimeout(() => {
                this.handleScroll();
                scrollTimeout = null;
            }, 50);

        }, { passive: true });

        // 스크롤 종료 감지를 위한 이벤트
        window.addEventListener('scrollend', () => {
            if (this.scrollEndTimeout) {
                clearTimeout(this.scrollEndTimeout);
            }

            this.scrollEndTimeout = setTimeout(() => {
                this.isScrolling = false;
            }, 150);
        }, { passive: true });
    }

    handleScroll() {
        if (!this.isScrolling) {
            const scrollData = this.calculateScrollData();

            // 스크롤 방향 확인
            const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const isScrollingUp = currentScrollTop < this.lastScrollTop;
            this.lastScrollTop = currentScrollTop;

            // 스크롤 데이터에 방향 정보 추가
            scrollData.isScrollingUp = isScrollingUp;

            try {
                chrome.runtime.sendMessage({
                    action: 'scroll',
                    data: scrollData
                });
            } catch (error) {
                console.error('Scroll sync:', error);
            }
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
        if (this.isScrolling) {
            return;
        }

        this.isScrolling = true;

        const targetScroll = (scrollData.percentage / 100) *
            (document.documentElement.scrollHeight - document.documentElement.clientHeight);

        // smooth 스크롤 동작 제거하고 즉시 이동으로 변경
        window.scrollTo({
            top: targetScroll,
            behavior: 'instant'
        });

        // 스크롤 완료 후 상태 초기화
        if (this.scrollEndTimeout) {
            clearTimeout(this.scrollEndTimeout);
        }

        this.scrollEndTimeout = setTimeout(() => {
            this.isScrolling = false;
        }, 150);
    }
}

window.ScrollManager = ScrollManager;