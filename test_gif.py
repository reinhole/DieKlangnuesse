from PIL import Image
import sys

def ascii_gif(path):
    print(f"\n--- {path} ---")
    try:
        img = Image.open(path).convert("RGBA")
        width, height = img.size
        for y in range(0, height, 2):
            row = ""
            for x in range(0, width, 2):
                r, g, b, a = img.getpixel((x, y))
                row += "#" if a > 128 else " "
            print(row)
    except Exception as e:
        print("Error:", e)

ascii_gif("sunnyland winter forest files/ENVIRONMENT/props-sliced/branche-left.gif")
ascii_gif("sunnyland winter forest files/ENVIRONMENT/props-sliced/branche-right.gif")
