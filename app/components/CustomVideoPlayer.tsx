import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

interface CustomVideoPlayerProps {
  src: string;
  videoPath: string;
  title: string;
  onClose: () => void;
}

interface TranscodeStatus {
  cacheKey: string;
  duration: number | null;
  segments: number[];
  segmentCount: number;
  timeCovered: number;
  isComplete: boolean;
}

export function CustomVideoPlayer({ src, videoPath, title, onClose }: CustomVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [buffering, setBuffering] = useState(false);
  const [transcodeStatus, setTranscodeStatus] = useState<TranscodeStatus | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const statusIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Poll for transcode status
  useEffect(() => {
    const pollStatus = async () => {
      try {
        const response = await fetch(`/transcode-status?path=${encodeURIComponent(videoPath)}`);
        const status: TranscodeStatus = await response.json();
        console.log("[Player] Transcode status received:", status);
        setTranscodeStatus(status);
        
        // Set duration from transcode status (more reliable than video element)
        if (status.duration && !isNaN(status.duration)) {
          console.log(`[Player] Setting duration from status: ${status.duration}s`);
          setDuration(status.duration);
        } else {
          console.warn(`[Player] Duration not available in status:`, status.duration);
        }
      } catch (error) {
        console.error("[Player] Error polling transcode status:", error);
      }
    };

    // Initial poll
    pollStatus();
    
    // Set up interval
    const interval = setInterval(pollStatus, 2000); // Poll every 2 seconds
    statusIntervalRef.current = interval;

    return () => {
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
        statusIntervalRef.current = null;
      }
    };
  }, [videoPath]);

  // Initialize HLS player
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setLoading(true);
    setError(null);

    const initializePlayer = async () => {
      try {
        const response = await fetch(src, { method: 'HEAD' });
        const contentType = response.headers.get('Content-Type') || '';
        
        const isHLS = contentType.includes('mpegurl') || contentType.includes('m3u8');

        if (isHLS && Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            backBufferLength: 90,
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
          });

          hlsRef.current = hls;
          hls.loadSource(src);
          hls.attachMedia(video);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            console.log("HLS manifest loaded");
            setLoading(false);
            video.play().catch(err => console.warn("Autoplay failed:", err));
          });

          hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  console.error("Network error, retrying...");
                  setTimeout(() => hls.startLoad(), 1000);
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  console.error("Media error, recovering...");
                  hls.recoverMediaError();
                  break;
                default:
                  setError(`Playback error: ${data.details}`);
                  hls.destroy();
                  break;
              }
            }
          });

          hls.on(Hls.Events.FRAG_LOADING, () => {
            setBuffering(true);
          });

          hls.on(Hls.Events.FRAG_LOADED, () => {
            setBuffering(false);
            setError(null);
          });
        } else {
          // Fallback to native playback
          video.src = src;
          video.addEventListener("loadedmetadata", () => setLoading(false));
          video.addEventListener("error", () => setError("Failed to load video"));
        }
      } catch (error) {
        console.error("Error initializing player:", error);
        setError("Failed to initialize player");
      }
    };

    initializePlayer();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      
      // Stop transcoding when player unmounts
      const stopTranscode = async () => {
        try {
          await fetch("/stop-transcode", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ path: videoPath }),
          });
          console.log("Stopped transcoding");
        } catch (error) {
          console.error("Failed to stop transcoding:", error);
        }
      };
      stopTranscode();
    };
  }, [src, videoPath]);

  // Update current time
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleDurationChange = () => {
      // Don't use video element duration - it only shows transcoded duration
      // We get the full duration from transcode status
      console.log(`Video element duration: ${video.duration}s (ignoring, using status duration)`);
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("durationchange", handleDurationChange);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("durationchange", handleDurationChange);
    };
  }, []);

  // Handle seeking
  const handleSeek = async (time: number) => {
    const video = videoRef.current;
    if (!video || !transcodeStatus) return;

    const targetSegment = Math.floor(time / 4);
    const isTranscoded = transcodeStatus.segments.includes(targetSegment);

    if (isTranscoded || time <= transcodeStatus.timeCovered) {
      // Segment exists, seek normally
      video.currentTime = time;
    } else {
      // Need to transcode from this point
      console.log(`Seeking to untranscoded segment at ${time}s, triggering transcode...`);
      setBuffering(true);
      setError("Transcoding from this point, please wait...");

      try {
        await fetch("/transcode-seek", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ path: videoPath, seekTime: time.toString() }),
        });

        // Wait a bit for segments to start generating
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Try to seek
        video.currentTime = time;
        setError(null);
      } catch (error) {
        console.error("Seek transcode failed:", error);
        setError("Failed to seek to this position");
      } finally {
        setBuffering(false);
      }
    }
  };

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;
    
    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || !isFinite(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const transcodedProgress = transcodeStatus && duration > 0 
    ? Math.min((transcodeStatus.timeCovered / duration) * 100, 100) 
    : 0;
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
          {buffering && !loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/50">
              <div className="text-white text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                <p>Buffering...</p>
              </div>
            </div>
          )}
          {error && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
              <div className="text-yellow-400 text-sm bg-slate-900/90 px-4 py-2 rounded-lg">
                {error}
              </div>
            </div>
          )}
          <video
            ref={videoRef}
            className="w-full h-auto max-h-[calc(90vh-180px)]"
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
                console.log(`Seek bar clicked: ${percent * 100}% = ${time}s (duration: ${duration}s)`);
                if (duration > 0) {
                  handleSeek(time);
                } else {
                  console.warn("Cannot seek: duration is 0");
                }
              }}
            >
              {/* Transcoded progress (green) */}
              <div
                className="absolute h-full bg-green-600/50 rounded"
                style={{ width: `${transcodedProgress}%` }}
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

          {/* Play/Pause Button and Status */}
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-400">
              {transcodeStatus && (
                <span>
                  Transcoded: {Math.floor(transcodeStatus.timeCovered / 60)}:{Math.floor(transcodeStatus.timeCovered % 60).toString().padStart(2, '0')} / {formatTime(duration)}
                  {!transcodeStatus.isComplete && ' (transcoding...)'}
                </span>
              )}
            </div>
            <button
              onClick={togglePlayPause}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
            >
              {isPlaying ? "Pause" : "Play"}
            </button>
            <div className="text-xs text-slate-400 w-40 text-right">
              {transcodeStatus && transcodeStatus.segmentCount > 0 && (
                <span>{transcodeStatus.segmentCount} segments</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

