"""
Modal deployment wrapper for the CleanTech RAG FastAPI backend.

This does not change any RAG/agent logic at all — it reuses api.py and
backend.py exactly as already built and tested locally. It just tells Modal
how to build the container, where chroma_db lives (a persistent Modal
Volume, uploaded once via the CLI), and which secrets to inject.

One-time setup (see DEPLOY_MODAL.md for the full walkthrough):
    pip install modal
    modal setup
    modal volume create cleantech-chroma-db
    modal volume put cleantech-chroma-db ./chroma_db /
    # create a Modal Secret named "cleantech-secrets" with OPENAI_API_KEY
    # and BACKEND_API_KEY via the dashboard (modal.com -> Secrets)

Deploy with:
    modal deploy modal_app.py
"""

import modal

app = modal.App("cleantech-rag-api")

# Persistent storage for chroma_db. Populated once via the CLI (see above),
# not rebuilt on every deploy — deploys stay fast even though the data is 2GB+.
volume = modal.Volume.from_name("cleantech-chroma-db", create_if_missing=True)

# Where the volume is mounted inside the container. backend.py reads this
# path from the CHROMA_DIR env var, set below before it's imported.
CHROMA_MOUNT = "/chroma_db"

image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install_from_requirements("requirements.txt")
    # Local source is added last, per Modal convention — these two files are
    # the whole app; everything else comes from requirements.txt.
    .add_local_file("backend.py", "/root/backend.py")
    .add_local_file("api.py", "/root/api.py")
)

secrets = [modal.Secret.from_name("cleantech-secrets")]


@app.function(
    image=image,
    volumes={CHROMA_MOUNT: volume},
    secrets=secrets,
    cpu=2,
    memory=2048,  # MB — comfortably more than the ~1GB resident vector index needs
    scaledown_window=300,  # keep a container warm for 5 min after the last request,
    # so back-to-back questions don't each pay the vector-store-load cost.
    # Lower this to save credit if traffic is very sparse; raise it (or add
    # min_containers=1) if you want to eliminate cold starts entirely, which
    # costs continuously and will use free credit faster.
    timeout=120,
)
@modal.asgi_app()
def fastapi_app():
    import os
    import sys

    # Must be set before `from api import app`, since backend.py reads
    # CHROMA_DIR at module import time, not lazily inside a function.
    # Note: the volume upload nested the data one level deeper than the
    # mount point (modal volume put ... / put the chroma_db folder itself
    # at the volume root, not just its contents) — hence the extra segment.
    os.environ["CHROMA_DIR"] = f"{CHROMA_MOUNT}/chroma_db"
    sys.path.insert(0, "/root")

    from api import app as fastapi_application

    return fastapi_application
