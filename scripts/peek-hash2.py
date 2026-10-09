from pathlib import Path

text = Path("node_modules/@dcloudio/uni-cloud/dist/uni-cloud.es.js").read_text(encoding="utf-8")
print(text[22300:22800])
print("--- hmac ---")
i = text.find("function Ie")
print("Ie", i)
print(text[i:i+250] if i >= 0 else "")
print("Ie=", text.find("Ie="))
