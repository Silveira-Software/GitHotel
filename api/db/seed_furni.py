import json, csv, re

d = json.load(open('/tmp/furnidata.json'))
floor = d['roomitemtypes']['furnitype']
wall  = d['wallitemtypes']['furnitype']

def icon_url(classname, revision):
    # Habbo icon: color variants use '*' -> base before '*'; dots kept
    base = classname.split('*')[0]
    if revision and int(revision) > 0:
        return f"https://images.habbo.com/dcr/hof_furni/{revision}/{base}_icon.png"
    return f"https://images.habbo.com/dcr/hof_furni/{base}_icon.png"

def price_of(it):
    if it.get('rare'):
        return 500
    if it.get('furniline'):
        return 150
    cat = (it.get('category') or '')
    if cat in ('seating','bed','table'):
        return 60
    return 25

def sanitize(cn):
    s = re.sub(r'[^a-zA-Z0-9_]', '_', cn)
    return s[:80] or 'item'

rows = []
seen = set()
def add(it, item_type):
    cn = it.get('classname') or ''
    if not cn:
        return
    base_id = sanitize(cn)
    if item_type == 'wall':
        base_id = 'wall_' + base_id
    fid = base_id
    if fid in seen:
        fid = f"{base_id}__{it.get('id')}"
    if fid in seen:
        return
    seen.add(fid)
    name = (it.get('name') or cn).strip() or cn
    desc = (it.get('description') or '').strip()
    cat = (it.get('category') or ('wall' if item_type=='wall' else 'misc')) or 'misc'
    rev = it.get('revision') or 0
    rows.append({
        'id': fid,
        'name': name[:120],
        'category': cat[:40],
        'price': price_of(it),
        'sprite': icon_url(cn, rev),
        'width': it.get('xdim') or 1,
        'height': it.get('ydim') or 1,
        'revision': rev,
        'item_type': item_type,
        'furniline': (it.get('furniline') or '')[:60],
        'rare': bool(it.get('rare')),
        'description': desc[:240],
        'active': True,
    })

for it in floor: add(it, 'floor')
for it in wall:  add(it, 'wall')

cols = ['id','name','category','price','sprite','width','height','revision','item_type','furniline','rare','description','active']
with open('/tmp/furni.csv','w',newline='') as f:
    w = csv.DictWriter(f, fieldnames=cols)
    w.writeheader()
    for r in rows:
        r = dict(r)
        r['rare'] = 'true' if r['rare'] else 'false'
        r['active'] = 'true'
        w.writerow(r)

print('total rows:', len(rows))
from collections import Counter
c = Counter(r['category'] for r in rows)
print('top categories:', c.most_common(15))
print('rare count:', sum(1 for r in rows if r['rare']=='True' or r['rare'] is True))
print('sample:', rows[0]['id'], '|', rows[0]['name'], '|', rows[0]['sprite'])
