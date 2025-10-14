# Media Browser - Setup Guide

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Media Directory

Create a `.env` file in the project root (optional):
```bash
MEDIA_ROOT=/path/to/your/media/folder
```

Or set the environment variable directly:
```bash
export MEDIA_ROOT=/path/to/your/media/folder
```

**Default:** If not set, `MEDIA_ROOT` defaults to `/` (system root)

### 3. Run Development Server
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### 4. Test with Sample Media

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

### Supported Video Formats

Currently supports directly streamable formats:
- MP4 (`.mp4`, `.m4v`)
- WebM (`.webm`)
- OGG (`.ogg`)
- QuickTime (`.mov`)
- AVI (`.avi`)
- Matroska (`.mkv`)

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
- Verify the video format is supported
- Check browser console for errors
- Ensure the video file is not corrupted
- Some formats may require transcoding (coming in future iteration)

### Directory Not Found
- Verify `MEDIA_ROOT` path exists
- Check that path is absolute, not relative
- Ensure no typos in the path

## Next Steps (Future Iterations)

Planned enhancements:
- FFmpeg integration for transcoding
- Support for additional video codecs
- Subtitle support
- Thumbnail generation
- Search functionality
- Playlist creation
- Mobile app optimization

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

