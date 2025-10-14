# Media Browser - Setup Guide

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Install FFmpeg (Required for Transcoding)

FFmpeg is required for on-the-fly video transcoding:

```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get install ffmpeg

# Windows
choco install ffmpeg
```

### 3. Configure Media Directory

Create a `.env` file in the project root (optional):
```bash
MEDIA_ROOT=/path/to/your/media/folder
TRANSCODE_CACHE_DIR=/tmp/media-browser-cache
```

Or set environment variables directly:
```bash
export MEDIA_ROOT=/path/to/your/media/folder
export TRANSCODE_CACHE_DIR=/tmp/media-browser-cache
```

**Defaults:**
- `MEDIA_ROOT` defaults to `/` (system root)
- `TRANSCODE_CACHE_DIR` defaults to `/tmp/media-browser-cache`

### 4. Run Development Server
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### 5. Test with Sample Media

For testing, you can use any directory with video files:
```bash
MEDIA_ROOT=~/Movies npm run dev
```

## Application Structure

### Routes

- **`/`** - Main file browser interface
- **`/browse/*`** - API endpoint for directory browsing (not used in current implementation)
- **`/stream/*`** - API endpoint for video streaming

### Features Implemented

✅ Directory navigation with breadcrumb trail  
✅ File listing with icons and file sizes  
✅ Video file detection and streaming  
✅ Embedded video player with controls  
✅ Range request support for video seeking  
✅ Security: Path traversal protection  
✅ Responsive UI with TailwindCSS  
✅ **HLS-based on-the-fly video transcoding with FFmpeg**  
✅ **Smart segment caching for transcoded videos**  
✅ **Instant playback start (no waiting for full transcode)**  
✅ **Full seeking support in transcoded videos**  

### Supported Video Formats

**Browser-native formats** (streamed directly):
- MP4 (`.mp4`)
- WebM (`.webm`)

**Auto-transcoded formats** (converted on-the-fly to HLS):
- AVI (`.avi`)
- MKV (`.mkv`)
- MOV (`.mov`)
- M4V (`.m4v`)
- FLV (`.flv`)
- WMV (`.wmv`)

**HLS Transcoding Benefits:**
- Playback starts in 1-2 seconds (no waiting for full transcode)
- Perfect seeking/skipping support
- Segments cached for faster subsequent playback
- Works with all modern browsers via HLS.js

## Usage Examples

### Local Development
```bash
# Use default root directory
npm run dev

# Use specific media directory
MEDIA_ROOT=~/Videos npm run dev
```

### Production Build
```bash
npm run build
MEDIA_ROOT=/mnt/media npm run start
```

### Docker
```bash
# Build image
docker build -t media-browser .

# Run with volume mount
docker run -p 3000:3000 \
  -v /path/to/media:/media \
  -e MEDIA_ROOT=/media \
  media-browser
```

## UI Features

### Navigation
- Click folders to descend into subdirectories
- Use "Back" button or breadcrumb navigation to go up
- Breadcrumbs show current path and allow jumping to any parent directory

### Video Playback
- Click any video file to open the embedded player
- Player supports:
  - Play/pause
  - Volume control
  - Seek/scrub through video
  - Fullscreen mode
- Close player with X button or ESC key

### File Display
- Folders show with blue folder icon
- Video files show with purple play icon and "VIDEO" badge
- Image files show with green image icon and "IMAGE" badge
- File sizes displayed for all files

## Troubleshooting

### Permission Errors
If you see "Permission denied" errors:
- Ensure the application has read access to `MEDIA_ROOT`
- Check file/folder permissions with `ls -la`

### Videos Not Playing
- Verify FFmpeg is installed (`ffmpeg -version`)
- Check browser console for errors
- Ensure the video file is not corrupted
- Check server logs for transcoding errors
- Verify `TRANSCODE_CACHE_DIR` is writable

### Directory Not Found
- Verify `MEDIA_ROOT` path exists
- Check that path is absolute, not relative
- Ensure no typos in the path

## Next Steps (Future Iterations)

Completed:
- ✅ FFmpeg integration for HLS transcoding
- ✅ Support for additional video codecs
- ✅ Instant playback with segment-based streaming
- ✅ Full seeking support in transcoded videos

Planned enhancements:
- Adaptive bitrate streaming (multiple quality levels)
- Subtitle support
- Thumbnail generation
- Search functionality
- Playlist creation
- Mobile app optimization
- Cache cleanup scheduler

## Security Notes

The application includes several security measures:
- Path normalization to prevent directory traversal
- Validation that all paths remain within `MEDIA_ROOT`
- Hidden file filtering (files starting with `.`)
- No write/delete operations (read-only)

## Development Tips

### Type Checking
```bash
npm run typecheck
```

### Hot Reload
The dev server supports hot module replacement - changes to React components will reload automatically without losing state.

### Debugging
- Server logs appear in the terminal running `npm run dev`
- Client logs appear in browser developer console
- Network tab useful for debugging streaming issues

---

For more information, see the main [README.md](README.md)

