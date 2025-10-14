# Media Browser

A modern, full-stack media browsing and streaming application built with React Router v7 and TailwindCSS. Browse directories, view media files, and stream videos with an embedded player.

## Features

- 🗂️ Directory browsing with intuitive navigation
- 🎬 Video streaming with embedded player
- 🎯 Support for multiple video formats (MP4, WebM, OGG, MOV, AVI, MKV, M4V)
- 🔄 **On-the-fly video transcoding** for incompatible formats using FFmpeg
- 💾 Smart caching system for transcoded videos
- 🔒 Secure path traversal prevention
- 📱 Responsive design with modern UI
- ⚡ Range request support for video seeking
- 🎨 Beautiful TailwindCSS styling

## Getting Started

### Installation

Install the dependencies:

```bash
npm install
```

### Configuration

Set the media root directory via environment variable:

```bash
export MEDIA_ROOT=/path/to/your/media/folder
```

Or create a `.env` file:

```env
MEDIA_ROOT=/path/to/your/media/folder
TRANSCODE_CACHE_DIR=/tmp/media-browser-cache
```

**Environment Variables:**
- `MEDIA_ROOT` - Root directory for media files (default: `/`)
- `TRANSCODE_CACHE_DIR` - Directory for storing transcoded video cache (default: `/tmp/media-browser-cache`)

If not set, defaults will be used.

### Development

Start the development server with HMR:

```bash
npm run dev
```

Your application will be available at `http://localhost:5173`.

## Usage

1. Navigate to the application in your browser
2. Browse directories by clicking on folder names
3. Click on video files to play them in the embedded player
4. Use the breadcrumb navigation or back button to navigate up the directory tree

### Supported Video Formats

The application supports all major video formats:

**Browser-native formats** (streamed directly):
- MP4 (`.mp4`)
- WebM (`.webm`)

**Auto-transcoded formats** (converted on-the-fly using FFmpeg):
- AVI (`.avi`)
- MKV (`.mkv`)
- MOV (`.mov`)
- M4V (`.m4v`)
- FLV (`.flv`)
- WMV (`.wmv`)

*Transcoded videos are cached to improve subsequent playback performance*

### FFmpeg Requirement

**Important:** FFmpeg must be installed on the system for transcoding to work:

```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get install ffmpeg

# Windows
choco install ffmpeg
```

## Building for Production

Create a production build:

```bash
npm run build
```

Start the production server:

```bash
npm run start
```

## Deployment

### Docker Deployment

To build and run using Docker:

```bash
docker build -t media-browser .

# Run the container with media folder mounted
docker run -p 3000:3000 -v /your/media/path:/media -e MEDIA_ROOT=/media media-browser
```

### Environment Variables

- `MEDIA_ROOT` - Root directory for media files (default: `/`)
- `TRANSCODE_CACHE_DIR` - Directory for storing transcoded video cache (default: `/tmp/media-browser-cache`)

## Security

The application includes security measures to prevent directory traversal attacks. All requested paths are normalized and validated to ensure they remain within the configured `MEDIA_ROOT`.

## Technology Stack

- 🚀 React Router v7 (Server-side rendering)
- ⚡️ Vite (Hot Module Replacement)
- 🎨 TailwindCSS v4 (Styling)
- 📦 TypeScript (Type safety)
- 🎬 Native HTML5 Video Player

## Project Structure

```
├── app/
│   ├── routes/
│   │   ├── home.tsx        # Main file browser UI
│   │   ├── browse.tsx      # Directory browsing API
│   │   └── stream.tsx      # Video streaming API
│   ├── root.tsx            # Root layout
│   └── routes.ts           # Route configuration
├── public/                 # Static assets
└── README.md
```

## Future Enhancements

- [x] FFmpeg integration for on-the-fly transcoding
- [x] Support for additional media formats
- [ ] Image gallery view
- [ ] Search functionality
- [ ] Favorites/bookmarks
- [ ] Playlist support
- [ ] Cache cleanup scheduler
- [ ] Transcoding progress indicator

---

Built with ❤️ using React Router.
