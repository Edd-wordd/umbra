"""Local synthetic smoke benchmark. Usage: python3 scripts/benchmark-voice.py [endpoint]
Uses macOS say, not microphone recordings. Compare runs against different model servers.
"""
import json, subprocess, sys, tempfile, time
from pathlib import Path

endpoint = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8178/inference'
phrases = ['Open Proxmox', 'Open AdGuard', 'Show my Lab', 'Show Knowledge', 'What needs my attention', 'What changed', 'Show approvals']
with tempfile.TemporaryDirectory() as directory:
    for phrase in phrases:
        audio = str(Path(directory) / 'speech.wav')
        subprocess.run(['say', '-o', audio, '--file-format=WAVE', '--data-format=LEI16@16000', phrase], check=True)
        start = time.monotonic()
        result = subprocess.run(['curl', '-fsS', '--max-time', '60', endpoint, '-F', 'file=@' + audio, '-F', 'response_format=json', '-F', 'prompt=Umbra, Proxmox, AdGuard, n8n, Obsidian. Lab, Knowledge, Dev, Ops.'], capture_output=True, text=True, check=True)
        transcript = json.loads(result.stdout)['text'].strip()
        normalize = lambda text: ''.join(c.lower() for c in text if c.isalnum())
        print(json.dumps({'phrase': phrase, 'transcript': transcript, 'exact_normalized': normalize(phrase) == normalize(transcript), 'seconds': round(time.monotonic() - start, 2)}), flush=True)
