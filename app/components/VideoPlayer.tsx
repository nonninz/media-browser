interface VideoPlayerProps {
  src: string;
  title: string;
  onClose: () => void;
}

export function VideoPlayer({ src, title, onClose }: VideoPlayerProps) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
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
        <div className="bg-black">
          <video
            controls
            autoPlay
            className="w-full h-auto max-h-[calc(90vh-80px)]"
            src={src}
          >
            Your browser does not support the video tag.
          </video>
        </div>
      </div>
    </div>
  );
}

