import { useEffect, useRef, useState, useCallback } from "react";
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
  segments: number[]; // All segment numbers that exist on disk
  segmentCount: number;
  minSegment: number;
  maxSegment: number;
  totalExpectedSegments: number | null;
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
  const [manifestStartSegment, setManifestStartSegment] = useState(0); // Which segment the current manifest starts at
  const isUnmountingRef = useRef(false);

  // Handle ESC key to close video
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Create or recreate HLS player
  const initializeHLS = useCallback((video: HTMLVideoElement, startSegment: number = 0) => {
    console.log(`[HLS] Initializing player for segments starting at ${startSegment}`);
    
    // Destroy existing instance
    if (hlsRef.current) {
      console.log("[HLS] Destroying old instance");
      hlsRef.current.destroy();
    }

    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      backBufferLength: 90,
      maxBufferLength: 30,
      maxMaxBufferLength: 60,
    });

    hlsRef.current = hls;
    
    // Build URL with segment parameter if not starting from 0
    const sourceUrl = startSegment > 0
      ? (src.includes('?') ? `${src}&segment=${startSegment}` : `${src}?segment=${startSegment}`)
      : src;
    console.log(`[HLS] Loading source: ${sourceUrl}`);
    
    hls.loadSource(sourceUrl);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      console.log(`[HLS] Manifest loaded for segment ${startSegment}`);
      setLoading(false);
      setBuffering(false);
      setError(null);
      setManifestStartSegment(startSegment);
      video.play().catch(err => {
        console.warn("Autoplay failed:", err);
        setError("Click play to start");
      });
    });

    hls.on(Hls.Events.ERROR, (event, data) => {
      if (isUnmountingRef.current) return;
      
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            console.error("Network error, retrying...");
            setTimeout(() => {
              if (!isUnmountingRef.current) {
                hls.startLoad();
              }
            }, 1000);
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            console.error("Media error, recovering...");
            if (!isUnmountingRef.current) {
              hls.recoverMediaError();
            }
            break;
          default:
            setError(`Playback error: ${data.details}`);
            hls.destroy();
            break;
        }
      }
    });

    hls.on(Hls.Events.FRAG_LOADED, () => {
      setError(null);
    });
  }, [src]);

  // Initialize player on mount
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Reset unmounting flag (in case effect re-runs)
    isUnmountingRef.current = false;
    
    setLoading(true);
    setError(null);

    const init = async () => {
      try {
        const response = await fetch(src, { method: 'HEAD' });
        const contentType = response.headers.get('Content-Type') || '';
        
        const isHLS = contentType.includes('mpegurl') || contentType.includes('m3u8');

        if (isHLS && Hls.isSupported()) {
          console.log("[Player] Initializing HLS player from segment 0");
          initializeHLS(video, 0);
        } else {
          // Fallback to native playback
          console.log("[Player] Initializing native player");
          video.src = src;
          video.addEventListener("loadedmetadata", () => setLoading(false));
          video.addEventListener("error", () => setError("Failed to load video"));
        }
      } catch (error) {
        console.error("Error initializing player:", error);
        setError("Failed to initialize player");
      }
    };

    init();

    return () => {
      console.log("[Player] Cleanup: Destroying HLS and stopping transcode");
      isUnmountingRef.current = true;
      
      // Destroy HLS player
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      
      // Stop transcoding
      const formData = new URLSearchParams({ path: videoPath });
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/stop-transcode", false);
      xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
      try {
        xhr.send(formData);
        console.log("[Player] Stop-transcode sent");
      } catch (error) {
        console.error("[Player] Failed to send stop-transcode:", error);
      }
    };
  }, [src, videoPath, initializeHLS]);

  // Poll for transcode status
  useEffect(() => {
    const pollStatus = async () => {
      try {
        const response = await fetch(`/transcode-status?path=${encodeURIComponent(videoPath)}`);
        const status: TranscodeStatus = await response.json();
        setTranscodeStatus(status);
        
        // Set duration from transcode status
        if (status.duration && !isNaN(status.duration)) {
          setDuration(status.duration);
        }
      } catch (error) {
        console.error("[Player] Error polling transcode status:", error);
      }
    };

    pollStatus();
    const interval = setInterval(pollStatus, 2000);

    return () => clearInterval(interval);
  }, [videoPath]);

  // Update current time
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      // Calculate actual video time = manifest start offset + player time
      const actualTime = manifestStartSegment * 4 + video.currentTime;
      setCurrentTime(actualTime);
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
    };
  }, [manifestStartSegment]);

  // Handle seeking
  const handleSeek = async (time: number) => {
    const video = videoRef.current;
    if (!video || !transcodeStatus) return;

    const targetSegment = Math.floor(time / 4);
    
    // Check if segment exists on disk
    const segmentExistsOnDisk = transcodeStatus.segments.includes(targetSegment);
    
    // Check if segment is in current manifest
    const isInCurrentManifest = transcodeStatus.minSegment <= targetSegment && 
                                 targetSegment <= transcodeStatus.maxSegment;

    console.log(`[Seek] Target: ${time}s (segment ${targetSegment}), onDisk: ${segmentExistsOnDisk}, inManifest: ${isInCurrentManifest}`);

    if (isInCurrentManifest && segmentExistsOnDisk) {
      // Segment is in current manifest - let HLS handle it natively
      const timeInManifest = time - (manifestStartSegment * 4);
      console.log(`[Seek] Native seek to ${timeInManifest}s within manifest`);
      video.currentTime = timeInManifest;
      setError(null);
    } else if (segmentExistsOnDisk) {
      // Segment exists on disk but not in current manifest - need new manifest
      console.log(`[Seek] Segment exists, requesting new transcode from ${time}s`);
      
      // Pause the video while we reload
      video.pause();
      setBuffering(true);
      setError(`Loading from ${Math.floor(time)}s...`);
      
      try {
        await fetch("/transcode-seek", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ 
            path: videoPath, 
            seekTime: time.toString() 
          }),
        });
        
        // Wait for new manifest to be ready, then reload HLS
        setTimeout(() => {
          if (video && !isUnmountingRef.current) {
            console.log(`[Seek] Reloading HLS from segment ${targetSegment}`);
            initializeHLS(video, targetSegment);
          }
        }, 2000);
      } catch (error) {
        console.error("Failed to request seek transcode:", error);
        setError("Failed to load from this position");
        setBuffering(false);
      }
    } else {
      // Segment doesn't exist - need to transcode it
      console.log(`[Seek] Segment doesn't exist, starting transcode from ${time}s`);
      
      // CRITICAL: Pause the video immediately
      video.pause();
      setBuffering(true);
      setError(`Transcoding from ${Math.floor(time)}s...`);
      
      try {
        await fetch("/transcode-seek", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ 
            path: videoPath, 
            seekTime: time.toString() 
          }),
        });
        
        // Wait for segments to be ready, then reload HLS
        const checkReady = setInterval(async () => {
          try {
            const response = await fetch(`/transcode-status?path=${encodeURIComponent(videoPath)}`);
            const status: TranscodeStatus = await response.json();
            
            // Check if target segment is now available (need at least 2 segments from that position)
            const segmentsAtPosition = status.segments.filter(s => s >= targetSegment).length;
            
            if (status.segments.includes(targetSegment) && segmentsAtPosition >= 2) {
              clearInterval(checkReady);
              console.log(`[Seek] Segments ready (${segmentsAtPosition} at position ${targetSegment}), reloading HLS`);
              console.log(`[Seek] Video element:`, video ? 'exists' : 'null', `Unmounting:`, isUnmountingRef.current);
              
              if (video && !isUnmountingRef.current) {
                console.log(`[Seek] Calling initializeHLS(video, ${targetSegment})`);
                initializeHLS(video, targetSegment);
              } else {
                console.error(`[Seek] Cannot initialize HLS - video: ${!!video}, unmounting: ${isUnmountingRef.current}`);
              }
            } else {
              console.log(`[Seek] Waiting... has segment ${targetSegment}:`, status.segments.includes(targetSegment), `segments at position:`, segmentsAtPosition);
            }
          } catch (error) {
            console.error("Error checking transcode status:", error);
          }
        }, 1000);
        
        // Safety timeout
        setTimeout(() => {
          clearInterval(checkReady);
          if (buffering) {
            setError("Transcoding taking too long");
            setBuffering(false);
          }
        }, 30000);
      } catch (error) {
        console.error("Failed to request seek transcode:", error);
        setError("Failed to start transcoding");
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

  // Calculate progress bars
  // Progress bar shows ALL segments that exist on disk (could be non-contiguous)
  const renderSegmentProgress = () => {
    if (!transcodeStatus || !transcodeStatus.totalExpectedSegments || duration === 0) {
      return null;
    }

    // Create array of segment ranges to show as green
    const ranges: { start: number; end: number }[] = [];
    if (transcodeStatus.segments.length > 0) {
      let rangeStart = transcodeStatus.segments[0];
      let rangeEnd = transcodeStatus.segments[0];

      for (let i = 1; i < transcodeStatus.segments.length; i++) {
        const seg = transcodeStatus.segments[i];
        if (seg === rangeEnd + 1) {
          // Contiguous, extend range
          rangeEnd = seg;
        } else {
          // Gap found, save current range and start new one
          ranges.push({ start: rangeStart, end: rangeEnd });
          rangeStart = seg;
          rangeEnd = seg;
        }
      }
      ranges.push({ start: rangeStart, end: rangeEnd });
    }

    return ranges.map((range, idx) => {
      const startPercent = (range.start / transcodeStatus.totalExpectedSegments!) * 100;
      const widthPercent = ((range.end - range.start + 1) / transcodeStatus.totalExpectedSegments!) * 100;
      return (
        <div
          key={idx}
          className="absolute h-full bg-green-600/50"
          style={{ 
            left: `${startPercent}%`,
            width: `${widthPercent}%` 
          }}
        />
      );
    });
  };

  const playProgress = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;

  // Handle backdrop click to close
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only close if clicking directly on the backdrop, not on children
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-2"
      onClick={handleBackdropClick}
    >
      <div className="bg-slate-800 rounded-lg shadow-2xl w-full h-full max-w-[98vw] max-h-[98vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-slate-700 flex-shrink-0">
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
        <div className="bg-black relative flex-1 min-h-0 flex items-center justify-center">
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
            className="max-w-full max-h-full object-contain"
          />
        </div>

        {/* Custom Controls */}
        <div className="bg-slate-900 p-3 flex-shrink-0">
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
              {/* Transcoded segments (green) - can be non-contiguous */}
              {renderSegmentProgress()}
              
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
                  {transcodeStatus.segmentCount} segments
                  {transcodeStatus.totalExpectedSegments && 
                    ` / ${transcodeStatus.totalExpectedSegments}`}
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
              {transcodeStatus && transcodeStatus.minSegment >= 0 && (
                <span>
                  Segs {transcodeStatus.minSegment}-{transcodeStatus.maxSegment}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
