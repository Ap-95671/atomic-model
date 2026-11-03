"""Default advanced local app; QAL_MODE=public selects the production gateway."""
import os

if __name__ == "__main__":
    mode=os.getenv('QAL_MODE','local')
    if mode=='public':
        from backend.production import main as serve
    elif mode=='local':
        from backend.server import serve
    else:
        raise ValueError('QAL_MODE must be local or public')
    serve()
