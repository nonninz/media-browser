import { useEffect, useRef, useState } from "react";

interface NativeVideoPlayerProps {
  src: string;
  title: string;
  onClose: () => void;
}

export function NativeVideoPlayer({ src, title, onClose }: NativeVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

    const handleCanPlay = () => {
      console.log("[Native Player] Video can play");
      setLoading(false);
      setError(null);
    };

    const handleError = (e: Event) => {
      console.error("[Native Player] Video error:", e);
      setError("Failed to load video");
      setLoading(false);
    };

    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("error", handleError);

    // Set source
    video.src = src;
    console.log("[Native Player] Initialized with source:", src);

    return () => {
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("error", handleError);
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
          {error && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
              <div className="text-red-400 text-sm bg-slate-900/90 px-4 py-2 rounded-lg">
                {error}
              </div>
            </div>
          )}
          <video
            ref={videoRef}
            className="max-w-full max-h-full object-contain"
            preload="metadata"
            controls
            autoPlay
          />
        </div>
      </div>
    </div>
  );
}

