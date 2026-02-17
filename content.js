let FILTER_CONFIG = {
  mustInclude: ["C#", ".NET", "Angular"],  // OR; defaults
  mustExclude: [], // AND; defaults
};

// Load config from storage
async function loadConfig() {
  const result = await chrome.storage.sync.get(['filterConfig']);
  if (result.filterConfig) {
    FILTER_CONFIG = { ...FILTER_CONFIG, ...result.filterConfig };
  }
  console.log('Loaded config:', FILTER_CONFIG);
}


function getJobCards() {
  return document.querySelectorAll('[data-occludable-job-id]');
}


async function fetchJobDescription(jobId) {
  try {
    const response = await fetch(`https://www.linkedin.com/jobs/view/${jobId}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      credentials: 'omit',  // Don't send auth data to avoid the job being marked as 'viewed'
      referrerPolicy: 'no-referrer'
    });
    
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    return doc.querySelector('.description').innerText;

  }
  catch (error) {
    console.log(`Failed to fetch job description ${jobId}:`, error.message);
    return '';
  }
}

async function isRelevant(card) {
  // Filter out already viewed jobs
  const titleText = card.innerText.toLowerCase();
  if (titleText.includes('viewed'))
    return false;


  // Apply description exclusion rules
  const jobId = card.getAttribute('data-occludable-job-id');
  if (!jobId) {
    console.log('No job ID found');
    return false;
  }

  const description = await fetchJobDescription(jobId);
  
  if (FILTER_CONFIG.mustInclude.length > 0)
  {
    if (!FILTER_CONFIG.mustInclude.some(x => description.includes(x)))
      return false;
  }

  if (FILTER_CONFIG.mustExclude.length > 0)
  {
    if (FILTER_CONFIG.mustExclude.some(x => description.includes(x)))
      return false;
  }

  console.log(`Job ${jobId} passes all filters`);
  return true;
}

async function filterJobs() {
  const cards = getJobCards();
  console.log(`Found ${cards.length} job cards...`);

  const toProcess = Array.from(cards)
    .filter(card => card.getAttribute('data-filtered') !== 'true');

  const promises = toProcess.map(async (card) => {
    card.setAttribute('data-filtered', 'true');
    
    try {
      const relevant = await isRelevant(card);
      
      // Update DOM on main thread
      requestAnimationFrame(() => {
        if (relevant) {
          card.style.borderLeft = '4px solid green';
          card.style.opacity = '1';
        } else {
          card.style.borderLeft = '4px solid red';
          card.style.opacity = '0.5';
        }
      });
      
      return { card, relevant };
    } 
    catch (error) {
      console.log('Filter error:', error.message);
      return { card, relevant: false };
    }
  });
  
  await Promise.all(promises);
}

let filterTimeout;
async function throttledFilter() {
  clearTimeout(filterTimeout);
  filterTimeout = setTimeout(async () => {
    await filterJobs();
  }, 500);
}


// Listen for config updates from popup
chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
  if (message.action === 'configUpdated') {
    loadConfig().then(() => {
      // Re-process current jobs with new config
      document.querySelectorAll('[data-filtered="true"]').forEach(card => {
        card.removeAttribute('data-filtered');
        card.style.borderLeft = '';
        card.style.display = '';
        card.style.opacity = '';
      });
      filterJobs();
    });
  }
});

async function init() {
  await loadConfig();
  
  // Initial filter (make async call)
  await filterJobs().catch(console.error);
  
  window.addEventListener('scroll', throttledFilter, { passive: true });
  
  const observer = new MutationObserver(async () => {
    await throttledFilter().catch(console.error);
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  setTimeout(init, 2000);
}
