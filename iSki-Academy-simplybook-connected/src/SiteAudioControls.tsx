import { useEffect, useRef, useState } from 'react'
import { Music2, MousePointerClick, Volume2, VolumeX, X } from 'lucide-react'
import './site-audio.css'

const BACKGROUND_AUDIO = '/assets/snowing-in-dresden-background.mp3'
const CLICK_AUDIO = '/assets/snowball-click.mp3'
const CLICK_PREFERENCE_KEY = 'iski-click-effects'
const INTERACTIVE_SELECTOR = [
  'button',
  'a[href]',
  '[role="button"]',
  '[role="tab"]',
  'summary',
  'select',
  'input[type="checkbox"]',
  'input[type="radio"]',
  'input[type="submit"]',
  'input[type="date"]',
  'input[type="time"]',
].join(',')

export default function SiteAudioControls() {
  const [panelOpen, setPanelOpen] = useState(false)
  const [backgroundEnabled, setBackgroundEnabled] = useState(false)
  const [clickEnabled, setClickEnabled] = useState(true)
  const [playbackMessage, setPlaybackMessage] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const clickEnabledRef = useRef(true)
  const audioContextRef = useRef<AudioContext | null>(null)
  const clickBufferRef = useRef<AudioBuffer | null>(null)
  const fallbackClickAudioRef = useRef<HTMLAudioElement | null>(null)
  const backgroundAudioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    let enabled = true
    try {
      enabled = window.localStorage.getItem(CLICK_PREFERENCE_KEY) !== 'off'
    } catch {
      // The requested click feedback remains enabled if storage is unavailable.
    }
    clickEnabledRef.current = enabled
    setClickEnabled(enabled)
  }, [])

  useEffect(() => {
    let active = true
    const fallbackAudio = new Audio(CLICK_AUDIO)
    fallbackAudio.preload = 'auto'
    fallbackAudio.volume = 0.2
    fallbackAudio.load()
    fallbackClickAudioRef.current = fallbackAudio

    let context: AudioContext | null = null
    try {
      context = new AudioContext({ latencyHint: 'interactive' })
      audioContextRef.current = context
      void fetch(CLICK_AUDIO)
        .then((response) => {
          if (!response.ok) throw new Error('Click sound could not be loaded')
          return response.arrayBuffer()
        })
        .then((audioData) => context!.decodeAudioData(audioData))
        .then((buffer) => {
          if (active) clickBufferRef.current = buffer
        })
        .catch(() => {
          // Keep the preloaded HTMLAudio fallback available if decoding is unsupported.
        })
    } catch {
      context = null
    }

    const warmAudioOutput = () => {
      const audioContext = audioContextRef.current
      if (audioContext?.state === 'suspended') {
        void audioContext.resume().catch(() => undefined)
      }
    }

    const playClickSound = (event: MouseEvent) => {
      if (!clickEnabledRef.current || !(event.target instanceof Element)) return
      const control = event.target.closest(INTERACTIVE_SELECTOR)
      if (!control || control.closest('[data-audio-control]')) return
      if (control.getAttribute('aria-disabled') === 'true') return
      if ('disabled' in control && Boolean((control as HTMLButtonElement).disabled)) return

      const audioContext = audioContextRef.current
      const buffer = clickBufferRef.current
      if (audioContext && buffer) {
        if (audioContext.state === 'suspended') warmAudioOutput()
        const source = audioContext.createBufferSource()
        const gain = audioContext.createGain()
        source.buffer = buffer
        gain.gain.setValueAtTime(0.2, audioContext.currentTime)
        source.connect(gain)
        gain.connect(audioContext.destination)
        // Start in the click capture event; never await or defer the site action.
        source.start(audioContext.currentTime)
        return
      }

      const fallback = fallbackClickAudioRef.current
      if (!fallback) return
      try {
        fallback.currentTime = 0
      } catch {
        // Some browsers do not allow seeking until the media has loaded.
      }
      void fallback.play().catch(() => {
        // A blocked or unavailable effect must never interrupt a customer action.
      })
    }

    document.addEventListener('pointerdown', warmAudioOutput, true)
    document.addEventListener('keydown', warmAudioOutput, true)
    document.addEventListener('click', playClickSound, true)
    return () => {
      active = false
      document.removeEventListener('pointerdown', warmAudioOutput, true)
      document.removeEventListener('keydown', warmAudioOutput, true)
      document.removeEventListener('click', playClickSound, true)
      fallbackAudio.pause()
      fallbackClickAudioRef.current = null
      backgroundAudioRef.current?.pause()
      backgroundAudioRef.current = null
      clickBufferRef.current = null
      audioContextRef.current = null
      if (context && context.state !== 'closed') void context.close().catch(() => undefined)
    }
  }, [])

  useEffect(() => {
    if (!panelOpen) return

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setPanelOpen(false)
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPanelOpen(false)
    }

    document.addEventListener('click', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('click', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [panelOpen])

  const toggleBackground = async () => {
    setPlaybackMessage('')
    if (backgroundEnabled) {
      backgroundAudioRef.current?.pause()
      if (backgroundAudioRef.current) backgroundAudioRef.current.currentTime = 0
      setBackgroundEnabled(false)
      return
    }

    let audio = backgroundAudioRef.current
    if (!audio) {
      audio = new Audio(BACKGROUND_AUDIO)
      audio.loop = true
      audio.preload = 'none'
      audio.volume = 0.12
      backgroundAudioRef.current = audio
    }

    try {
      await audio.play()
      setBackgroundEnabled(true)
    } catch {
      setBackgroundEnabled(false)
      setPlaybackMessage('Playback was blocked. Tap Background sound to try again.')
    }
  }

  const toggleClickSound = () => {
    const nextEnabled = !clickEnabledRef.current
    clickEnabledRef.current = nextEnabled
    setClickEnabled(nextEnabled)
    try {
      window.localStorage.setItem(CLICK_PREFERENCE_KEY, nextEnabled ? 'on' : 'off')
    } catch {
      // The preference still applies for this visit if storage is unavailable.
    }
  }

  return (
    <div className="site-audio" ref={rootRef} data-audio-control>
      <button
        type="button"
        className="site-audio__trigger"
        aria-label={`Open sound settings. Background sound ${backgroundEnabled ? 'on' : 'off'}, click sounds ${clickEnabled ? 'on' : 'off'}.`}
        aria-expanded={panelOpen}
        aria-controls="site-audio-panel"
        onClick={() => setPanelOpen((open) => !open)}
      >
        {backgroundEnabled || clickEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
        <span>Sound</span>
      </button>

      {panelOpen && (
        <section className="site-audio__panel" id="site-audio-panel" aria-label="Sound settings">
          <div className="site-audio__heading">
            <div>
              <strong>Sound settings</strong>
              <span>Choose what you hear</span>
            </div>
            <button
              type="button"
              className="site-audio__close"
              aria-label="Close sound settings"
              onClick={() => setPanelOpen(false)}
            >
              <X size={17} />
            </button>
          </div>

          <div className="site-audio__row">
            <div className="site-audio__label">
              <Music2 size={17} aria-hidden="true" />
              <span><strong>Background sound</strong><small>Looping alpine ambience</small></span>
            </div>
            <button
              type="button"
              role="switch"
              className={`site-audio__switch ${backgroundEnabled ? 'is-on' : ''}`}
              aria-label="Background sound"
              aria-checked={backgroundEnabled}
              onClick={toggleBackground}
            ><span /></button>
          </div>

          <div className="site-audio__row">
            <div className="site-audio__label">
              <MousePointerClick size={17} aria-hidden="true" />
              <span><strong>Click sounds</strong><small>Soft snowball effect on controls</small></span>
            </div>
            <button
              type="button"
              role="switch"
              className={`site-audio__switch ${clickEnabled ? 'is-on' : ''}`}
              aria-label="Click sound effects"
              aria-checked={clickEnabled}
              onClick={toggleClickSound}
            ><span /></button>
          </div>

          <p className="site-audio__note">Background sound starts only when you turn it on. Click sounds can be switched off at any time.</p>
          {playbackMessage && <p className="site-audio__message" role="status">{playbackMessage}</p>}
        </section>
      )}
    </div>
  )
}
