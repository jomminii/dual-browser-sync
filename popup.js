document.getElementById('splitButton').addEventListener('click', async () => {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            chrome.runtime.sendMessage({
                action: 'createSplitWindows',
                url: tab.url
            });
        }
    } catch (error) {
        console.error('Error in popup:', error);
    }
});