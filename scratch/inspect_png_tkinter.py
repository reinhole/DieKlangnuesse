import tkinter as tk
import os

root = tk.Tk()
# Hide the main window
root.withdraw()

dir_path = os.path.join(os.path.dirname(__file__), '..', 'Sunny-land-woods-files', 'Assets', 'ENVIRONMENT')
files = ['bg-clouds.png', 'bg-mountains.png', 'bg-trees.png']

for file in files:
    filepath = os.path.join(dir_path, file)
    if not os.path.exists(filepath):
        print(f"{file} does not exist")
        continue
    
    # Load PNG using PhotoImage
    img = tk.PhotoImage(file=filepath)
    width = img.width()
    height = img.height()
    
    # Check top row (y = 0)
    top_pixels = []
    transparent_count = 0
    for x in range(width):
        try:
            # tkinter transparency check
            is_trans = img.transparency_get(x, 0)
            if is_trans:
                transparent_count += 1
            else:
                rgb = img.get(x, 0)
                top_pixels.append(rgb)
        except Exception as e:
            # some versions might not support transparency_get or get
            pass
            
    print(f"{file}: {width}x{height}, transparent count on top row: {transparent_count}/{width}")
    if len(top_pixels) > 0:
        print(f"  First few opaque pixels on top row: {list(set(top_pixels))[:5]}")
