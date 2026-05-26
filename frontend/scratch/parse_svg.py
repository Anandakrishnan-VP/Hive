import re
import os
import xml.etree.ElementTree as ET

svg_path = r"d:\DevAk\hive logo new.svg"
if not os.path.exists(svg_path):
    # Try alternate paths
    svg_path = "hive logo new.svg"

print(f"Reading from {svg_path}...")

tree = ET.parse(svg_path)
root = tree.getroot()

# Namespaces
ns = {'svg': 'http://www.w3.org/2000/svg'}

# Find all path elements
paths = root.findall('.//svg:path', ns)
if not paths:
    # Try finding without namespace
    paths = root.findall('.//path')

print(f"Found {len(paths)} paths.")

react_paths = []
for i, path in enumerate(paths):
    d = path.get('d')
    fill = path.get('fill', '')
    transform = path.get('transform', '')
    
    # We want to replace lime green fills (#BCF108, #BDF20A) with currentColor
    # And black fills (#000201) with something appropriate, or keep them black.
    # The user said: "the left place logo of hive console which right now has a some emoji or icon shape"
    # and "I just want you to use that svg logo dont include those weird animation and all"
    # Let's inspect the fills.
    is_accent = False
    if fill.upper() in ['#BCF108', '#BDF20A', '#BDF200', '#CCFF00']:
        is_accent = True
        
    fill_attr = 'fill="currentColor"' if is_accent else f'fill="{fill}"'
    transform_attr = f' transform="{transform}"' if transform else ''
    
    # Render path tag
    # If the path is a background silhouette (black/negative space), we can hide it on demand or keep it.
    if fill == '#000201':
        # This is a background/silhouette cutout
        react_paths.append(f'        {{!hideBackgroundPath && <path d="{d}" fill="black"{transform_attr} />}}')
    else:
        react_paths.append(f'        <path d="{d}" {fill_attr}{transform_attr} />')

print("\n--- TSX CODE ---")
print('\n'.join(react_paths))
