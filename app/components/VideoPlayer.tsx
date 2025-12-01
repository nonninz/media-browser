import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

interface VideoPlayerProps {
  src: string;
  title: string;
  onClose: () => void;
}

// Helper to extract video path from stream URL
function extractVideoPath(src: string): string | null {
  const match = src.match(/^\/stream\/(.+)$/);
  return match ? match[1] : null;
}

// Helper to stop transcoding on the server
async function stopTranscodingForVideo(videoPath: string) {
  try {
    await fetch("/stop-transcode", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ path: videoPath }),
    });
  } catch (error) {
    console.error("Failed to stop transcoding:", error);
  }
}

export function VideoPlayer({ src, title, onClose }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setLoading(true);
    setError(null);

    // Detect if source is HLS by fetching and checking Content-Type
    const initializePlayer = async () => {
      try {
        // Fetch the source to check Content-Type
        const response = await fetch(src, { method: 'HEAD' });
        const contentType = response.headers.get('Content-Type') || '';
        
        const isHLS = contentType.includes('mpegurl') || 
                      contentType.includes('m3u8') || 
                      src.includes('.m3u8') || 
                      src.includes('/hls/');

        console.log(`Video source: ${src}, Content-Type: ${contentType}, isHLS: ${isHLS}`);

        if (isHLS) {
          // Use HLS.js for HLS streams
          if (Hls.isSupported()) {
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
              console.log("HLS manifest loaded, starting playback");
              setLoading(false);
              video.play().catch((err) => {
                console.warn("Autoplay failed:", err);
              });
            });

            hls.on(Hls.Events.ERROR, (event, data) => {
              console.error("HLS error:", data);
              
              if (data.fatal) {
                switch (data.type) {
                  case Hls.ErrorTypes.NETWORK_ERROR:
                    console.error("Fatal network error, trying to recover", data.details);
                    setError(`Network error: ${data.details}. Retrying...`);
                    setTimeout(() => {
                      hls.startLoad();
                    }, 1000);
                    break;
                  case Hls.ErrorTypes.MEDIA_ERROR:
                    console.error("Fatal media error, trying to recover", data.details);
                    setError(`Media error: ${data.details}. Retrying...`);
                    hls.recoverMediaError();
                    break;
                  default:
                    console.error("Fatal error, cannot recover", data.details);
                    setError(`Failed to load video: ${data.details || data.type}`);
                    hls.destroy();
                    break;
                }
              } else {
                // Non-fatal errors
                console.warn("Non-fatal HLS error:", data.type, data.details);
              }
            });

            hls.on(Hls.Events.FRAG_LOADED, () => {
              // Clear error when fragments load successfully
              setError(null);
            });
          } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
            // Native HLS support (Safari)
            video.src = src;
            video.addEventListener("loadedmetadata", () => {
              setLoading(false);
              video.play().catch((err) => {
                console.warn("Autoplay failed:", err);
              });
            });
            video.addEventListener("error", () => {
              setError("Failed to load video");
              setLoading(false);
            });
          } else {
            setError("HLS not supported in this browser");
            setLoading(false);
          }
        } else {
          // Native video playback for non-HLS sources
          video.src = src;
          video.addEventListener("loadedmetadata", () => {
            setLoading(false);
          });
          video.addEventListener("error", () => {
            setError("Failed to load video");
            setLoading(false);
          });
        }
      } catch (error) {
        console.error("Error detecting video type:", error);
        // Fallback to native player
        video.src = src;
        video.addEventListener("loadedmetadata", () => {
          setLoading(false);
        });
        video.addEventListener("error", () => {
          setError("Failed to load video");
          setLoading(false);
        });
      }
    };

    initializePlayer();

    // Cleanup
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      
      // Stop transcoding on the server when component unmounts
      const videoPath = extractVideoPath(src);
      if (videoPath) {
        stopTranscodingForVideo(videoPath);
      }
    };
  }, [src]);

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
        <div className="flex items-center justify-between p-3 border-b border-slate-700 flex-shrink-0">
          <h2 className="text-lg font-semibold text-white truncate flex-1 mr-4">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-slate-700"
            aria-label="Close video player"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="bg-black relative flex-1 min-h-0 flex items-center justify-center">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="text-white text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                <p>Loading video...</p>
              </div>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="text-red-400 text-center bg-slate-900/80 p-6 rounded-lg">
                <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p>{error}</p>
              </div>
            </div>
          )}
          <video
            ref={videoRef}
            controls
            className="max-w-full max-h-full object-contain"
          >
            Your browser does not support the video tag.
          </video>
        </div>
      </div>
    </div>
  );
}
