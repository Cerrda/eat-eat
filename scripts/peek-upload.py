from pathlib import Path

text = Path("node_modules/@dcloudio/uni-cloud/dist/uni-cloud.es.js").read_text(encoding="utf-8")
needle = '=class{constructor(e){if(["spaceId","spaceAppId"'
i = text.find(needle)
print("class", i)
j = text.find("uploadFile(", i)
print("upload", j)
print(text[j:j + 2800])
