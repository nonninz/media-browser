# Media Browser

A modern, full-stack media browsing and streaming application built with React Router v7 and TailwindCSS. Browse directories, view media files, and stream videos with an embedded player.

## Features

- 🗂️ Directory browsing with intuitive navigation
- 🎬 Video streaming with embedded player
- 🎯 Support for multiple video formats (MP4, WebM, OGG, MOV, AVI, MKV, M4V)
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
```

If not set, defaults to `/` (system root).

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

The application currently supports directly streamable formats:
- MP4 (`.mp4`, `.m4v`)
- WebM (`.webm`)
- OGG (`.ogg`)
- MOV (`.mov`)
- AVI (`.avi`)
- MKV (`.mkv`)

*Note: FFmpeg transcoding support is planned for the second iteration*

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

- [ ] FFmpeg integration for on-the-fly transcoding
- [ ] Support for additional media formats
- [ ] Image gallery view
- [ ] Search functionality
- [ ] Favorites/bookmarks
- [ ] Playlist support

---

Built with ❤️ using React Router.
