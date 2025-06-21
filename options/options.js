// PomPom options.js — версия 1.13

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get([
    'prompt1', 'prompt2', 'prompt3',
    'prompt1Title', 'prompt2Title', 'prompt3Title',
    'apiKey', 'minTypingDelay', 'maxTypingDelay',
    'aimlapi_model',
    'api_provider',
    'openrouter_apiKey',
    'openrouter_model'], (result) => {
    if (result.prompt1Title) document.getElementById('prompt1Title').value = result.prompt1Title;
    if (result.prompt2Title) document.getElementById('prompt2Title').value = result.prompt2Title;
    if (result.prompt3Title) document.getElementById('prompt3Title').value = result.prompt3Title;
    if (result.prompt1) document.getElementById('prompt1').value = result.prompt1;
    if (result.prompt2) document.getElementById('prompt2').value = result.prompt2;
    if (result.prompt3) document.getElementById('prompt3').value = result.prompt3;
    if (result.apiKey) document.getElementById('apiKey').value = result.apiKey;
    if (result.minTypingDelay !== undefined) document.getElementById('minTypingDelay').value = result.minTypingDelay;
    if (result.maxTypingDelay !== undefined) document.getElementById('maxTypingDelay').value = result.maxTypingDelay;
    if (result.aimlapi_model) document.getElementById('aimlapi_model').value = result.aimlapi_model;
    if (result.api_provider) document.getElementById('api_provider').value = result.api_provider;
    if (result.openrouter_apiKey) document.getElementById('openrouter_apiKey').value = result.openrouter_apiKey;
    if (result.openrouter_model) document.getElementById('openrouter_model').value = result.openrouter_model;
  });

  setupApiKeyToggle();

  const sidebarCards = document.querySelectorAll('.sidebar-card');
  const tabContents = document.querySelectorAll('.tab-content');
  function activateSection(section) {
    sidebarCards.forEach(card => {
      card.classList.toggle('active', card.getAttribute('data-section') === section);
    });
    tabContents.forEach(tc => {
      tc.classList.toggle('active', tc.id === 'tab-' + section);
    });
  }
  sidebarCards.forEach(card => {
    card.addEventListener('click', function() {
      const section = this.getAttribute('data-section');
      activateSection(section);
    });
  });
  activateSection('general');
});


function setupApiKeyToggle() {
  const apiKeyInput = document.getElementById('apiKey');
  const toggleBtn = document.getElementById('togglePassword');
  if (apiKeyInput && toggleBtn) {
    toggleBtn.addEventListener('click', function() {
      if (apiKeyInput.type === 'password') {
        apiKeyInput.type = 'text';
        toggleBtn.setAttribute('aria-label', 'Скрыть API ключ');
      } else {
        apiKeyInput.type = 'password';
        toggleBtn.setAttribute('aria-label', 'Показать API ключ');
      }
    });
  }
  const openrouterApiKeyInput = document.getElementById('openrouter_apiKey');
  const toggleOpenRouterBtn = document.getElementById('toggleOpenRouterPassword');
  if (openrouterApiKeyInput && toggleOpenRouterBtn) {
    toggleOpenRouterBtn.addEventListener('click', function() {
      if (openrouterApiKeyInput.type === 'password') {
        openrouterApiKeyInput.type = 'text';
        toggleOpenRouterBtn.setAttribute('aria-label', 'Скрыть API ключ');
      } else {
        openrouterApiKeyInput.type = 'password';
        toggleOpenRouterBtn.setAttribute('aria-label', 'Показать API ключ');
      }
    });
  }
}

document.getElementById('saveButton').addEventListener('click', () => {
  const prompt1Title = document.getElementById('prompt1Title').value;
  const prompt2Title = document.getElementById('prompt2Title').value;
  const prompt3Title = document.getElementById('prompt3Title').value;
  const prompt1 = document.getElementById('prompt1').value;
  const prompt2 = document.getElementById('prompt2').value;
  const prompt3 = document.getElementById('prompt3').value;
  const apiKey = document.getElementById('apiKey').value;
  const minTypingDelay = parseInt(document.getElementById('minTypingDelay').value, 10);
  const maxTypingDelay = parseInt(document.getElementById('maxTypingDelay').value, 10);
  const aimlapi_model = document.getElementById('aimlapi_model').value;
  const api_provider = document.getElementById('api_provider').value;
  const openrouter_apiKey = document.getElementById('openrouter_apiKey').value;
  const openrouter_model = document.getElementById('openrouter_model').value;
  const status = document.getElementById('status');

  let apiKeyValid = true;
  if (api_provider === 'aimlapi' && !apiKey) apiKeyValid = false;
  if (api_provider === 'openrouter' && !openrouter_apiKey) apiKeyValid = false;
  if (!prompt1 || !prompt2 || !prompt3 || !apiKeyValid) {
    status.textContent = 'Пожалуйста, заполните все поля';
    status.className = 'status error';
    return;
  }
  if (isNaN(minTypingDelay) || isNaN(maxTypingDelay) || minTypingDelay < 1 || maxTypingDelay < 1 || minTypingDelay > maxTypingDelay) {
    status.textContent = 'Проверьте интервалы печати: минимальный должен быть ≥ 1, максимальный ≥ минимального';
    status.className = 'status error';
    return;
  }

  chrome.storage.sync.set({
    prompt1Title, prompt2Title, prompt3Title,
    prompt1, prompt2, prompt3,
    apiKey,
    minTypingDelay,
    maxTypingDelay,
    aimlapi_model,
    api_provider,
    openrouter_apiKey,
    openrouter_model
  }, () => {
    status.textContent = 'Настройки сохранены';
    status.className = 'status success';
    setTimeout(() => {
      status.style.display = 'none';
    }, 3000);
  });
}); 