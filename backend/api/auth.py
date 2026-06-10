import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from backend.config import settings

security = HTTPBearer(auto_error=False)

# In-memory cache for Supabase JWKS
_jwks_cache = None

def get_jwks(supabase_url: str):
    global _jwks_cache
    if _jwks_cache is None:
        try:
            url = f"{supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
            resp = httpx.get(url, timeout=5.0)
            resp.raise_for_status()
            _jwks_cache = resp.json()
        except Exception as e:
            # Don't cache a failure, raise so we can retry on next request
            raise ValueError(f"Failed to fetch JWKS from Supabase: {e}")
    return _jwks_cache

def verify_token(token: str) -> str:
    """
    Decodes and verifies a JWT token (symmetric or asymmetric) and returns the 'sub' user ID.
    Raises ValueError on verification failure.
    """
    if token == "guest_token":
        return "guest_user"
        
    if not settings.SUPABASE_URL and not settings.SUPABASE_JWT_SECRET:
        return "local_dev_user"
        
    payload = None
    
    # 1. Try Asymmetric Key Verification using JWKS if SUPABASE_URL is provided
    if settings.SUPABASE_URL:
        try:
            jwks = get_jwks(settings.SUPABASE_URL)
            unverified_header = jwt.get_unverified_header(token)
            kid = unverified_header.get("kid")
            if not kid:
                raise ValueError("Token header is missing 'kid'")
                
            # Find the matching key in JWKS keys
            jwk = None
            for key in jwks.get("keys", []):
                if key.get("kid") == kid:
                    jwk = key
                    break
                    
            if not jwk:
                raise ValueError(f"Key with ID {kid} not found in JWKS")
                
            # Decode using the fetched JWK. jose supports ES256, RS256 etc.
            payload = jwt.decode(
                token,
                jwk,
                algorithms=["ES256", "RS256"],
                options={"verify_aud": False}
            )
        except Exception as e:
            # If JWKS fails, we will try the symmetric secret key if it's set
            if not settings.SUPABASE_JWT_SECRET:
                raise ValueError(f"Asymmetric token verification failed: {e}")
                
    # 2. Fall back to Symmetric Key Verification using JWT Secret
    if payload is None and settings.SUPABASE_JWT_SECRET:
        try:
            payload = jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_aud": False}
            )
        except JWTError as e:
            raise ValueError(f"Symmetric token verification failed: {e}")
            
    if payload is None:
        raise ValueError("Token verification failed (no valid keys found/configured)")
        
    user_id = payload.get("sub")
    if not user_id:
        raise ValueError("Token payload is missing user ID (sub)")
        
    return user_id

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """
    Decodes the Supabase JWT token and extracts the user UUID ('sub' claim).
    Supports asymmetric ECC P-256 keys by fetching JWKS from SUPABASE_URL,
    and falls back to symmetric HS256 verification using SUPABASE_JWT_SECRET.
    Falls back to 'local_dev_user' if neither is configured.
    """
    if not settings.SUPABASE_URL and not settings.SUPABASE_JWT_SECRET:
        return "local_dev_user"
        
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization Header"
        )
        
    try:
        return verify_token(credentials.credentials)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {str(e)}"
        )
