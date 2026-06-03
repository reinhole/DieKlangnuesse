import tkinter as tk
import os

root = tk.Tk()
root.withdraw()

dir_path = os.path.join(os.path.dirname(__file__), '..', 'Sunny-land-woods-files', 'Assets', 'ENVIRONMENT')
files = ['bg-clouds.png', 'bg-mountains.png', 'bg-trees.png']

for file in files:
    filepath = os.path.join(dir_path, file)
    if not os.path.exists(filepath):
        continue
    img = tk.PhotoImage(file=filepath)
    width = img.width()
    height = img.height()
    
    total_pixels = width * height
    transparent_count = 0
    for y in range(height):
        for x in range(width):
            if img.transparency_get(x, y):
                transparent_count += 1
                
    print(f"{file}: transparent pixels: {transparent_count}/{total_pixels} ({transparent_count/total_pixels*100:.1f}%)")
