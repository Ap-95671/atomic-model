"""Bounded healthcheck wait for a local container, using the standard library."""
from http.client import HTTPException
import sys
import time
from urllib.request import urlopen
from urllib.error import URLError
for _ in range(60):
    try:
        with urlopen(sys.argv[1],timeout=2) as response:
            if response.status==200:break
    except (OSError,HTTPException):pass
    time.sleep(1)
else:raise SystemExit('Public server did not become ready in 60 seconds')
