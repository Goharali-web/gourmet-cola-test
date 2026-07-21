/* ==========================================================================
   GOURMET COLA 3D CANVAS & INTERACTIVE SCROLL ENGINE
   ========================================================================== */

const TOTAL_FRAMES = 240;
const frames = [];
const frameState = {
  currentIndex: 0,
  targetIndex: 0,
  loadedCount: 0
};

// DOM Elements
const canvas = document.getElementById('hero-canvas');
const ctx = canvas.getContext('2d');
const preloader = document.getElementById('preloader');
const loaderBar = document.getElementById('loader-bar');
const loaderPercent = document.getElementById('loader-percent');
const frameCounterEl = document.getElementById('frame-counter');
const scrollThumbEl = document.getElementById('scroll-thumb');
const scrollPctEl = document.getElementById('scroll-percentage');

// Audio Engine State
let audioCtx = null;
let fizzBuffer = null;
let fizzSource = null;
let isSoundEnabled = false;

/* ==========================================================================
   1. FRAME PRELOADER
   ========================================================================== */

function getFramePath(index) {
  const frameNum = String(index + 1).padStart(3, '0');
  return `/frames/ezgif-frame-${frameNum}.jpg`;
}

function preloadFrames() {
  return new Promise((resolve) => {
    for (let i = 0; i < TOTAL_FRAMES; i++) {
      const img = new Image();
      img.src = getFramePath(i);
      
      img.onload = () => {
        frameState.loadedCount++;
        const pct = Math.floor((frameState.loadedCount / TOTAL_FRAMES) * 100);
        
        if (loaderBar) loaderBar.style.width = `${pct}%`;
        if (loaderPercent) loaderPercent.textContent = `${pct}%`;

        if (frameState.loadedCount === TOTAL_FRAMES) {
          setTimeout(() => {
            if (preloader) preloader.classList.add('hidden');
            resolve();
          }, 300);
        }
      };

      img.onerror = () => {
        // Fallback for frame load errors if any
        frameState.loadedCount++;
        if (frameState.loadedCount === TOTAL_FRAMES) {
          if (preloader) preloader.classList.add('hidden');
          resolve();
        }
      };

      frames.push(img);
    }
  });
}

/* ==========================================================================
   2. CANVAS RENDER LOOP WITH ASPECT FIT & LERP
   ========================================================================== */

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  renderFrame(Math.round(frameState.currentIndex));
}

function renderFrame(index) {
  const img = frames[index];
  if (!img || !img.complete) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const canvasRatio = canvas.width / canvas.height;
  const imgRatio = img.width / img.height;

  let drawWidth, drawHeight, offsetX, offsetY;

  if (canvasRatio > imgRatio) {
    drawWidth = canvas.width;
    drawHeight = canvas.width / imgRatio;
    offsetX = 0;
    offsetY = (canvas.height - drawHeight) / 2;
  } else {
    drawHeight = canvas.height;
    drawWidth = canvas.height * imgRatio;
    offsetX = (canvas.width - drawWidth) / 2;
    offsetY = 0;
  }

  ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
}

function animate() {
  // Linear interpolation (lerp) for smooth frame transitions on fast scroll
  const diff = frameState.targetIndex - frameState.currentIndex;
  if (Math.abs(diff) > 0.001) {
    frameState.currentIndex += diff * 0.12;
    renderFrame(Math.min(TOTAL_FRAMES - 1, Math.max(0, Math.round(frameState.currentIndex))));
  }

  requestAnimationFrame(animate);
}

/* ==========================================================================
   3. SCROLL PROGRESS & HUD TRACKER
   ========================================================================== */

