import hashlib
import hmac
import json
import mimetypes
import time
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = ROOT / ".env.unicloud.local"


def read_env() -> dict[str, str]:
    env: dict[str, str] = {}
    for line in ENV_FILE.read_text(encoding="utf-8-sig").splitlines():
        trimmed = line.strip()
        if not trimmed or trimmed.startswith("#") or "=" not in trimmed:
            continue
        key, value = trimmed.split("=", 1)
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def sha256_hex(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def sign_request(path: str, method: str, data, config: dict[str, str]) -> tuple[str, dict[str, str]]:
    timestamp = str(int(time.time() * 1000))
    request_id = str(uuid.uuid4())
    headers = {
        "x-alipay-cloud-mode": "oss",
        "x-data-api-type": "oss",
        "x-expire-timestamp": str(int(time.time() * 1000) + 60_000),
        "x-from-app-id": config["appId"],
        "x-from-env-id": config["spaceId"],
        "x-to-env-id": config["spaceId"],
        "x-from-instance-id": timestamp,
        "x-from-function-name": "",
        "x-client-timestamp": timestamp,
        "x-alipay-source": "client",
        "x-request-id": request_id,
        "x-alipay-callid": request_id,
        "x-trace-id": request_id,
    }
    signed = sorted([
        "x-from-app-id",
        "x-from-env-id",
        "x-to-env-id",
        "x-from-instance-id",
        "x-from-function-name",
        "x-client-timestamp",
        "x-data-api-type",
        "x-expire-timestamp",
    ])
    route, _, query = path.partition("?")
    body = b"" if data is None else json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode()
    canonical_headers = "".join(f"{name.lower()}:{headers[name]}\n" for name in signed)
    signed_names = ";".join(signed)
    hashed_body = sha256_hex(body)
    canonical = f"{method.upper()}\n{route}\n{query}\n{canonical_headers}\n{signed_names}\n{hashed_body}\n"
    hashed_canonical = sha256_hex(canonical.encode())
    string_to_sign = f"HMAC-SHA256\n{timestamp}\n{hashed_canonical}\n"
    signature = hmac.new(config["secret"].encode(), string_to_sign.encode(), hashlib.sha256).hexdigest()
    headers["Authorization"] = f"HMAC-SHA256 Credential={config['access']}, SignedHeaders={signed_names}, Signature={signature}"
    return f"{config['endpoint']}{path}", headers


def call(path: str, config: dict[str, str], method: str = "GET", data=None) -> dict:
    url, headers = sign_request(path, method, data, config)
    payload = None if data is None else json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode()
    if payload is not None:
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=payload, headers=headers, method=method)
    with urllib.request.urlopen(request, timeout=60) as response:
        raw = response.read()
    parsed = json.loads(raw.decode())
    if not parsed.get("success"):
        raise RuntimeError(parsed)
    return parsed.get("data") or {}


def encode_multipart(fields: dict[str, str], filename: str, content: bytes) -> tuple[bytes, str]:
    boundary = f"----eatfont{uuid.uuid4().hex}"
    chunks: list[bytes] = []
    for key, value in fields.items():
        chunks.append(
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"{key}\"\r\n\r\n{value}\r\n".encode()
        )
    mime = "font/woff2" if filename.endswith(".woff2") else (mimetypes.guess_type(filename)[0] or "application/octet-stream")
    chunks.append(
        (
            f"--{boundary}\r\n"
            f"Content-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\n"
            f"Content-Type: {mime}\r\n\r\n"
        ).encode()
        + content
        + b"\r\n"
    )
    chunks.append(f"--{boundary}--\r\n".encode())
    return b"".join(chunks), boundary


def upload(path: Path, cloud_path: str, config: dict[str, str]) -> str:
    ticket = call(f"/{cloud_path.lstrip('/')}?post_url", config)
    fields = {item["key"]: item["value"] for item in ticket["form_data"]}
    body, boundary = encode_multipart(fields, path.name, path.read_bytes())
    request = urllib.request.Request(
        ticket["upload_url"],
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=180) as response:
        status = response.status
        response.read()
    if status >= 400:
        raise RuntimeError(f"upload status {status}")
    file_id = ticket["file_id"]
    if str(file_id).startswith("cloud://"):
        return str(file_id)
    return f"cloud://{config['spaceId']}/{str(file_id).lstrip('/')}"


def main() -> None:
    env = read_env()
    config = {
        "spaceId": env["UNICLOUD_SPACE_ID"],
        "appId": env["UNICLOUD_SPACE_APP_ID"],
        "access": env["UNICLOUD_ACCESS_KEY"],
        "secret": env["UNICLOUD_SECRET_KEY"],
        "endpoint": f"https://{env['UNICLOUD_SPACE_ID']}.api-hz.cloudbasefunction.cn",
    }
    font_dir = ROOT / "tmp-fonts"
    names = [
        "ma-shan-zheng.woff2",
        "lxgw-wenkai.woff2",
        "lxgw-wenkai-medium.woff2",
        "long-cang.woff2",
    ]
    for name in names:
        file_id = upload(font_dir / name, f"eat/fonts/{name}", config)
        print(name, file_id)


if __name__ == "__main__":
    main()
