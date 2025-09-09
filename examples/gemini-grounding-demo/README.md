# Enhanced Grounding with Image Cropping

This project demonstrates how image cropping can significantly enhance object detection grounding accuracy of Gemini 2.5 pro/flash. Our refinement approach improves the grounding process by focusing on smaller, more unified image regions.

## How It Works

The enhanced grounding process works in two stages:

1. **Full Image Detection**: Demonstrates poor grounding results on the complete screenshot
2. **Refined Cropping & Re-detection**: Crop the image into overlapping regions and re-run detection for dramatically improved accuracy

## Setup

Create a `.env` file with your Gemini API key:

```
GEMINI_API_KEY=your_api_key_here
```

## Usage

### Step 1: Initial Detection

```bash
uv run main.py detect screenshot.png
```

Check results in `screenshot_anno.png`

### Step 2: Enhanced Grounding via Cropping

```bash
uv run main.py crop screenshot.png
```

### Step 3: Re-detection on Cropped Regions

```bash
uv run main.py detect screenshot_crop_0.png
```

Check enhanced results in `screenshot_crop_0_anno.png`
