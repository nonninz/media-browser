#!/bin/bash

# Media Browser Development Script
# This script helps you start the development server with custom media directory

# Default media root
DEFAULT_MEDIA_ROOT="/"

# Check if argument provided
if [ -n "$1" ]; then
    MEDIA_ROOT="$1"
else
    # Check if MEDIA_ROOT is set in environment
    if [ -z "$MEDIA_ROOT" ]; then
        MEDIA_ROOT="$DEFAULT_MEDIA_ROOT"
    fi
fi

# Expand tilde to home directory
MEDIA_ROOT="${MEDIA_ROOT/#\~/$HOME}"

# Check if directory exists
if [ ! -d "$MEDIA_ROOT" ]; then
    echo "⚠️  Warning: Directory '$MEDIA_ROOT' does not exist!"
    echo "   The application may not work correctly."
    echo ""
fi

echo "🎬 Starting Media Browser"
echo "📁 Media Root: $MEDIA_ROOT"
echo "🌐 Server will be available at: http://localhost:5173"
echo ""

# Start the development server
MEDIA_ROOT="$MEDIA_ROOT" npm run dev

