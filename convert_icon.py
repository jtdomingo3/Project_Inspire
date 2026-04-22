#!/usr/bin/env python3
from PIL import Image
import sys

try:
    input_path = r'frontend\public\icon.png'
    output_path = r'frontend\public\favicon.ico'

    # Open the image
    img = Image.open(input_path)
    print(f"Original image size: {img.size}, mode: {img.mode}")

    # Convert to RGB if it has alpha channel
    if img.mode in ('RGBA', 'LA', 'P'):
        # Create white background
        background = Image.new('RGB', img.size, (255, 255, 255))
        if img.mode == 'RGBA':
            background.paste(img, mask=img.split()[-1])
        else:
            background.paste(img)
        img = background
        print("Converted to RGB")

    # Resize to standard favicon sizes
    sizes = [(16, 16), (32, 32), (48, 48), (64, 64)]
    img_resized = [img.resize(size, Image.Resampling.LANCZOS) for size in sizes]

    # Save as ICO
    img_resized[0].save(output_path, format='ICO', sizes=sizes)

    print(f"✓ Successfully converted {input_path} to ICO")
    print(f"✓ Saved as {output_path}")
    print(f"✓ Icon sizes included: {sizes}")
    sys.exit(0)
except Exception as e:
    print(f"✗ Error: {e}", file=sys.stderr)
    sys.exit(1)
