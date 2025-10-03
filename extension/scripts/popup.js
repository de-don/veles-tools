(() => {
  const button = document.getElementById('veles-open-ui');
  if (!button) {
    return;
  }

  button.addEventListener('click', () => {
    const url = chrome.runtime.getURL('ui/dist/index.html');
    chrome.tabs.create({ url });
    window.close();
  });
})();
