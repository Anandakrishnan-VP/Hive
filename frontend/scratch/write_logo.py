import os
import xml.etree.ElementTree as ET

svg_path = r"d:\DevAk\hive logo new.svg"
if not os.path.exists(svg_path):
    svg_path = "hive logo new.svg"

# Map XML attributes to JSX camelCase
attr_map = {
    'fill-opacity': 'fillOpacity',
    'stroke-width': 'strokeWidth',
    'stroke-linecap': 'strokeLinecap',
    'stroke-linejoin': 'strokeLinejoin',
    'stroke-opacity': 'strokeOpacity',
    'stroke-dasharray': 'strokeDasharray',
    'stroke-dashoffset': 'strokeDashoffset',
    'clip-path': 'clipPath',
    'clip-rule': 'clipRule',
    'fill-rule': 'fillRule',
}

def clean_attrs(attrs):
    res = []
    for k, v in attrs.items():
        # Map to JSX name
        jsx_name = attr_map.get(k, k)
        res.append(f'{jsx_name}="{v}"')
    return ' '.join(res)

tree = ET.parse(svg_path)
root = tree.getroot()

# Find viewBox
viewbox = root.get('viewBox', '0 0 1123 933')

ns = {'svg': 'http://www.w3.org/2000/svg'}
paths = root.findall('.//svg:path', ns)
if not paths:
    paths = root.findall('.//path')

react_paths = []
for path in paths:
    attrs = dict(path.attrib)
    # Extract d attribute
    d = attrs.pop('d', '')
    fill = attrs.get('fill', '')
    
    # Check if this is a dark background cutout/silhouette path
    if fill == '#000201':
        attrs_str = clean_attrs(attrs)
        # We can hide it if hideBackgroundPath is true
        react_paths.append(f'        {{!hideBackgroundPath && <path d="{d}" {attrs_str} />}}')
    else:
        # Check if it's one of the kiwi accent colors and we want it to inherit currentColor.
        # But wait! If we make it currentColor, we lose the subtle tone differences in the SVG.
        # So we should keep the exact fill, but if the user wants to override, they can.
        # Let's keep the exact fill from Figma so the colors are perfect, but if they set currentColor we can allow that.
        # To make it dynamic, we can check if fill is kiwi green and replace it only if needed.
        # For now, let's keep the exact Figma colors!
        attrs_str = clean_attrs(attrs)
        react_paths.append(f'        <path d="{d}" {attrs_str} />')

tsx_content = f"""import React from "react";

interface LogoProps extends React.SVGProps<SVGSVGElement> {{
  className?: string;
  hideBackgroundPath?: boolean;
}}

export function Logo({{ className, hideBackgroundPath = false, ...props }}: LogoProps) {{
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="{viewbox}"
      className={{className}}
      {{...props}}
    >
      <g>
{chr(10).join(react_paths)}
      </g>
    </svg>
  );
}}
"""

dest_path = r"d:\DevAk\hive\frontend\components\Logo.tsx"
with open(dest_path, 'w', encoding='utf-8') as f:
    f.write(tsx_content)

print(f"Successfully generated {dest_path} with {len(paths)} paths.")
