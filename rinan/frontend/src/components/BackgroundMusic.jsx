import { useEffect, useRef, useState } from 'react';

const TRACK_URL = '/audio/rinan-background.mp3';

export function BackgroundMusic() {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;
    audio.volume = 0.42;
    audio.play().then(
      () => {
        setPlaying(true);
        setAutoplayBlocked(false);
      },
      () => setAutoplayBlocked(true)
    );
    return () => audio.pause();
  }, []);

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      try {
        await audio.play();
        setPlaying(true);
        setAutoplayBlocked(false);
      } catch {
        setPlaying(false);
        setAutoplayBlocked(true);
      }
    } else {
      audio.pause();
      setPlaying(false);
    }
  }

  return (
    <div className="wall__music" role="group" aria-label="背景音樂播放器">
      <audio
        ref={audioRef}
        src={TRACK_URL}
        loop
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      <span className="wall__music-label">
        <strong>走傱日南</strong>
        <span>{playing ? '播放中' : autoplayBlocked ? '點擊播放' : '已暫停'}</span>
      </span>
      <button
        className="wall__music-button"
        type="button"
        onClick={togglePlayback}
        aria-label={playing ? '暫停背景音樂' : '播放背景音樂'}
        title={playing ? '暫停背景音樂' : '播放背景音樂'}
      >
        {playing ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 5h3v14H8zM14 5h3v14h-3z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m8 5 12 7-12 7z" />
          </svg>
        )}
      </button>
    </div>
  );
}
