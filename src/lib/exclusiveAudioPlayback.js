let activeAudio = null;

/** Pause any other <audio> when this one starts playing. */
export function bindExclusiveAudioPlayback(audioEl) {
  if (!audioEl || typeof audioEl.pause !== 'function') return () => {};

  const onPlay = () => {
    if (activeAudio && activeAudio !== audioEl && !activeAudio.paused) {
      activeAudio.pause();
    }
    activeAudio = audioEl;
  };

  const clearActive = () => {
    if (activeAudio === audioEl) activeAudio = null;
  };

  audioEl.addEventListener('play', onPlay);
  audioEl.addEventListener('pause', clearActive);
  audioEl.addEventListener('ended', clearActive);

  return () => {
    audioEl.removeEventListener('play', onPlay);
    audioEl.removeEventListener('pause', clearActive);
    audioEl.removeEventListener('ended', clearActive);
    if (activeAudio === audioEl) activeAudio = null;
  };
}
