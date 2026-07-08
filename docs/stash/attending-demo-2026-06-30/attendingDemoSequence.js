/**
 * AttendingDemoSequence — class-based state machine for the attending demo.
 *
 * Walks through unplaced interventions one by one, placing each with a
 * configurable delay and optional "typing" narration in the command dock.
 *
 * States: idle → running → paused → running → … → completed
 *
 * Usage:
 *   const engine = new AttendingDemoSequence({
 *     interventions,       // unplaced interventions[]
 *     placementOrder,      // current placementOrder array (length used for index)
 *     onPlace: async (iv, index) => { /* setPlaced, setPins, logTimeline * / },
 *     onNarrate: (text) => { /* set demoNarration text * / },
 *     onProgress: (step, total) => { /* setDemoStepIndex, etc * / },
 *     onComplete: () => { /* showToast, cleanup * / },
 *     delayMs: 800,        // ms between placements
 *     narrateMs: 200,      // ms per character for typing effect
 *   });
 *   engine.start();
 */
export class AttendingDemoSequence {
  /**
   * @param {Object} opts
   * @param {Array} opts.interventions — items to place (filtered to unplaced)
   * @param {number} opts.placementOrderLength — current length of placementOrder
   * @param {(iv: Object, index: number) => Promise<void>} opts.onPlace
   * @param {(text: string) => void} opts.onNarrate
   * @param {(step: number, total: number) => void} opts.onProgress
   * @param {() => void} opts.onComplete
   * @param {number} [opts.delayMs=800]
   * @param {number} [opts.narrateMs=30]
   */
  constructor(opts) {
    this.interventions = [...opts.interventions];
    this.placementOrderLength = opts.placementOrderLength;
    this.onPlace = opts.onPlace;
    this.onNarrate = opts.onNarrate || (() => {});
    this.onProgress = opts.onProgress || (() => {});
    this.onComplete = opts.onComplete || (() => {});
    this.delayMs = opts.delayMs ?? 800;
    this.narrateMs = opts.narrateMs ?? 30;

    /** @type {'idle'|'running'|'paused'|'completed'} */
    this._state = 'idle';
    this._currentIndex = 0;
    this._total = this.interventions.length;
    this._cancelled = false;
    this._timeoutId = null;
    this._resolveWait = null;
  }

  get state() {
    return this._state;
  }

  get currentIndex() {
    return this._currentIndex;
  }

  get total() {
    return this._total;
  }

  get remaining() {
    return this._total - this._currentIndex;
  }

  /** Start (or resume) the sequence from current position. */
  start() {
    if (this._state === 'completed') return;
    if (this._state === 'running') return;
    this._state = 'running';
    this._cancelled = false;
    this._runLoop();
  }

  /** Pause after the current placement completes. */
  pause() {
    if (this._state !== 'running') return;
    this._state = 'paused';
    // The loop will check _state on next iteration
  }

  /** Resume from paused state. */
  resume() {
    if (this._state !== 'paused') return;
    this.start();
  }

  /** Stop entirely and reset. */
  stop() {
    this._cancelled = true;
    this._state = 'idle';
    this._currentIndex = 0;
    if (this._timeoutId) {
      clearTimeout(this._timeoutId);
      this._timeoutId = null;
    }
    if (this._resolveWait) {
      this._resolveWait();
      this._resolveWait = null;
    }
  }

  /** Go to a specific step index (0-based). Does not place anything. */
  goTo(index) {
    if (index < 0) index = 0;
    if (index > this._total) index = this._total;
    this._currentIndex = index;
    this.onProgress(index, this._total);
  }

  /** Place the next single item (for step-by-step mode). Returns the placed item or null. */
  async stepNext() {
    if (this._currentIndex >= this._total) return null;
    const iv = this.interventions[this._currentIndex];
    const idx = this._currentIndex;
    this._currentIndex += 1;
    await this._placeOne(iv, idx);
    this.onProgress(this._currentIndex, this._total);
    if (this._currentIndex >= this._total) {
      this._state = 'completed';
      this.onComplete();
    }
    return iv;
  }

  /** Place the previous item (for step-back). Not always meaningful — resets state. */
  stepPrevious() {
    if (this._currentIndex <= 0) return;
    this._currentIndex -= 1;
    this.onProgress(this._currentIndex, this._total);
  }

  // ---- Internal ----

  async _runLoop() {
    while (this._currentIndex < this._total && !this._cancelled) {
      if (this._state === 'paused') {
        // Wait until resumed
        await new Promise((resolve) => {
          this._resolveWait = resolve;
        });
        this._resolveWait = null;
        if (this._cancelled) break;
        continue;
      }

      const iv = this.interventions[this._currentIndex];
      const idx = this._currentIndex;

      // Narration: type out the intervention label
      this._typeNarration(iv.label);

      // Wait before placing
      await this._wait(this.delayMs);
      if (this._cancelled) break;
      if (this._state === 'paused') continue;

      // Place the item
      await this._placeOne(iv, idx);
      if (this._cancelled) break;

      this._currentIndex += 1;
      this.onProgress(this._currentIndex, this._total);
    }

    if (!this._cancelled && this._currentIndex >= this._total) {
      this._state = 'completed';
      this.onComplete();
    }
  }

  async _placeOne(iv, index) {
    await this.onPlace(iv, this.placementOrderLength + index);
  }

  async _typeNarration(text) {
    if (!this.onNarrate || this.narrateMs <= 0) return;
    let displayed = '';
    for (let i = 0; i < text.length; i++) {
      if (this._cancelled || this._state === 'paused') break;
      displayed += text[i];
      this.onNarrate(displayed);
      await this._wait(this.narrateMs);
    }
    // Show full text briefly
    if (!this._cancelled && this._state !== 'paused') {
      this.onNarrate(text);
    }
  }

  _wait(ms) {
    return new Promise((resolve) => {
      this._timeoutId = setTimeout(() => {
        this._timeoutId = null;
        resolve();
      }, ms);
    });
  }
}
