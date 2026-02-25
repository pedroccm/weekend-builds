(() => {
  const WEBHOOK_URL = 'https://n8n.pedromarques.tech/webhook/weekend-ideas';

  // DOM
  const form = document.getElementById('idea-form');
  const nameInput = document.getElementById('name');
  const linkedinInput = document.getElementById('linkedin');
  const audioTabBtn = document.getElementById('audio-tab-btn');
  const textTabBtn = document.getElementById('text-tab-btn');
  const audioPanel = document.getElementById('audio-panel');
  const textPanel = document.getElementById('text-panel');
  const micBtn = document.getElementById('mic-btn');
  const micLabel = document.getElementById('mic-label');
  const timerEl = document.getElementById('timer');
  const transcriptionBox = document.getElementById('transcription-box');
  const transcriptionEl = document.getElementById('transcription');
  const noSpeechEl = document.getElementById('no-speech');
  const ideaTextarea = document.getElementById('idea');
  const submitBtn = document.getElementById('submit-btn');
  const successCard = document.getElementById('success-card');
  const newIdeaBtn = document.getElementById('new-idea-btn');
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-msg');

  // State
  let currentMethod = 'audio';
  let isRecording = false;
  let recognition = null;
  let finalTranscript = '';
  let timerInterval = null;
  let seconds = 0;

  // Speech Recognition setup
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const hasSpeech = !!SpeechRecognition;

  if (!hasSpeech) {
    document.getElementById('audio-recorder').classList.add('hidden');
    noSpeechEl.classList.remove('hidden');
  }

  // Tab switching
  function switchMethod(method) {
    currentMethod = method;
    audioTabBtn.classList.toggle('active', method === 'audio');
    textTabBtn.classList.toggle('active', method === 'text');
    audioPanel.classList.toggle('hidden', method !== 'audio');
    textPanel.classList.toggle('hidden', method !== 'text');
    validateForm();
  }

  audioTabBtn.addEventListener('click', () => switchMethod('audio'));
  textTabBtn.addEventListener('click', () => {
    if (isRecording) stopRecording();
    switchMethod('text');
  });

  // Audio Recording
  function startRecording() {
    if (!hasSpeech) return;

    finalTranscript = '';
    transcriptionEl.innerHTML = '';
    transcriptionBox.classList.remove('hidden');
    isRecording = true;
    seconds = 0;

    micBtn.classList.add('recording');
    micLabel.textContent = 'Recording... click to stop';
    timerEl.classList.remove('hidden');
    updateTimer();
    timerInterval = setInterval(() => {
      seconds++;
      updateTimer();
    }, 1000);

    recognition = new SpeechRecognition();
    recognition.lang = navigator.language || 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += t;
        } else {
          interim += t;
        }
      }
      transcriptionEl.innerHTML =
        finalTranscript + (interim ? `<span class="interim">${interim}</span>` : '');
      validateForm();
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') {
        showToast('Microphone access denied. Please allow it and try again.');
        stopRecording();
      } else if (event.error === 'no-speech') {
        // Silence timeout - restart
        if (isRecording) {
          try { recognition.start(); } catch (_) {}
        }
      }
    };

    recognition.onend = () => {
      if (isRecording) {
        try { recognition.start(); } catch (_) {}
      }
    };

    try {
      recognition.start();
    } catch (e) {
      showToast('Could not start recording. Try again.');
      stopRecording();
    }
  }

  function stopRecording() {
    isRecording = false;
    if (recognition) {
      try { recognition.stop(); } catch (_) {}
      recognition = null;
    }
    clearInterval(timerInterval);
    micBtn.classList.remove('recording');
    micLabel.textContent = 'Click to record again';
    timerEl.classList.add('hidden');

    // Clean up transcription - remove interim spans
    const text = transcriptionEl.textContent || '';
    transcriptionEl.textContent = text;
    finalTranscript = text;
    validateForm();
  }

  function updateTimer() {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    timerEl.textContent = `${m}:${s}`;
  }

  micBtn.addEventListener('click', () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  });

  // Form Validation
  function validateForm() {
    const hasName = nameInput.value.trim().length > 0;
    const hasLinkedin = linkedinInput.value.trim().length > 0;
    let hasIdea = false;

    if (currentMethod === 'audio') {
      const text = (transcriptionEl.textContent || '').trim();
      hasIdea = text.length > 0;
    } else {
      hasIdea = ideaTextarea.value.trim().length > 0;
    }

    submitBtn.disabled = !(hasName && hasLinkedin && hasIdea);
  }

  nameInput.addEventListener('input', validateForm);
  linkedinInput.addEventListener('input', validateForm);
  ideaTextarea.addEventListener('input', validateForm);
  transcriptionEl.addEventListener('input', validateForm);

  // Submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submitBtn.disabled) return;
    if (isRecording) stopRecording();

    const idea = currentMethod === 'audio'
      ? (transcriptionEl.textContent || '').trim()
      : ideaTextarea.value.trim();

    const payload = {
      name: nameInput.value.trim(),
      linkedin: linkedinInput.value.trim(),
      idea,
      source: currentMethod,
    };

    // Loading state
    submitBtn.disabled = true;
    submitBtn.querySelector('.btn-text').classList.add('hidden');
    submitBtn.querySelector('.btn-loading').classList.remove('hidden');

    try {
      const res = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to send');

      // Success
      form.classList.add('hidden');
      successCard.classList.remove('hidden');
    } catch (err) {
      showToast('Something went wrong. Please try again.');
      submitBtn.disabled = false;
    } finally {
      submitBtn.querySelector('.btn-text').classList.remove('hidden');
      submitBtn.querySelector('.btn-loading').classList.add('hidden');
    }
  });

  // New Idea
  newIdeaBtn.addEventListener('click', () => {
    form.reset();
    finalTranscript = '';
    transcriptionEl.textContent = '';
    transcriptionBox.classList.add('hidden');
    micLabel.textContent = 'Click to start recording';
    successCard.classList.add('hidden');
    form.classList.remove('hidden');
    switchMethod('audio');
    submitBtn.disabled = true;
  });

  // Toast
  function showToast(msg) {
    toastMsg.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 4000);
  }
})();
