import { useEffect, useRef, useState } from "react";

interface NativeVideoPlayerProps {
  src: string;
  title: string;
  onClose: () => void;
}

export function NativeVideoPlayer({ src, title, onClose }: NativeVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buffered, setBuffered] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      console.log("[Native Player] Video metadata loaded, duration:", video.duration);
      setDuration(video.duration);
      setLoading(false);
    };

    const handleCanPlay = () => {
      console.log("[Native Player] Video can play, attempting autoplay");
      setLoading(false);
      setError(null);
      
      // Attempt autoplay
      video.play().catch(err => {
        console.warn("[Native Player] Autoplay failed:", err);
        setError("Click play to start");
      });
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handlePlay = () => {
      console.log("[Native Player] Playing");
      setIsPlaying(true);
    };

    const handlePause = () => {
      console.log("[Native Player] Paused");
      setIsPlaying(false);
    };

    const handleError = (e: Event) => {
      console.error("[Native Player] Video error:", e);
      setError("Failed to load video");
      setLoading(false);
    };

    const handleProgress = () => {
      if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        const bufferedPercent = (bufferedEnd / video.duration) * 100;
        setBuffered(bufferedPercent);
      }
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("error", handleError);
    video.addEventListener("progress", handleProgress);

    // Set source
    video.src = src;
    console.log("[Native Player] Initialized with source:", src);

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("error", handleError);
      video.removeEventListener("progress", handleProgress);
    };
  }, [src]);

  const handleSeek = (time: number) => {
    const video = videoRef.current;
    if (!video) return;
    
    console.log(`[Native Player] Seeking to ${time}s`);
    video.currentTime = time;
  };

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;
    
    if (isPlaying) {
      video.pause();
    } else {
      video.play().catch(err => {
        console.error("[Native Player] Play failed:", err);
        setError("Failed to play video");
      });
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || !isFinite(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const playProgress = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white truncate flex-1 mr-4">{title}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-slate-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Video */}
        <div className="bg-black relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="text-white text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                <p>Loading video...</p>
              </div>
            </div>
          )}
          {error && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
              <div className="text-red-400 text-sm bg-slate-900/90 px-4 py-2 rounded-lg">
                {error}
              </div>
            </div>
          )}
          <video
            ref={videoRef}
            className="w-full h-auto max-h-[calc(90vh-180px)]"
            preload="metadata"
          />
        </div>

        {/* Custom Controls */}
        <div className="bg-slate-900 p-4">
          {/* Seek Bar */}
          <div className="mb-3">
            <div
              className="relative h-2 bg-slate-700 rounded cursor-pointer group"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const percent = x / rect.width;
                const time = percent * duration;
                if (duration > 0) {
                  handleSeek(time);
                }
              }}
            >
              {/* Buffered progress (gray) */}
              <div
                className="absolute h-full bg-slate-600 rounded"
                style={{ width: `${buffered}%` }}
              />
              
              {/* Play progress (blue) */}
              <div
                className="absolute h-full bg-blue-500 rounded"
                style={{ width: `${playProgress}%` }}
              />
              
              {/* Hover effect */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="h-full bg-white/10 rounded" />
              </div>
            </div>
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Play/Pause Button */}
          <div className="flex items-center justify-center">
            <button
              onClick={togglePlayPause}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
              disabled={loading}
            >
              {isPlaying ? "Pause" : "Play"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

