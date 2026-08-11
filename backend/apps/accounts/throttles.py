from rest_framework.throttling import SimpleRateThrottle


class AuthRateThrottle(SimpleRateThrottle):
    scope = "auth"

    def get_cache_key(self, request, view):
        ident = self.get_ident(request)
        username = str(request.data.get("username", "")).strip().lower()
        return self.cache_format % {
            "scope": self.scope,
            "ident": f"{ident}:{username}",
        }


class PasswordResetRateThrottle(SimpleRateThrottle):
    scope = "password_reset"

    def get_cache_key(self, request, view):
        return self.cache_format % {
            "scope": self.scope,
            "ident": self.get_ident(request),
        }

