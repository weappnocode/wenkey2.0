import urllib.request, json, sys

token = 'sbp_ecba49ede5b0c1cfb7856c252aa0c970dac92474'
project = 'tasaalobestljwraqjov'

def api_get(path):
    req = urllib.request.Request(
        f'https://api.supabase.com/v1{path}',
        headers={'Authorization': f'Bearer {token}'},
        method='GET'
    )
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return {'error': e.code, 'body': e.read().decode()}

# Verify token works
print("=== Verify token - listing projects ===")
projects = api_get('/projects')
if isinstance(projects, list):
    for p in projects:
        marker = " <-- WENKEY" if p['id'] == project else ""
        print(f"  {p['id']} | {p.get('name','?')}{marker}")
else:
    print("ERROR:", projects)
    sys.exit(1)
