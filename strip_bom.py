import sys

if len(sys.argv) < 2:
    print("Usage: python strip_bom.py <filename>")
    sys.exit(1)

filename = sys.argv[1]

with open(filename, "rb") as f:
    data = f.read()

# Check if it starts with the UTF-8 BOM
bom = b"\xef\xbb\xbf"
if data.startswith(bom):
    print("BOM found, removing...")
    data = data[len(bom):]
    with open(filename, "wb") as f:
        f.write(data)
    print("BOM removed successfully.")
else:
    print("No BOM found. File is unchanged.")