function updateScrollState() {
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const maxScroll = (document.documentElement.scrollHeight - window.innerHeight) || 1;
  const scrollPct = Math.min(1, Math.max(0, scrollTop / maxScroll));

  // Map 0 - 1 to 0 - (TOTAL_FRAMES - 1)
  frameState.targetIndex = scrollPct * (TOTAL_FRAMES - 1);

  // Update HUD Display
  const currentFrameDisplay = String(Math.min(TOTAL_FRAMES, Math.max(1, Math.round(frameState.currentIndex + 1)))).padStart(3, '0');
  if (frameCounterEl) frameCounterEl.textContent = currentFrameDisplay;
  if (scrollThumbEl) scrollThumbEl.style.height = `${scrollPct * 100}%`;
  if (scrollPctEl) scrollPctEl.textContent = `${Math.round(scrollPct * 100)}%`;

  // Play subtle fizz audio on rapid scroll if sound enabled
  if (isSoundEnabled && Math.abs(frameState.targetIndex - frameState.currentIndex) > 2) {
    triggerFizzAudio();
  }

  // Update Active Navigation Link
  updateActiveNavLink();
}

function updateActiveNavLink() {
  const sections = document.querySelectorAll('.scroll-section');
  const navLinks = document.querySelectorAll('.nav-link');
  
  let currentSectionId = '';
  sections.forEach((sec) => {
    const rect = sec.getBoundingClientRect();
    if (rect.top <= window.innerHeight * 0.5 && rect.bottom >= window.innerHeight * 0.2) {
      currentSectionId = sec.getAttribute('id');
    }
  });

  navLinks.forEach((link) => {
    if (link.getAttribute('href') === `#${currentSectionId}`) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

/* ==========================================================================
   4. PROCEDURAL WEB AUDIO FIZZ ENGINE
   ========================================================================== */

function initAudioEngine() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function createFizzSound() {
  if (!audioCtx) return;

  const bufferSize = audioCtx.sampleRate * 0.8;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);

  // White noise generation
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  return buffer;
}

function triggerFizzAudio() {
  if (!audioCtx || !isSoundEnabled) return;
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  try {
    const noiseBuffer = createFizzSound();
    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3200;
    filter.Q.value = 3.0;

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);

    noiseSource.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    noiseSource.start();
  } catch (err) {
    console.warn('Audio playback error:', err);
  }
}

function toggleSound() {
  isSoundEnabled = !isSoundEnabled;
  const soundBtn = document.getElementById('sound-btn');
  const iconOff = soundBtn.querySelector('.icon-off');
  const iconOn = soundBtn.querySelector('.icon-on');
  const soundText = soundBtn.querySelector('.sound-text');

  if (isSoundEnabled) {
    initAudioEngine();
    soundBtn.classList.add('active');
    iconOff.classList.add('hidden');
    iconOn.classList.remove('hidden');
    soundText.textContent = 'Sound: ON';
    triggerFizzAudio();
  } else {
    soundBtn.classList.remove('active');
    iconOff.classList.remove('hidden');
    iconOn.classList.add('hidden');
    soundText.textContent = 'Sound: OFF';
  }
}

/* ==========================================================================
   5. MODAL & INTERACTIVE EVENT HANDLERS
   ========================================================================== */

window.openModal = function() {
  const modal = document.getElementById('buy-modal');
  if (modal) modal.classList.remove('hidden');
};

window.closeModal = function() {
  const modal = document.getElementById('buy-modal');
  if (modal) modal.classList.add('hidden');
};

window.selectPack = function(packName) {
  alert(`🛒 Selected: ${packName}. Redirecting to instant checkout...`);
  closeModal();
};

window.handleSubscribe = function(e) {
  e.preventDefault();
  const msg = document.getElementById('news-msg');
  if (msg) {
    msg.classList.remove('hidden');
    setTimeout(() => {
      msg.classList.add('hidden');
    }, 4000);
  }
};

/* ==========================================================================
   6. INITIALIZATION
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('scroll', updateScrollState, { passive: true });

  const soundBtn = document.getElementById('sound-btn');
  if (soundBtn) soundBtn.addEventListener('click', toggleSound);

  const buyModalBtn = document.getElementById('open-buy-modal');
  if (buyModalBtn) buyModalBtn.addEventListener('click', openModal);

  // Close modal when clicking outside content card
  const modalBackdrop = document.getElementById('buy-modal');
  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) closeModal();
    });
  }

  // Preload frames & start render loop
  await preloadFrames();
  resizeCanvas();
  updateScrollState();
  requestAnimationFrame(animate);
});
