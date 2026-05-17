with open("src/pages/Admin.tsx", "r") as f:
    content = f.read()

idx = content.find("const handleAssign =")
if idx != -1:
    print(content[idx:idx+3000])
