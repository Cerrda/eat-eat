from pathlib import Path

text = Path("node_modules/@dcloudio/uni-cloud/dist/uni-cloud.es.js").read_text(encoding="utf-8")
i = text.find("function we(")
if i < 0:
    i = text.find("we=function")
print("we", i)
print(text[i:i+400] if i >= 0 else "missing")
print("--- sha names ---")
for name in ["function we", "var we", "we=", "SHA256", "enc.Hex"]:
    print(name, text.find(name))
