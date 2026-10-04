#!/usr/bin/env python3
"""Apply Fitr's public-site routing + Android-only gate to /etc/nginx/sites-available/fitr.

Idempotent. Keeps every certbot-managed line. fitr.day serves the public site (Next.js decides
what is public); app.fitr.day only serves the Fitr Android app (UA tokens) plus public assets.
"""
import sys

P = "/etc/nginx/sites-available/fitr"
s = open(P).read()

if "$fitr_browser_redirect" in s:
    print("already applied")
    sys.exit(0)

MAPS = r'''map $http_upgrade $fitr_connection_upgrade { default upgrade; "" close; }

# app.fitr.day is Android-only: the Fitr app sends these user-agent tokens.
map $http_user_agent $fitr_is_app { default 0; "~*(FitrApp/|Solana Mobile Web Shell)" 1; }
# Paths on app.fitr.day that stay reachable for anyone (App Link verification, assets, APIs).
map $uri $fitr_app_public {
    default 0;
    "~^/(\.well-known|_next|api|icons|art|brand|mediapipe)/" 1;
    "~^/(sw\.js|manifest\.webmanifest|favicon\.ico|icon\.png|apple-icon\.png)$" 1;
}
# Browsers hitting app pages go to the public site (crew links to the crew invite page).
map "$fitr_is_app$fitr_app_public:$uri" $fitr_browser_redirect {
    default "";
    "~^00:/crew/(?<fitr_cid>[^/]+)" "https://fitr.day/c/$fitr_cid";
    "~^00:" "https://fitr.day/";
}'''
OLD_MAP = 'map $http_upgrade $fitr_connection_upgrade { default upgrade; "" close; }'
assert OLD_MAP in s
s = s.replace(OLD_MAP, MAPS, 1)

# fitr.day: keep /download/, block internal APIs, proxy everything else.
start = s.index("    location = / {")
end_marker = "    location / {\n        return 301 https://app.fitr.day$request_uri;\n    }\n"
end = s.index(end_marker) + len(end_marker)
dl_start = s.index("    location /download/ {")
dl_end = s.index("    }\n", dl_start) + len("    }\n")
download = s[dl_start:dl_end]
NEW = download + '''    # Internal app/server APIs are not public on the landing host.
    location ~ ^/api/(attest|rpc|seeker|crank)(/|$) {
        return 404;
    }
    # Landing, info pages, /pool, /s/, /c/, Blinks (/actions.json, /api/actions/) and assets.
    # Next.js serves the landing at "/" (host rewrite) and redirects app screens back to "/".
    location / {
        proxy_pass http://127.0.0.1:3077;
        include /etc/fitr/nginx-proxy.conf;
    }
'''
s = s[:start] + NEW + s[end:]
s = s.replace(
    "# fitr.day: marketing landing (route /landing) + its assets + APK download; everything else -> app.",
    "# fitr.day: public site (landing, info, pool dashboard, share/invite pages, Blinks) + APK download.",
)

APP = "    server_name app.fitr.day;\n    client_max_body_size 1m;\n"
assert APP in s
s = s.replace(APP, APP + '''
    # Android-only app: browsers are redirected to the public site.
    if ($fitr_browser_redirect) {
        return 302 $fitr_browser_redirect;
    }
''', 1)

open(P, "w").write(s)
print("applied")
