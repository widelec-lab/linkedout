document.addEventListener('DOMContentLoaded', async () => {
  // Load saved config
  const config = await chrome.storage.sync.get(['filterConfig']);
  const cfg = config.filterConfig || {};
  
  document.getElementById('mustInclude').value = cfg.mustInclude?.join(', ') || '';
  document.getElementById('mustExclude').value = cfg.mustExclude?.join(', ') || '';
  
  // Save button
  document.getElementById('saveBtn').onclick = async () => {
    const mustInclude = document.getElementById('mustInclude').value
      .split(',').map(s => s.trim()).filter(Boolean);
    const mustExclude = document.getElementById('mustExclude').value
      .split(',').map(s => s.trim()).filter(Boolean);
    
    const newConfig = { mustInclude, mustExclude };
    await chrome.storage.sync.set({ filterConfig: newConfig });
    
    showStatus('Settings saved! Refresh LinkedIn jobs page.', 'success');
    
    // Notify content script to reload config
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'configUpdated' });
    });
  };
  
  // Clear button
  document.getElementById('clearBtn').onclick = async () => {
    await chrome.storage.sync.remove('filterConfig');
    document.getElementById('mustInclude').value = '';
    document.getElementById('mustExclude').value = '';
    showStatus('Filters cleared!', 'success');
  };
});

function showStatus(msg, type) {
  const status = document.getElementById('status');
  status.textContent = msg;
  status.className = type;
  setTimeout(() => status.textContent = '', 3000);
}